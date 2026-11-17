import { SyncError, type SharedLog } from './sync';
import type { StoredEvent } from './store';

/**
 * The shared place two phones meet, in memory.
 *
 * It is not a mock of the app: it is a second implementation of the same
 * `SharedLog` contract the real endpoint must satisfy, so the tests pin what
 * sync *means* — that a pushed event is stored once, that a pull answers only
 * what came after the cursor, and that a dead connection refuses loudly.
 *
 * The cursor is the server's own increasing number, exactly as a table with a
 * serial column would hand out. Events are handed back oldest first.
 */
export class MemoryExchange implements SharedLog {
  /** Stand-in for a dead connection: every exchange refuses from here on. */
  offline = false;

  /** Stand-in for a connection that dies between sending and fetching. */
  failPull = false;

  private readonly stored: { cursor: number; event: StoredEvent }[] = [];
  private nextCursor = 0;

  async push({ events }: { deviceId: string; events: readonly StoredEvent[] }): Promise<void> {
    this.requireSignal();
    for (const event of events) {
      // The server is idempotent by id: a re-sent event is stored once.
      if (this.stored.some((entry) => entry.event.id === event.id)) continue;
      this.nextCursor += 1;
      this.stored.push({ cursor: this.nextCursor, event: structuredClone(event) as StoredEvent });
    }
  }

  async pull({ since }: { deviceId: string; since: string | null }): Promise<{
    events: StoredEvent[];
    cursor: string | null;
  }> {
    this.requireSignal();
    if (this.failPull) {
      throw new SyncError('Sambungan putus sebelum jawaban datang.');
    }
    const from = since === null ? 0 : Number(since);
    const rows = this.stored.filter((entry) => entry.cursor > from);
    return {
      events: rows.map((entry) => structuredClone(entry.event) as StoredEvent),
      cursor: String(this.nextCursor),
    };
  }

  /** Every id the shared place holds, for a test that asks what actually crossed. */
  ids(): string[] {
    return this.stored.map((entry) => entry.event.id);
  }

  private requireSignal(): void {
    if (this.offline) {
      throw new SyncError('Tidak ada sambungan ke tempat bersama.');
    }
  }
}
