import { isStoredEvent } from './backup';
import { SyncError } from './sync';
import type { SharedLog } from './sync';
import type { StoredEvent } from './store';

/**
 * The real shared place: a plain HTTP client, nothing more.
 *
 * There is no server in this repository yet, so this file *is* the contract it
 * will have to meet. Whoever builds the endpoint must:
 *
 *   POST {baseUrl}/events        body { deviceId, events: [...] }
 *     Store one row per event id. Ignore an id already stored, so a re-sent
 *     event is harmless. Answer 2xx; an error status is a failed sync.
 *
 *   GET  {baseUrl}/events?deviceId=<id>&since=<cursor>     (no `since` on the first pull)
 *     Answer { cursor, events: [...] } with every event stored after `cursor`
 *     — the phone's own included — and a cursor to send next time. The cursor
 *     is opaque to the phone: any string that always moves forward.
 *
 * An optional bearer token is sent when configured. Nothing else is assumed:
 * the phone never asks the server what a number means, only what happened.
 */
export interface HttpSyncOptions {
  /** Where the shared place answers, e.g. `https://…/sync`. */
  baseUrl: string;
  /** Sent as `Authorization: Bearer …` when set. */
  token?: string;
  /** The network call itself, injected so a test never opens a socket. */
  fetch?: typeof fetch;
}

/** A sync the server refused or answered with something unreadable. */
export function createHttpExchange(options: HttpSyncOptions): SharedLog {
  const base = options.baseUrl.replace(/\/+$/, '');
  const send = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  return {
    async push({ deviceId, events }) {
      if (events.length === 0) return;
      const answer = await request(`${base}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceId, events }),
      });
      if (!answer.ok) {
        throw new SyncError(`Tempat bersama menolak catatan (${answer.status}). Catatan tetap di ponsel ini.`);
      }
    },

    async pull({ deviceId, since }) {
      const query = `deviceId=${encodeURIComponent(deviceId)}`;
      const url = since === null ? `${base}/events?${query}` : `${base}/events?${query}&since=${encodeURIComponent(since)}`;
      const answer = await request(url, { method: 'GET', headers });
      if (!answer.ok) {
        throw new SyncError(`Tempat bersama tidak menjawab (${answer.status}). Catatan tetap di ponsel ini.`);
      }
      const body = (await answer.json().catch(() => null)) as unknown;
      if (!isAnswer(body)) {
        throw new SyncError('Jawaban tempat bersama tidak bisa dibaca. Catatan di ponsel ini tidak diubah.');
      }
      return body;
    },
  };

  async function request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await send(url, init);
    } catch {
      // A dead connection is the normal way to be offline, not a crash.
      throw new SyncError('Tidak bisa menyambung ke tempat bersama. Catatan tetap tersimpan di ponsel ini.');
    }
  }
}

/** A pull answer the phone can trust: a cursor and events with an envelope. */
function isAnswer(value: unknown): value is { cursor: string | null; events: StoredEvent[] } {
  if (typeof value !== 'object' || value === null) return false;
  const answer = value as { cursor?: unknown; events?: unknown };
  if (answer.cursor !== null && typeof answer.cursor !== 'string') return false;
  return Array.isArray(answer.events) && answer.events.every(isStoredEvent);
}
