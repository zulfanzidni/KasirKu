import { DuplicateEventError, type StoredEvent } from './store';
import type { LedgerEvent } from './types';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqlDatabase } from './sqlDatabase';

export type { SqlDatabase };
export type { SQLiteDatabase };

interface EventRow {
  id: string;
  device_id: string;
  seq: number;
  created_at: string;
  type: string;
  payload: string;
}

interface MetaRow {
  value: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_device_seq ON events (device_id, seq);
CREATE TABLE IF NOT EXISTS ledger_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value INTEGER NOT NULL
);
`;

const SEQ_KEY = 'last_seq';

/**
 * The ledger's table on the phone's SQLite file.
 *
 * `seq` lives in `ledger_meta` and is updated before the event is written. A
 * crash in between burns a number, and that is the intended trade: a gap is
 * detectable and harmless, a reused number would be two events claiming to be
 * one.
 */
export async function createDbLedger(db: SqlDatabase, deviceId: string) {
  await db.execAsync(SCHEMA);

  const store = {
    async nextIdentity(): Promise<{ id: string; seq: number }> {
      // The counter and the row it numbers are written in one transaction: a
      // kill between them would either burn a seq (harmless) or, worse, leave
      // the counter behind a row that already exists (a reused number).
      const seq = await db.withTransactionAsync(async () => {
        const current = await db.getFirstAsync<MetaRow>('SELECT value FROM ledger_meta WHERE key = ?', [
          SEQ_KEY,
        ]);
        const next = (current?.value ?? 0) + 1;
        await db.runAsync(
          'INSERT INTO ledger_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [SEQ_KEY, next],
        );
        return next;
      });
      return { id: newEventId(), seq: Number(seq) };
    },

    async append(events: readonly StoredEvent[]): Promise<void> {
      for (const event of events) {
        const exists = await db.getFirstAsync<{ one: number }>('SELECT 1 AS one FROM events WHERE id = ?', [
          event.id,
        ]);
        if (exists) throw new DuplicateEventError(event.id);
        await db.runAsync('INSERT INTO events (id, device_id, seq, created_at, type, payload) VALUES (?, ?, ?, ?, ?, ?)', [
          event.id,
          event.deviceId,
          event.seq,
          event.createdAt,
          event.type,
          JSON.stringify(event.payload),
        ]);
      }
    },

    async readAll(): Promise<StoredEvent[]> {
      // `seq` is per device, so a merged log needs a total order: device time
      // first, then device and sequence, so two phones fold identically.
      const rows = await db.getAllAsync<EventRow>(
        'SELECT id, device_id, seq, created_at, type, payload FROM events ORDER BY created_at ASC, device_id ASC, seq ASC',
      );
      return rows.map(
        (row) =>
          ({
            id: row.id,
            deviceId: row.device_id,
            seq: row.seq,
            createdAt: row.created_at,
            type: row.type,
            payload: JSON.parse(row.payload),
          }) as LedgerEvent as StoredEvent,
      );
    },

    async lastSeq(): Promise<number> {
      const row = await db.getFirstAsync<MetaRow>('SELECT value FROM ledger_meta WHERE key = ?', [SEQ_KEY]);
      return Number(row?.value ?? 0);
    },

    async replaceAll(events: readonly StoredEvent[], lastSeq: number): Promise<void> {
      // One transaction: a kill halfway through must not leave a phone with
      // half of one shop's history and half of another's.
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM events');
        for (const event of events) {
          await db.runAsync('INSERT INTO events (id, device_id, seq, created_at, type, payload) VALUES (?, ?, ?, ?, ?, ?)', [
            event.id,
            event.deviceId,
            event.seq,
            event.createdAt,
            event.type,
            JSON.stringify(event.payload),
          ]);
        }
        // The tail is written last, as it was for the events themselves: the
        // next number must follow the restored history, never precede it.
        const tail = events.reduce((high, event) => Math.max(high, event.seq), lastSeq);
        await db.runAsync(
          'INSERT INTO ledger_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [SEQ_KEY, tail],
        );
      });
    },
  };

  return { ...store, deviceId };
}

/** A UUID v4. Device-generated, so re-sending the same event is idempotent. */
export function newEventId(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
