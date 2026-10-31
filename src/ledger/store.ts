/**
 * The ledger store: one append-only log on disk, plus a device counter that
 * never goes backwards (spec §8, ADR 0001).
 *
 * Everything else in the app talks to this interface and never to SQLite, so
 * the tests can run against a real in-memory ledger rather than a mock that
 * agrees with whatever the code happens to do.
 */
import type { LedgerEvent } from './types';

/** An event as written: the envelope plus its own id. */
export type StoredEvent = LedgerEvent & { id: string };

export interface LedgerStore {
  /**
   * The next event's identity. Reading a sequence reserves it: if the append
   * then fails, the gap is harmless (the log only needs `seq` to be unique and
   * increasing), whereas reusing it would overwrite a row.
   */
  nextIdentity(): Promise<{ id: string; seq: number }>;
  /** Append events in the order given. Refuses to overwrite an existing id. */
  append(events: readonly StoredEvent[]): Promise<void>;
  /** The whole log, oldest first. */
  readAll(): Promise<StoredEvent[]>;
}

/** Thrown when an id is already in the log. Events are never rewritten. */
export class DuplicateEventError extends Error {
  constructor(id: string) {
    super(`Event ${id} sudah ada di catatan.`);
    this.name = 'DuplicateEventError';
  }
}
