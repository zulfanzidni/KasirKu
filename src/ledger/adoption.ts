import type { Ledger } from './ledger';
import { unsentEvents, type SharedLog, type SyncCheckpoint } from './sync';
import type { StoredEvent } from './store';

/**
 * Adopting a dead phone's identity (ADR 0003).
 *
 * This is the *other* recovery path from backup/restore: the log is not
 * replaced, only the name on the next event and the number it takes. It is
 * offered because a phone that dies with unsynced sales would otherwise strand
 * them, but it is only safe when the old phone will never sync again — two
 * phones pushing one identity would collide and lose events.
 *
 * The app therefore refuses when it can see the old phone is still writing:
 * the shared place holds notes from that identity that this phone has not
 * received. That is the one piece of evidence available, and it is enough to
 * stop the obvious mistake. The owner's own promise that the old phone is gone
 * is what the setting asks for.
 */

/** An adoption the app will not perform, with the reason in the owner's words. */
export class AdoptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdoptionError';
  }
}

/** What one adoption did: the identity now in use and the checkpoint that follows. */
export interface AdoptionResult {
  deviceId: string;
  checkpoint: SyncCheckpoint;
}

/** Another phone whose notes are in this log, as the setting lists it. */
export interface DeviceIdentity {
  deviceId: string;
  /** How many of its notes this phone holds. */
  events: number;
  /** The last number it used, so the owner can see how far its stream got. */
  lastSeq: number;
  /** When it last wrote, so the list reads newest first. */
  lastAt: string;
}

/**
 * The identities this phone could adopt: every other phone that wrote notes in
 * this log, newest activity first. The phone's own name is not a choice.
 */
export function knownIdentities(events: readonly StoredEvent[], ownDeviceId: string): DeviceIdentity[] {
  const byDevice = new Map<string, DeviceIdentity>();
  for (const event of events) {
    if (event.deviceId === ownDeviceId) continue;
    const current = byDevice.get(event.deviceId);
    if (!current) {
      byDevice.set(event.deviceId, {
        deviceId: event.deviceId,
        events: 1,
        lastSeq: event.seq,
        lastAt: event.createdAt,
      });
      continue;
    }
    current.events += 1;
    if (event.seq > current.lastSeq) current.lastSeq = event.seq;
    if (event.createdAt > current.lastAt) current.lastAt = event.createdAt;
  }
  return [...byDevice.values()].sort((left, right) => right.lastAt.localeCompare(left.lastAt));
}

/** The last number a given phone used in a set of events; 0 when it has none. */
function tailOf(events: readonly StoredEvent[], deviceId: string): number {
  return events
    .filter((event) => event.deviceId === deviceId)
    .reduce((high, event) => Math.max(high, event.seq), 0);
}

/**
 * Continue `candidateId`'s stream on this phone.
 *
 * The order matters: check first, then send what this phone wrote, then take
 * in the rest, and only then move the identity. A refusal or a failed send
 * leaves the phone exactly as it was, so nothing is lost by trying.
 */
export async function adoptDeviceIdentity(
  ledger: Ledger,
  shared: SharedLog,
  checkpoint: SyncCheckpoint,
  candidateId: string,
  now: Date = new Date(),
): Promise<AdoptionResult> {
  if (candidateId === ledger.deviceId) {
    throw new AdoptionError('Ponsel ini sudah memakai identitas itu.');
  }

  const local = (await ledger.events()) as StoredEvent[];
  const localMax = tailOf(local, candidateId);
  if (localMax === 0) {
    throw new AdoptionError('Identitas itu tidak dikenal di catatan ponsel ini.');
  }

  // What the shared place holds for the candidate. If its stream has moved
  // past what this phone has, the old phone is still writing: adopting it now
  // would put two phones on one identity.
  let incoming: { events: StoredEvent[]; cursor: string | null };
  try {
    incoming = await shared.pull({ deviceId: ledger.deviceId, since: null });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new AdoptionError(
      `Tidak bisa memeriksa tempat bersama, jadi adopsi dibatalkan: ${reason} Sambungkan dulu, lalu coba lagi.`,
    );
  }
  if (tailOf(incoming.events, candidateId) > localMax) {
    throw new AdoptionError(
      'Catatan dari ponsel itu masih berdatangan. Sinkron dulu, dan pastikan ponsel lamanya benar-benar tidak dipakai lagi.',
    );
  }

  // Nothing this phone wrote may be stranded by the name change: send it
  // before the identity moves. A failed send refuses the adoption.
  const outgoing = unsentEvents(local, ledger.deviceId, checkpoint.lastAckSeq);
  await shared.push({ deviceId: ledger.deviceId, events: outgoing });

  // Take in whatever else the shared place holds, so the adopted stream is
  // whole before it is continued. Repeats are skipped by the store.
  await ledger.applyRemote(incoming.events);

  await ledger.adoptIdentity(candidateId);

  return {
    deviceId: candidateId,
    checkpoint: {
      // The adopted phone's notes are already in the shared place; only what
      // this phone writes from now on is unsent.
      lastAckSeq: localMax,
      cursor: incoming.cursor ?? checkpoint.cursor,
      lastSyncAt: now.toISOString(),
    },
  };
}
