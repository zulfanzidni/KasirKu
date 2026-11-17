import { createHttpExchange } from './syncHttp';
import type { SharedLog } from './sync';
import type { StoredEvent } from './store';

/**
 * The HTTP client, checked at the wire it will actually speak.
 *
 * `fetch` is injected, so no socket is opened: what is asserted is the request
 * the server will receive and the refusal the phone gives when the answer is
 * not one it can trust. This is the contract a future endpoint has to meet.
 */

const BASE = 'https://contoh.test/sinkron';

const satu: StoredEvent = {
  id: 'evt-1',
  deviceId: 'gawai-ibu',
  seq: 3,
  createdAt: '2026-11-17T07:00:00.000Z',
  type: 'stock.adjusted',
  payload: { varianId: 'v-1', delta: -2, reason: 'Hitung rak' },
};

type Call = { url: string; init: RequestInit };

function fakeFetch(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const send = (async (url: string, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    return answer(call);
  }) as unknown as typeof fetch;
  return { calls, send };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('tempat bersama lewat HTTP', () => {
  it('mengirim catatan sebagai satu kiriman dan membacanya sesudah penanda', async () => {
    const { calls, send } = fakeFetch(() => json({ cursor: '7', events: [satu] }));
    const shared: SharedLog = createHttpExchange({ baseUrl: BASE, fetch: send });

    await shared.push({ deviceId: 'gawai-anak', events: [satu] });
    expect(calls[0].url).toBe(`${BASE}/events`);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ deviceId: 'gawai-anak', events: [satu] });

    const answer = await shared.pull({ deviceId: 'gawai-anak', since: '4' });
    expect(calls[1].url).toBe(`${BASE}/events?deviceId=gawai-anak&since=4`);
    expect(calls[1].init.method).toBe('GET');
    expect(answer).toEqual({ cursor: '7', events: [satu] });
  });

  it('tidak mengirim apa pun saat tidak ada catatan baru, dan tidak memakai since pada tarikan pertama', async () => {
    const { calls, send } = fakeFetch(() => json({ cursor: null, events: [] }));
    const shared = createHttpExchange({ baseUrl: `${BASE}/`, fetch: send });

    await shared.push({ deviceId: 'gawai-anak', events: [] });
    expect(calls).toHaveLength(0);

    await shared.pull({ deviceId: 'gawai-anak', since: null });
    expect(calls[0].url).toBe(`${BASE}/events?deviceId=gawai-anak`);
  });

  it('membawa token bila tempat bersama memintanya', async () => {
    const { calls, send } = fakeFetch(() => json({ cursor: '1', events: [] }));
    const shared = createHttpExchange({ baseUrl: BASE, token: 'rahasia', fetch: send });

    await shared.pull({ deviceId: 'gawai-anak', since: null });

    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer rahasia');
  });

  it('menolak dengan kalimat jelas saat sambungan mati, bukan melempar galat jaringan', async () => {
    const send = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const shared = createHttpExchange({ baseUrl: BASE, fetch: send });

    await expect(shared.pull({ deviceId: 'gawai-anak', since: null })).rejects.toThrow(
      /Tidak bisa menyambung ke tempat bersama/,
    );
  });

  it('menolak jawaban yang tidak bisa dipercaya tanpa menyentuh catatan', async () => {
    const rusak = fakeFetch(() => json({ cursor: '9', events: [{ id: 'tanpa-amplop' }] }));
    await expect(
      createHttpExchange({ baseUrl: BASE, fetch: rusak.send }).pull({ deviceId: 'gawai-anak', since: null }),
    ).rejects.toThrow(/tidak bisa dibaca/);

    const galat = fakeFetch(() => json({ pesan: 'server rusak' }, 500));
    await expect(
      createHttpExchange({ baseUrl: BASE, fetch: galat.send }).pull({ deviceId: 'gawai-anak', since: null }),
    ).rejects.toThrow(/tidak menjawab \(500\)/);
  });
});
