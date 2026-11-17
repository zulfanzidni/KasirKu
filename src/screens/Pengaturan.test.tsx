import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PengaturanScreen } from '@/screens/Pengaturan';
import { createLedger } from '@/ledger/ledger';
import type { Shop } from '@/ledger/types';
import { resetPhone, waitReady, wrap , storeView } from './testPhone';

/**
 * Pengaturan — the shop's name and closing line on every nota.
 *
 * The screen is driven the way the owner drives it: type the name, type the
 * closer, save. What matters is that the words reach the record, because the
 * other phone and a restored backup have to print the same nota.
 */

// Screen seeding runs a real ledger inside act; give it room when suites share the CPU.
jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

async function start() {
  render(wrap(<PengaturanScreen />));
  return waitReady(act);
}

describe('Pengaturan — the nota in the owner words', () => {
  it('saves the shop name, the detail line and the footer for the nota', async () => {
    await start();

    fireEvent(screen.getByTestId('toko-nama'), 'changeText', 'Warung Bu Sri');
    fireEvent(screen.getByTestId('toko-keterangan'), 'changeText', 'Jl. Melati 12');
    fireEvent(screen.getByTestId('toko-footer'), 'changeText', 'Terima kasih, datang lagi ya.');
    fireEvent.press(screen.getByTestId('simpan-pengaturan'));
    await act(async () => {});

    expect((await phoneShop()).receipt).toEqual({
      header: { nama: 'Warung Bu Sri', keterangan: 'Jl. Melati 12' },
      footer: 'Terima kasih, datang lagi ya.',
    });
    expect(screen.getByText('Pengaturan nota tersimpan.')).toBeTruthy();
  });

  it('shows the saved words when the settings are opened again', async () => {
    await start();
    fireEvent(screen.getByTestId('toko-nama'), 'changeText', 'Toko Melati');
    fireEvent.press(screen.getByTestId('simpan-pengaturan'));
    await act(async () => {});

    screen.unmount();
    await start();

    expect(screen.getByTestId('toko-nama').props.value).toBe('Toko Melati');
    expect((await phoneShop()).receipt.header.nama).toBe('Toko Melati');
  });

  it('refuses an empty shop name rather than printing a nota with no name', async () => {
    await start();
    fireEvent(screen.getByTestId('toko-nama'), 'changeText', '   ');

    fireEvent.press(screen.getByTestId('simpan-pengaturan'));
    await act(async () => {});

    expect(screen.getByText('Nama toko wajib diisi.')).toBeTruthy();
    expect((await phoneShop()).receiptAt).toBeNull();
  });
});

/** The shop read from the phone's storage by a fresh reader, not by the screen. */
async function phoneShop(): Promise<Shop> {
  return createLedger(
    {
      nextIdentity: () => store.nextIdentity(),
      append: (events) => store.append(events),
      readAll: () => store.readAll(),
      lastSeq: () => store.lastSeq(),
      replaceAll: (events, lastSeq) => store.replaceAll(events, lastSeq),
    },
    'gawai-uji',
  ).shop();
}
