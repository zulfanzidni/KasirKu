import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PengaturanScreen } from '@/screens/Pengaturan';
import { ReceiptScreen } from '@/screens/Receipt';
import { StokScreen } from '@/screens/Stok';
import { parseBackup, serializeBackup } from '@/ledger/backup';
import { createLedger } from '@/ledger/ledger';
import { MemoryStore } from '@/ledger/memoryStore';
import type { Sale } from '@/ledger/types';
import { app, mockBackupFiles, mockPhone, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Cadangan, driven the way the owner drives it: open Pengaturan, press Ekspor,
 * then on a new phone press Pulihkan and pick the file.
 *
 * The expectations are the shop's own figures — how many Indomie are left, what
 * the nota said, whose phone wrote it. Nothing here looks at SQLite or at a
 * backup's internal shape beyond the file the app itself produced.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

async function openPengaturan() {
  render(wrap(<PengaturanScreen />));
  return waitReady(act);
}

/** A shop that has counted ten Indomie and sold two: stock 8, one nota. */
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
  const saleId = await act(async () =>
    app.saveSale({ discount: { kind: 'none' }, tendered: 10_000 }, [{ varianId, qty: 2 }]),
  );
  return { kategoriId, produkId, varianId, saleId: saleId! };
}

describe('Cadangan — membawa riwayat keluar dari ponsel', () => {
  it('menulis seluruh riwayat ke satu berkas dan menawarkannya untuk dibagikan', async () => {
    await openPengaturan();
    await seedPenjualan();
    const deviceId = mockPhone.kv.get('device_id');
    expect(deviceId).toBeTruthy();

    fireEvent.press(screen.getByTestId('ekspor-cadangan'));
    await act(async () => {});

    expect(mockBackupFiles.saved).toHaveLength(1);
    const { name, uri, text } = mockBackupFiles.saved[0];
    // The owner can tell two backups apart on the phone.
    expect(name).toMatch(/^cadangan-kasirku-\d{8}-\d{4}\.json$/);
    const backup = parseBackup(text);
    expect(backup.deviceId).toBe(deviceId);
    expect(backup.events.filter((event) => event.type === 'sale.completed')).toHaveLength(1);
    expect(backup.events.filter((event) => event.type === 'stock.adjusted')).toHaveLength(1);
    // The file goes to the share sheet, where "save to phone" also lives.
    expect(mockBackupFiles.shared).toEqual([{ uri, mimeType: 'application/json' }]);
    expect(screen.getByTestId('cadangan-pesan')).toHaveTextContent(/Cadangan dibuat/i);
  });

  it('still writes the file when this phone cannot share, and says where it is', async () => {
    mockBackupFiles.canShare = false;
    await openPengaturan();
    await seedPenjualan();

    fireEvent.press(screen.getByTestId('ekspor-cadangan'));
    await act(async () => {});

    expect(mockBackupFiles.saved).toHaveLength(1);
    expect(mockBackupFiles.shared).toEqual([]);
    expect(screen.getByTestId('cadangan-pesan')).toHaveTextContent(/di ponsel ini/i);
  });
});

describe('Cadangan — memulihkan di ponsel baru', () => {
  it('memulihkan stok, total dan nomor nota yang sama, dengan identitas gawai aslinya', async () => {
    const asal = await backupDariPonselLain();
    resetPhone();
    mockBackupFiles.picked = { name: 'cadangan-kasirku-20261117-0900.json', text: asal.text };

    await openPengaturan();
    fireEvent.press(screen.getByTestId('pulihkan-cadangan'));
    await act(async () => {});

    // A freshly installed app holds no sales, so nothing is at risk to warn about.
    expect(screen.queryByTestId('peringatan-pulihkan')).toBeNull();
    expect(screen.getByTestId('cadangan-pesan')).toHaveTextContent(/Cadangan dipulihkan/i);
    // The recovered shop is still the old phone: unsent events can continue.
    expect(mockPhone.kv.get('device_id')).toBe('gawai-ibu');

    // The stock the owner sees is the exporting phone's count: 10 counted − 2 sold.
    screen.unmount();
    render(wrap(<StokScreen />));
    await waitReady(act);
    expect(screen.getByTestId(`stok-baris-${asal.varianId}`).props.accessibilityLabel).toBe('Indomie goreng, Stok 8');

    // The restored nota shows the same number and the same total as the paper
    // the exporting phone wrote.
    screen.unmount();
    render(
      wrap(
        <ReceiptScreen
          sale={app.shop.sales[0]}
          shop={app.shop.receipt}
          onNewSale={() => {}}
          onShare={() => {}}
        />,
      ),
    );
    await waitReady(act);
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(`No. ${asal.sale.number}`);
    expect(screen.getByTestId('nota-total')).toHaveTextContent('Total7.000');
  });
});

