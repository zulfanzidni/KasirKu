import type { Ledger } from './ledger';
import type { StoredEvent } from './store';
import type { LedgerEvent } from './types';

/**
 * Sync: two phones agree by exchanging their logs (ADR 0001).
 *
 * The merge is a **union of event lists keyed by event id**, so it is additive
 * and idempotent by construction: a re-sent event is skipped by the store, and
 * the order events arrive in cannot change the numbers they fold to. There is
 * deliberately no switch on the event type here — a new event type added by a
 * later ticket syncs without this file knowing it exists.
 *
 * This module is the seam. `SharedLog` is what a server must do, `syncLedger`
 * is the one exchange, and `syncExchange` is the connection the app entry (or a
 * test) points at a real or in-memory place to meet.
 */
export interface SharedLog {
  /**
   * Hand the server this phone's events. It must keep one row per event id, so
   * sending the same event again is harmless — that is what makes a failed
   * sync safe to retry.
   */
  push(input: { deviceId: string; events: readonly StoredEvent[] }): Promise<void>;
  /**
   * Everything the shared place holds that came after `since`, and a cursor to
   * send next time. `since` is null on a phone's first pull. The answer may
   * include this phone's own events; the merge skips what it already has.
   */
  pull(input: { deviceId: string; since: string | null }): Promise<{
    events: StoredEvent[];
    cursor: string | null;
  }>;
}

/** A sync that could not finish. The events stay where they are and the screen says so. */
export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * How far this phone has got with the shared place.
 *
 * `lastAckSeq` is the last of *this phone's own* event numbers the server has
 * accepted; everything above it is still unsent. `cursor` is the server's
 * position from which the next pull continues. Both advance only after a whole
 * exchange succeeds, so a half-finished attempt simply runs again.
 */
export interface SyncCheckpoint {
  lastAckSeq: number;
  cursor: string | null;
  /** When the last exchange finished; null means this phone has never synced. */
  lastSyncAt: string | null;
}

export const STARTING_CHECKPOINT: SyncCheckpoint = { lastAckSeq: 0, cursor: null, lastSyncAt: null };

/** What one exchange did, in the owner's terms: sent, received, and new. */
export interface SyncReport {
  /** This phone's events handed to the shared place. */
  pushed: number;
  /** Events the shared place answered with. */
  pulled: number;
  /** Of those, the ones this phone had never seen. */
  applied: number;
}

/**
 * This phone's events the shared place has not acknowledged, oldest first.
 *
 * Only our own events are ours to send: the other phone pushes its own, and a
 * phone that pushed someone else's events would hide which phone wrote what
 * (user story 86).
 */
export function unsentEvents(
  events: readonly LedgerEvent[],
  deviceId: string,
  lastAckSeq: number,
): StoredEvent[] {
  return (events as StoredEvent[]).filter((event) => event.deviceId === deviceId && event.seq > lastAckSeq);
}

/**
 * One complete exchange, and the checkpoint that follows it.
 *
 * Push first: the shared place is where the two logs meet, so nothing local is
 * discarded if the pull fails. The returned checkpoint moves only when the
 * whole exchange finished; a failure throws and leaves the caller's checkpoint
 * exactly where it was, so every unsent event is still there to send again.
 */
export async function syncLedger(
  ledger: Ledger,
  shared: SharedLog,
  checkpoint: SyncCheckpoint,
  now: Date = new Date(),
): Promise<{ checkpoint: SyncCheckpoint; report: SyncReport }> {
  const deviceId = ledger.deviceId;
  const events = await ledger.events();
  const outgoing = unsentEvents(events, deviceId, checkpoint.lastAckSeq);

  await shared.push({ deviceId, events: outgoing });

  const incoming = await shared.pull({ deviceId, since: checkpoint.cursor });
  const applied = await ledger.applyRemote(incoming.events);

  const acknowledged = outgoing.reduce((high, event) => Math.max(high, event.seq), checkpoint.lastAckSeq);
  return {
    checkpoint: {
      lastAckSeq: acknowledged,
      cursor: incoming.cursor ?? checkpoint.cursor,
      lastSyncAt: now.toISOString(),
    },
    report: { pushed: outgoing.length, pulled: incoming.events.length, applied },
  };
}

/**
 * The shared place this phone talks to. The app entry wires the real endpoint;
 * tests wire one two phones can share. Until then, syncing refuses out loud
 * rather than pretending the other phone heard.
 */
export const syncExchange: { current: SharedLog } = {
  current: {
    push: async () => {
      throw new SyncError('Sinkron belum disambungkan ke tempat bersama.');
    },
    pull: async () => {
      throw new SyncError('Sinkron belum disambungkan ke tempat bersama.');
    },
  },
};

/** Point the app at a shared place. Only the app entry and the tests call this. */
export function connectSync(next: SharedLog): void {
  syncExchange.current = next;
}

/** A stored checkpoint, or the starting one when there is none to trust. */
export function parseCheckpoint(text: string | null): SyncCheckpoint {
  if (!text) return STARTING_CHECKPOINT;
  try {
    const raw = JSON.parse(text) as Partial<SyncCheckpoint>;
    return {
      lastAckSeq: typeof raw.lastAckSeq === 'number' && Number.isFinite(raw.lastAckSeq) ? raw.lastAckSeq : 0,
      cursor: typeof raw.cursor === 'string' ? raw.cursor : null,
      lastSyncAt: typeof raw.lastSyncAt === 'string' ? raw.lastSyncAt : null,
    };
  } catch {
    // A checkpoint that cannot be read is not history: starting over re-sends
    // events the server already has, which it is built to ignore.
    return STARTING_CHECKPOINT;
  }
}
