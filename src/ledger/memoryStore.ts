import { DuplicateEventError, type LedgerStore, type StoredEvent } from './store';
import type { LedgerEvent } from './types';

/**
 * An in-memory log with the same contract as the SQLite one.
 *
 * It is not a mock of the SQL layer: it is a second, simpler implementation of
 * the same store interface, so a test against it pins the *ledger's* behaviour
 * (append-only, monotonic, survives a reopen) rather than the SQL text.
 */
export class MemoryStore implements LedgerStore {
  readonly events: StoredEvent[] = [];
  private seq = 0;

  async nextIdentity(): Promise<{ id: string; seq: number }> {
    this.seq += 1;
    const random = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    return { id: `evt-${this.seq}-${random}`, seq: this.seq };
  }

  async append(events: readonly StoredEvent[]): Promise<void> {
    // Check the whole batch before writing any of it: a duplicate in the last
    // event must not leave the first ones behind. The import relies on this.
    const seen = new Set(this.events.map((event) => event.id));
    for (const event of events) {
      if (seen.has(event.id)) throw new DuplicateEventError(event.id);
      seen.add(event.id);
    }
    for (const event of events) {
      this.events.push(structuredClone(event) as LedgerEvent as StoredEvent);
    }
  }

  async appendAbsent(events: readonly StoredEvent[]): Promise<number> {
    // Sync's merge: an id already here is the same happening, already told.
    const seen = new Set(this.events.map((event) => event.id));
    let added = 0;
    for (const event of events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      this.events.push(structuredClone(event) as LedgerEvent as StoredEvent);
      added += 1;
    }
    return added;
  }

  async readAll(): Promise<StoredEvent[]> {
    // A merged log needs a total order, and it has to be the same one on every
    // phone: the shared place hands events out in the order they arrived, but
    // "arrived" is a transport detail. Device time first, then device and
    // sequence, exactly as the SQLite store orders its rows.
    return [...this.events]
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.deviceId.localeCompare(right.deviceId) ||
          left.seq - right.seq,
      )
      .map((event) => structuredClone(event) as LedgerEvent as StoredEvent);
  }

  async lastSeq(): Promise<number> {
    return this.seq;
  }

  async replaceAll(events: readonly StoredEvent[], lastSeq: number): Promise<void> {
    this.events.length = 0;
    for (const event of events) {
      this.events.push(structuredClone(event) as LedgerEvent as StoredEvent);
    }
    // A tail below the events it claims to follow would hand out a used number.
    this.seq = events.reduce((high, event) => Math.max(high, event.seq), lastSeq);
  }

  /** The counter the SQL layer wrote to its meta table, mirrored here exactly. */
  setLastSeq(value: number): void {
    this.seq = value;
  }

  async continueFrom(lastSeq: number): Promise<void> {
    // Adoption moves the counter to the adopted phone's tail, even when this
    // phone had written further: the numbers now belong to the other stream.
    this.seq = lastSeq;
  }
}