describe('Cadangan — mengganti riwayat yang sudah ada', () => {
  it('memperingatkan sebelum mengganti dan bisa dibatalkan tanpa mengubah apa pun', async () => {
    const asal = await backupDariPonselLain();
    resetPhone();
    await openPengaturan();
    const sendiri = await seedPenjualan();
    const gawaiSendiri = mockPhone.kv.get('device_id');
    mockBackupFiles.picked = { name: 'cadangan-lain.json', text: asal.text };

    fireEvent.press(screen.getByTestId('pulihkan-cadangan'));
    await act(async () => {});

    const peringatan = screen.getByTestId('peringatan-pulihkan');
    expect(peringatan).toHaveTextContent(/sudah berisi riwayat/i);
    expect(peringatan).toHaveTextContent(/termasuk penjualan yang sudah tercatat/i);
    expect(peringatan).toHaveTextContent(/MENGGANTI seluruh riwayat/i);
    expect(peringatan).toHaveTextContent(/tidak bisa dikembalikan/i);

    fireEvent.press(screen.getByTestId('batal-pulihkan'));
    await act(async () => {});

    expect(screen.queryByTestId('peringatan-pulihkan')).toBeNull();
    // Cancelling is a no-op: the phone's own sale is still the only one, and it
    // still speaks in its own name.
    const shop = await phoneLedger().shop();
    expect(shop.sales.map((sale) => sale.id)).toEqual([sendiri.saleId]);
    expect(mockPhone.kv.get('device_id')).toBe(gawaiSendiri);
  });

  it('mengganti riwayat hanya setelah pemilik menyetujuinya', async () => {
    const asal = await backupDariPonselLain();
    resetPhone();
    await openPengaturan();
    await seedPenjualan();
    mockBackupFiles.picked = { name: 'cadangan-lain.json', text: asal.text };

    fireEvent.press(screen.getByTestId('pulihkan-cadangan'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('konfirmasi-pulihkan'));
    await act(async () => {});

    expect(screen.getByTestId('cadangan-pesan')).toHaveTextContent(/Cadangan dipulihkan/i);
    expect(mockPhone.kv.get('device_id')).toBe('gawai-ibu');
    const shop = await phoneLedger().shop();
    expect(shop.sales.map((sale) => sale.id)).toEqual([asal.sale.id]);
    expect(shop.sales.map((sale) => sale.number)).toEqual([asal.sale.number]);
  });

  it('menolak berkas lain dengan kalimat jelas dan tidak menyentuh riwayat', async () => {
    await openPengaturan();
    const sendiri = await seedPenjualan();
    mockBackupFiles.picked = { name: 'catatan.txt', text: 'bukan cadangan sama sekali' };

    fireEvent.press(screen.getByTestId('pulihkan-cadangan'));
    await act(async () => {});

    expect(screen.getByTestId('cadangan-galat')).toHaveTextContent('Berkas ini bukan cadangan KasirKu.');
    expect((await phoneLedger().shop()).sales.map((sale) => sale.id)).toEqual([sendiri.saleId]);
  });

  it('tidak mengubah apa pun saat pemilik membatalkan pilih berkas', async () => {
    await openPengaturan();
    const sendiri = await seedPenjualan();
    mockBackupFiles.picked = null;

    fireEvent.press(screen.getByTestId('pulihkan-cadangan'));
    await act(async () => {});

    expect(screen.queryByTestId('cadangan-pesan')).toBeNull();
    expect(screen.queryByTestId('cadangan-galat')).toBeNull();
    expect((await phoneLedger().shop()).sales.map((sale) => sale.id)).toEqual([sendiri.saleId]);
  });
});

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
  const saleId = await ibu.recordSale([{ varianId, qty: 2 }], { discount: { kind: 'none' }, tendered: 10_000 });
  const shop = await ibu.shop();
  const sale = shop.sales.find((entry) => entry.id === saleId) as Sale;
  return { text: serializeBackup(await ibu.backup()), varianId, sale };
}
