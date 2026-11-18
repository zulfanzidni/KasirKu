import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { PengaturanScreen } from '@/screens/Pengaturan';
import { serializeBackup } from '@/ledger/backup';
import { createLedger } from '@/ledger/ledger';
import { MemoryStore } from '@/ledger/memoryStore';
import type { Shop } from '@/ledger/types';
import {
  app,
  PHONE_PORTRAIT,
  mockBackupFiles,
  mockPhone,
  phoneLedger,
  resetPhone,
  setWindow,
  waitReady,
  wrap,
} from './testPhone';

/**
 * Pengaturan in the other shape. Landscape lays the same four sections in two
 * columns, so the shop's name and its backup are visible at once; portrait
 * stays the single stack it has always been. The restore warning is a step in
 * the flow, not a place on the page, so it must still stand between the owner
 * and replacing the history.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
  setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
});

afterAll(() => setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height));

async function start({ wide = true }: { wide?: boolean } = {}) {
  if (wide) setWindow(891, 411);
  render(wrap(<PengaturanScreen />));
  return waitReady(act);
}

/** A shop that has sold something, so a restore has history to replace. */
async function seedPenjualan() {
  const kategoriId = await act(async () => app.catalog!.createKategori({ nama: 'Sembako' }));
  const produkId = await act(async () => app.catalog!.createProduk({ kategoriId, nama: 'Indomie goreng' }));
  const varianId = await act(async () =>
    app.catalog!.createVarian({
      produkId,
      nama: 'Indomie goreng',
      kode: 'IDM',
      satuan: 'bungkus',
      jualBy: 'unit',
      harga: 3500,
    }),
  );
  await act(async () => {
    await app.adjustStock({ varianId, counted: 10, reason: 'Hitung gudang' });
  });
  await act(async () => app.saveSale({ discount: { kind: 'none' }, tendered: 10_000 }, [{ varianId, qty: 2 }]));
}

/** The file another phone would have written: history, identity and tail. */
async function backupDariPonselLain() {
  const ibu = createLedger(new MemoryStore(), 'gawai-ibu');
  const kategoriId = await ibu.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ibu.append('produk.created', { kategoriId, nama: 'Indomie goreng' });
  const varianId = await ibu.append('varian.created', {
    produkId,
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
  await ibu.adjustStock({ varianId, counted: 10, reason: 'Hitung gudang' });
  await ibu.recordSale([{ varianId, qty: 2 }], { discount: { kind: 'none' }, tendered: 10_000 });
  return { text: serializeBackup(await ibu.backup()) };
}

describe('Pengaturan - landscape', () => {
  it('lays the same sections in two columns, the nota beside the backup', async () => {
    await start();

    const kiri = screen.getByTestId('pengaturan-kolom-kiri');
    const kanan = screen.getByTestId('pengaturan-kolom-kanan');

    // The name the shop prints and the backup that saves it are both on screen.
    expect(within(kiri).getByTestId('sinkron-status')).toBeTruthy();
    expect(within(kiri).getByTestId('toko-nama')).toBeTruthy();
    expect(within(kanan).getByTestId('ekspor-cadangan')).toBeTruthy();
    expect(within(kanan).getByTestId('adopsi-sekarang')).toBeTruthy();

    // Same sections, same words.
    for (const judul of ['Sinkron', 'Nota', 'Cadangan', 'Identitas ponsel']) {
      expect(screen.getByText(judul)).toBeTruthy();
    }
  });

  it('keeps the nota form usable in a half-width column', async () => {
    await start();

    fireEvent(screen.getByTestId('toko-nama'), 'changeText', 'Warung Bu Sri');
    fireEvent(screen.getByTestId('toko-footer'), 'changeText', 'Terima kasih.');
    fireEvent.press(screen.getByTestId('simpan-pengaturan'));
    await act(async () => {});

    const shop: Shop = await phoneLedger().shop();
    expect(shop.receipt.header.nama).toBe('Warung Bu Sri');
    expect(shop.receipt.footer).toBe('Terima kasih.');
    expect(screen.getByText('Pengaturan nota tersimpan.')).toBeTruthy();
  });

  it('warns before replacing history, in landscape too', async () => {
    const asal = await backupDariPonselLain();
    resetPhone();
    await start();
    await seedPenjualan();
    const gawaiSendiri = mockPhone.kv.get('device_id');
    mockBackupFiles.picked = { name: 'cadangan-lain.json', text: asal.text };

    fireEvent.press(screen.getByTestId('pulihkan-cadangan'));
    await act(async () => {});

    // The warning stands between the owner and the destructive button: the
    // button is inside the warning, and nothing has been replaced yet.
    const peringatan = screen.getByTestId('peringatan-pulihkan');
    expect(peringatan).toHaveTextContent(/sudah berisi riwayat/i);
    expect(peringatan).toHaveTextContent(/MENGGANTI seluruh riwayat/i);
    expect(within(peringatan).getByTestId('konfirmasi-pulihkan')).toBeTruthy();
    expect(screen.queryByTestId('cadangan-pesan')).toBeNull();
    expect(mockPhone.kv.get('device_id')).toBe(gawaiSendiri);
    expect((await phoneLedger().shop()).sales).toHaveLength(1);

    fireEvent.press(within(peringatan).getByTestId('konfirmasi-pulihkan'));
    await act(async () => {});

    expect(screen.getByTestId('cadangan-pesan')).toHaveTextContent(/Cadangan dipulihkan/i);
    expect(mockPhone.kv.get('device_id')).toBe('gawai-ibu');
  });

  it('leaves portrait as the one column it has always been', async () => {
    await start({ wide: false });

    expect(screen.queryByTestId('pengaturan-kolom-kiri')).toBeNull();
    expect(screen.queryByTestId('pengaturan-kolom-kanan')).toBeNull();
    expect(screen.getByTestId('sinkron-status')).toBeTruthy();
    expect(screen.getByTestId('toko-nama')).toBeTruthy();
    expect(screen.getByTestId('ekspor-cadangan')).toBeTruthy();
    expect(screen.getByTestId('adopsi-sekarang')).toBeTruthy();
  });
});
