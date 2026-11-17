import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import { PengaturanScreen } from '@/screens/Pengaturan';
import type { Shop } from '@/ledger/types';
import { app, mockShared, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Sinkron, driven the way the owner drives it: read when the phones last spoke,
 * press "Sinkron sekarang", and see what crossed.
 *
 * The shared place is the in-memory one two phones can use, so the screen path
 * (provider → checkpoint → ledger → store) is the real one. Nothing here opens a
 * socket: a test never needs the network, and neither does selling.
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
 * A shop with one counted item: katalog, a varian and ten on the shelf. Four
 * events, which is what the screen must report as unsent until a sync runs.
 */
async function seedEmpatCatatan() {
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
  return { kategoriId, produkId, varianId };
}

describe('Sinkron — apa yang dilihat pemilik', () => {
  it('menampilkan kapan terakhir sinkron dan berapa catatan yang belum terkirim', async () => {
    await openPengaturan();
    await seedEmpatCatatan();

    // Belum pernah menyentuh tempat bersama, jadi keempat catatan menunggu.
    expect(screen.getByTestId('sinkron-terakhir')).toHaveTextContent(/Belum pernah sinkron/);
    expect(screen.getByTestId('sinkron-belum-terkirim')).toHaveTextContent(/4 catatan belum terkirim/);

    fireEvent.press(screen.getByTestId('sinkron-sekarang'));
    await act(async () => {});

    // Sesudah berhasil: waktu yang bisa dibaca, dan tidak ada yang tertinggal.
    expect(screen.getByTestId('sinkron-terakhir')).toHaveTextContent(
      /Tersinkron terakhir \d{2}\/\d{2}\/\d{4} \d{2}\.\d{2}/,
    );
    expect(screen.getByTestId('sinkron-belum-terkirim')).toHaveTextContent(/Semua catatan sudah terkirim/);
    expect(screen.getByTestId('sinkron-pesan')).toHaveTextContent(/4 catatan terkirim/);
    expect(mockShared.ids()).toHaveLength(4);
  });

  it('mengingat kapan terakhir sinkron sesudah aplikasi dibuka lagi', async () => {
    await openPengaturan();
    await seedEmpatCatatan();
    fireEvent.press(screen.getByTestId('sinkron-sekarang'));
    await act(async () => {});
    const tercatat = screen.getByTestId('sinkron-terakhir').props.children;

    screen.unmount();
    await openPengaturan();

    // Waktu dan hitungannya dibaca dari ponsel, bukan dari ingatan layar.
    expect(screen.getByTestId('sinkron-terakhir')).toHaveTextContent(/Tersinkron terakhir \d{2}\/\d{2}\/\d{4}/);
    expect(screen.getByTestId('sinkron-belum-terkirim')).toHaveTextContent(/Semua catatan sudah terkirim/);
    expect(screen.getByTestId('sinkron-terakhir').props.children).toBe(tercatat);
  });

  it('sinkron yang gagal terlihat, dan catatan yang belum terkirim tetap utuh', async () => {    mockShared.offline = true;
    await openPengaturan();
    await seedEmpatCatatan();

    fireEvent.press(screen.getByTestId('sinkron-sekarang'));
    await act(async () => {});

    expect(screen.getByTestId('sinkron-galat')).toHaveTextContent(/Tidak ada sambungan/i);
    expect(screen.getByTestId('sinkron-galat')).toHaveTextContent(/tetap tersimpan di ponsel/i);
    // Waktu sinkron terakhir tidak berpindah, dan hitungannya tidak mengecil.
    expect(screen.getByTestId('sinkron-terakhir')).toHaveTextContent(/Belum pernah sinkron/);
    expect(screen.getByTestId('sinkron-belum-terkirim')).toHaveTextContent(/4 catatan belum terkirim/);
    expect(await phoneLedger().events()).toHaveLength(4);

    // Sambungan kembali: percobaan berikutnya mengirim catatan yang sama.
    mockShared.offline = false;
    fireEvent.press(screen.getByTestId('sinkron-sekarang'));
    await act(async () => {});

    expect(screen.queryByTestId('sinkron-galat')).toBeNull();
    expect(screen.getByTestId('sinkron-belum-terkirim')).toHaveTextContent(/Semua catatan sudah terkirim/);
    expect(mockShared.ids()).toHaveLength(4);
  });

  it('menjual tetap bisa tanpa sambungan sama sekali', async () => {
    mockShared.offline = true;

    render(wrap(<KasirScreen />));
    await waitReady(act);
    const varianId = await seedEmpatCatatan().then((ids) => ids.varianId);

    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId('simpan-penjualan'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('pelanggan-umum'));
    await act(async () => {});
    fireEvent(screen.getByTestId('uang-diterima'), 'changeText', '10.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran'));
    await act(async () => {});

    // Tersimpan tanpa menyentuh tempat bersama: satu penjualan, 7.000.
    expect(screen.getByText('Tersimpan')).toBeTruthy();
    const shop: Shop = await phoneLedger().shop();
    expect(shop.sales).toHaveLength(1);
    expect(shop.sales[0].total).toBe(7_000);
    expect(mockShared.ids()).toEqual([]);

    // Dan penjualan itu terlihat sebagai catatan yang masih menunggu dikirim.
    screen.unmount();
    await openPengaturan();
    expect(screen.getByTestId('sinkron-belum-terkirim')).toHaveTextContent(/5 catatan belum terkirim/);
  });
});
