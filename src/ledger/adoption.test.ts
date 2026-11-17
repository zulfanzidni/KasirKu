import { createLedger, type Ledger } from './ledger';
import { adoptDeviceIdentity } from './adoption';
import { MemoryExchange } from './memoryExchange';
import { MemoryStore } from './memoryStore';
import { STARTING_CHECKPOINT, syncLedger, unsentEvents } from './sync';
import type { StoredEvent } from './store';

/**
 * Adopsi identitas — continuing a dead phone's stream on a replacement.
 *
 * The tests speak in the shop's terms: the old phone wrote five notes, the new
 * phone takes over its name, and the next note is number six — never a second
 * number one. Nothing here reads SQL or the sync endpoint's insides.
 */

function phone(deviceId: string): Ledger {
  return createLedger(new MemoryStore(), deviceId);
}

/** Five notes written by one phone, so its stream has a tail to continue. */
async function seedLima(ledger: Ledger): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await ledger.append('catatan.uji', { i });
  }
}

describe('adopsi identitas ponsel yang mati', () => {
  it('melanjutkan nomor urut ponsel lama, bukan mengulanginya', async () => {
    const mati = phone('gawai-mati');
    await seedLima(mati);

    // The replacement already holds the dead phone's notes, as it would after
    // a sync. It has its own name and its own counter, which is the problem.
    const baru = phone('gawai-baru');
    await baru.applyRemote((await mati.events()) as StoredEvent[]);
    await baru.adoptIdentity('gawai-mati');

    expect(baru.deviceId).toBe('gawai-mati');
    const id = await baru.append('catatan.uji', { sesudah: true });
    const event = (await baru.events()).find((entry) => entry.id === id)!;
    expect(event.deviceId).toBe('gawai-mati');
    // The dead phone used 1..5; the replacement must not reuse any of them.
    expect(event.seq).toBe(6);
  });

  it('melanjutkan nomor ponsel lama walau ponsel ini sudah menulis lebih jauh', async () => {
    const mati = phone('gawai-mati');
    await seedLima(mati);

    const baru = phone('gawai-baru');
    await baru.applyRemote((await mati.events()) as StoredEvent[]);
    // The replacement wrote ten notes of its own before the old phone died.
    for (let i = 0; i < 10; i += 1) {
      await baru.append('catatan.uji', { i });
    }
    await baru.adoptIdentity('gawai-mati');

    const id = await baru.append('catatan.uji', { sesudah: true });
    const event = (await baru.events()).find((entry) => entry.id === id)!;
    expect(event.deviceId).toBe('gawai-mati');
    // The old phone's stream continues at 6, not at this phone's 11: a gap in
    // the adopted stream would look like lost notes.
    expect(event.seq).toBe(6);
  });

  it('menolak identitas yang catatannya masih berdatangan', async () => {
    const shared = new MemoryExchange();
    const mati = phone('gawai-mati');
    await seedLima(mati);
    const checkpointMati = (await syncLedger(mati, shared, STARTING_CHECKPOINT)).checkpoint;

    // The replacement has already received the old phone's notes.
    const baru = phone('gawai-baru');
    const checkpointBaru = (await syncLedger(baru, shared, STARTING_CHECKPOINT)).checkpoint;

    // The old phone is not dead after all: it writes one more note and sends it.
    await mati.append('catatan.uji', { masih: true });
    await syncLedger(mati, shared, checkpointMati);

    // Adopting now would put two phones on one identity, so it is refused.
    await expect(adoptDeviceIdentity(baru, shared, checkpointBaru, 'gawai-mati')).rejects.toThrow(
      /masih berdatangan/i,
    );
    expect(baru.deviceId).toBe('gawai-baru');
    // Nothing was applied or sent: the refusal leaves the phone as it was.
    expect(await baru.events()).toHaveLength(5);
  });

  it('menolak adopsi saat tempat bersama tidak bisa diperiksa', async () => {
    const shared = new MemoryExchange();
    const mati = phone('gawai-mati');
    await seedLima(mati);
    await syncLedger(mati, shared, STARTING_CHECKPOINT);

    const baru = phone('gawai-baru');
    const checkpointBaru = (await syncLedger(baru, shared, STARTING_CHECKPOINT)).checkpoint;

    // Without a connection the app cannot see whether the old phone is still
    // writing, so it refuses rather than guessing.
    shared.offline = true;
    await expect(adoptDeviceIdentity(baru, shared, checkpointBaru, 'gawai-mati')).rejects.toThrow(
      /Tidak bisa memeriksa tempat bersama/i,
    );
    expect(baru.deviceId).toBe('gawai-baru');
  });

  it('catatan sesudah adopsi terkirim sekali, bukan dua kali', async () => {
    const shared = new MemoryExchange();
    const mati = phone('gawai-mati');
    await seedLima(mati);
    await syncLedger(mati, shared, STARTING_CHECKPOINT);

    const baru = phone('gawai-baru');
    const checkpointBaru = (await syncLedger(baru, shared, STARTING_CHECKPOINT)).checkpoint;
    const { checkpoint } = await adoptDeviceIdentity(baru, shared, checkpointBaru, 'gawai-mati');

    // The adopted notes are already in the shared place: nothing to resend.
    expect(unsentEvents(await baru.events(), baru.deviceId, checkpoint.lastAckSeq)).toHaveLength(0);

    const id = await baru.append('catatan.uji', { sesudah: true });
    const { report } = await syncLedger(baru, shared, checkpoint);
    expect(report.pushed).toBe(1);

    // A third phone receives the whole stream, each note exactly once.
    const lain = phone('gawai-lain');
    await syncLedger(lain, shared, STARTING_CHECKPOINT);
    const ids = (await lain.events()).map((event) => event.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(ids).toContain(id);
  });

  it('adopsi tidak menghilangkan catatan yang sudah ditulis ponsel ini', async () => {
    const shared = new MemoryExchange();
    const mati = phone('gawai-mati');
    await seedLima(mati);
    await syncLedger(mati, shared, STARTING_CHECKPOINT);

    // The replacement wrote one note of its own before the old phone died.
    const baru = phone('gawai-baru');
    const milikBaru = await baru.append('catatan.uji', { milik: 'baru' });
    const checkpointBaru = (await syncLedger(baru, shared, STARTING_CHECKPOINT)).checkpoint;

    const { checkpoint } = await adoptDeviceIdentity(baru, shared, checkpointBaru, 'gawai-mati');

    const ids = (await baru.events()).map((event) => event.id);
    expect(ids).toContain(milikBaru);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    // Its own note reached the shared place before the name moved.
    expect(shared.ids()).toContain(milikBaru);
    expect(unsentEvents(await baru.events(), baru.deviceId, checkpoint.lastAckSeq)).toHaveLength(0);
  });
});
