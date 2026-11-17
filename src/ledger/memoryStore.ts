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
    for (const event of events) {
      if (this.events.some((existing) => existing.id === event.id)) {
        throw new DuplicateEventError(event.id);
      }
      this.events.push(structuredClone(event) as LedgerEvent as StoredEvent);
    }
  }

  async readAll(): Promise<StoredEvent[]> {
    return this.events.map((event) => structuredClone(event) as LedgerEvent as StoredEvent);
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

  /** The counter the SQL layer wrote to its meta table, mirrored here. */
  setLastSeq(value: number): void {
    this.seq = Math.max(this.seq, value);
  }
}
