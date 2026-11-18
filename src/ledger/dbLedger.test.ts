import { createDbLedger } from './dbLedger';
import { DuplicateEventError } from './store';

describe('the SQLite ledger', () => {
  it('gives every event the next sequence number, never one already used', async () => {
    const ledger = await createDbLedger(new FakeDb(), 'gawai-1');

    const first = await ledger.nextIdentity();
    const second = await ledger.nextIdentity();

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(first.id).not.toBe(second.id);
  });

  it('numbers an event even though the transaction helper returns nothing', async () => {
    // expo-sqlite's `withTransactionAsync` resolves with `undefined`; the fake
    // below mirrors that deliberately. Reading the number out of its result
    // gave `undefined`, which SQLite binds as NULL — every sale on a real phone
    // failed with "NOT NULL constraint failed: events.seq".
    const ledger = await createDbLedger(new FakeDb(), 'gawai-1');

    const { seq } = await ledger.nextIdentity();

    expect(Number.isInteger(seq)).toBe(true);
    expect(seq).toBe(1);
  });

  it('refuses to write an id twice, so the log can never be rewritten', async () => {
    const ledger = await createDbLedger(new FakeDb(), 'gawai-1');
    const { id, seq } = await ledger.nextIdentity();
    const event = {
      id,
      seq,
      deviceId: 'gawai-1',
      createdAt: '2026-10-31T09:00:00.000Z',
      type: 'kategori.created' as const,
      payload: { nama: 'Tepung', parentId: null },
    };

    await ledger.append([event]);

    await expect(ledger.append([event])).rejects.toBeInstanceOf(DuplicateEventError);
  });

  it('reads the log back oldest first, with the payload intact', async () => {
    const db = new FakeDb();
    const before = await createDbLedger(db, 'gawai-1');
    await before.append([
      {
        id: 'b',
        seq: 2,
        deviceId: 'gawai-1',
        createdAt: '2026-10-31T09:01:00.000Z',
        type: 'produk.created',
        payload: { kategoriId: 'k', nama: 'Tepung terigu' },
      },
      {
        id: 'a',
        seq: 1,
        deviceId: 'gawai-1',
        createdAt: '2026-10-31T09:00:00.000Z',
        type: 'kategori.created',
        payload: { nama: 'Tepung', parentId: null },
      },
    ]);

    const reopened = await createDbLedger(db, 'gawai-1');
    const log = await reopened.readAll();

    expect(log.map((event) => event.id)).toEqual(['a', 'b']);
    expect(log[1].payload).toEqual({ kategoriId: 'k', nama: 'Tepung terigu' });
  });

  it("replaces the whole log on a restore and continues after the backup's tail", async () => {
    const db = new FakeDb();
    const phone = await createDbLedger(db, 'gawai-1');
    await phone.append([
      {
        id: 'lama',
        seq: 1,
        deviceId: 'gawai-1',
        createdAt: '2026-10-31T09:00:00.000Z',
        type: 'kategori.created',
        payload: { nama: 'Toko lama', parentId: null },
      },
    ]);

    await phone.replaceAll(
      [
        {
          id: 'pulih',
          seq: 4,
          deviceId: 'gawai-ibu',
          createdAt: '2026-11-01T09:00:00.000Z',
          type: 'kategori.created',
          payload: { nama: 'Sembako', parentId: null },
        },
      ],
      // The tail can sit above the last kept event: a burned number is not reused.
      9,
    );

    expect((await phone.readAll()).map((event) => event.id)).toEqual(['pulih']);
    expect(await phone.lastSeq()).toBe(9);
    expect((await phone.nextIdentity()).seq).toBe(10);
  });
});

/**
 * The smallest thing that behaves like the three SQL calls the adapter makes.
 * It stands in for SQLite, not for the ledger: every assertion above goes
 * through `createDbLedger`.
 */
class FakeDb {
  events: { id: string; seq: number; payload: string; [key: string]: unknown }[] = [];
  meta = new Map<string, number>();

  async execAsync() {}

  /** One "transaction" is simply: run the task. Uniqueness lives in the fake store. */
  async withTransactionAsync(task: () => Promise<unknown>): Promise<void> {
    await task();
  }

  async runAsync(sql: string, params: unknown[] = []) {
    if (/DELETE\s+FROM\s+events/i.test(sql)) {
      this.events = [];
    } else if (/INTO\s+ledger_meta/i.test(sql)) {
      this.meta.set(String(params[0]), Number(params[1]));
    } else if (/INTO\s+events/i.test(sql)) {
      const [id, deviceId, seq, createdAt, type, payload] = params;
      this.events.push({ id, deviceId, seq, createdAt, type, payload } as never);
    }
  }

  async getFirstAsync(sql: string, params: unknown[] = []) {
    if (/FROM\s+ledger_meta/i.test(sql)) {
      const value = this.meta.get(String(params[0]));
      return value === undefined ? null : ({ value } as never);
    }
    if (/FROM\s+events\s+WHERE\s+id/i.test(sql)) {
      return this.events.some((event) => event.id === params[0]) ? ({ one: 1 } as never) : null;
    }
    return null;
  }

  async getAllAsync(sql: string) {
    if (/FROM\s+events/i.test(sql)) {
      return this.events.slice().sort((a, b) => a.seq - b.seq) as never;
    }
    return [] as never;
  }
}
