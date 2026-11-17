import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PengaturanScreen } from '@/screens/Pengaturan';
import { createLedger, type Ledger } from '@/ledger/ledger';
import { MemoryStore } from '@/ledger/memoryStore';
import { STARTING_CHECKPOINT, syncLedger, type SyncCheckpoint } from '@/ledger/sync';
import { app, mockShared, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Adopsi identitas — the setting that continues a dead phone's stream.
 *
 * The screen is driven the way the owner drives it: read the warning, pick the
 * old phone's name, agree, and see the next note continue its numbering. The
 * refusal is driven the same way: the old phone is still sending, so the app
 * says no and changes nothing.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

async function openPengaturan() {
  render(wrap(<PengaturanScreen />));
  return waitReady(act);
}

/**
 * A second phone with five notes, already in the shared place. It is a real
 * ledger over its own store, so the replacement receives it the way it would
 * receive any other phone's history.
 */
async function seedPonselMati(): Promise<{ ledger: Ledger; checkpoint: SyncCheckpoint }> {
  const ledger = createLedger(new MemoryStore(), 'gawai-mati');
  for (let i = 0; i < 5; i += 1) {
    await ledger.append('catatan.uji', { i });
  }
  const { checkpoint } = await syncLedger(ledger, mockShared, STARTING_CHECKPOINT);
  return { ledger, checkpoint };
}

describe('Adopsi identitas — melanjutkan ponsel yang mati', () => {
  it('menjelaskan risikonya dan menunjuk cadangan sebagai jalan yang lebih aman', async () => {
    await openPengaturan();

    const penjelasan = screen.getByTestId('adopsi-penjelasan');
    // The trade-off is stated, not hidden behind a technical toggle.
    expect(penjelasan).toHaveTextContent(/dua ponsel/i);
    expect(penjelasan).toHaveTextContent(/catatan bisa hilang/i);
    // And the safer path is named.
    expect(penjelasan).toHaveTextContent(/cadangan/i);
    expect(penjelasan).toHaveTextContent(/lebih aman/i);
  });

  it('mengadopsi identitas ponsel lama dan melanjutkan nomor urutnya', async () => {
    await openPengaturan();
    await seedPonselMati();

    // The replacement receives the old phone's notes first.
    fireEvent.press(screen.getByTestId('sinkron-sekarang'));
    await act(async () => {});

    expect(screen.getByTestId('adopsi-gawai-mati')).toBeTruthy();
    fireEvent.press(screen.getByTestId('adopsi-gawai-mati'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('konfirmasi-adopsi'));
    await act(async () => {});

    expect(screen.getByTestId('adopsi-pesan')).toHaveTextContent(/gawai-mati/);
    expect(app.deviceId).toBe('gawai-mati');

    // The next note continues the old phone's numbering: 1..5 were used.
    const id = await act(async () => app.catalog!.createKategori({ nama: 'Sembako' }));
    const event = (await phoneLedger().events()).find((entry) => entry.id === id)!;
    expect(event.deviceId).toBe('gawai-mati');
    expect(event.seq).toBe(6);
  });

  it('menolak identitas yang catatannya masih berdatangan', async () => {
    await openPengaturan();
    const { ledger: mati, checkpoint } = await seedPonselMati();

    fireEvent.press(screen.getByTestId('sinkron-sekarang'));
    await act(async () => {});

    // The old phone is not dead after all: it writes one more note and sends it.
    await mati.append('catatan.uji', { masih: true });
    await syncLedger(mati, mockShared, checkpoint);

    fireEvent.press(screen.getByTestId('adopsi-gawai-mati'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('konfirmasi-adopsi'));
    await act(async () => {});

    expect(screen.getByTestId('adopsi-galat')).toHaveTextContent(/masih berdatangan/i);
    expect(app.deviceId).not.toBe('gawai-mati');
  });
});
