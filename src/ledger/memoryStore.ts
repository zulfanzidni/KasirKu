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
  private lastSeq = 0;

  async nextIdentity(): Promise<{ id: string; seq: number }> {
    this.lastSeq += 1;
    const random = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    return { id: `evt-${this.lastSeq}-${random}`, seq: this.lastSeq };
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
}
