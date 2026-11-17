import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import { KasirScreen } from '@/screens/Kasir';
import { app, mockPhone, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';
import type { Satuan, Shop } from '@/ledger/types';

/**
 * Stok awal — the guided pass the owner walks on the day the shop is set up.
 *
 * An opening count is a movement like any other: it is written as its own
 * `stock.opening` event, it shows in the history, and a varian the owner skips
 * stays "belum dihitung" rather than becoming zero (ticket 05's distinction).
 */

let mounted = false;

beforeEach(() => {
  resetPhone();
  mounted = false;
});

async function open() {
  if (mounted) screen.unmount();
  mounted = true;
  render(wrap(<StokScreen />));
  await waitReady(act);
  return app;
}

async function phoneShop(): Promise<Shop> {
  return phoneLedger().shop();
}

async function seedProduk(kategori: string, produk: string) {
  fireEvent.press(screen.getByTestId('tambah-barang'));
  fireEvent.changeText(screen.getByTestId('kategori-nama'), kategori);
  fireEvent.press(screen.getByTestId('simpan-kategori'));
  await act(async () => {});
  const kategoriId = (await phoneShop()).kategori[0].id;
  fireEvent.press(screen.getByTestId(`tambah-produk-${kategoriId}`));
  fireEvent.changeText(screen.getByTestId('produk-nama'), produk);
  fireEvent.press(screen.getByTestId('simpan-produk'));
  await act(async () => {});
  return (await phoneShop()).produk[0].id;
}

async function seedVarian(produkId: string, nama: string, satuan: Satuan = 'pcs') {
  fireEvent.press(screen.getByTestId(`tambah-varian-${produkId}`));
  fireEvent.changeText(screen.getByTestId('varian-nama'), nama);
  if (satuan !== 'pcs') fireEvent.press(screen.getByTestId(`satuan-${satuan}`));
  fireEvent.changeText(screen.getByTestId('varian-harga'), '1.000');
  fireEvent.press(screen.getByTestId('simpan-varian'));
  await act(async () => {});
  return (await phoneShop()).varian.find((entry) => entry.nama === nama)!.id;
}

/** The number a stock badge shows: the figure, before its state in words. */
function stringOf(testId: string): string {
  return flatten(screen.getByTestId(testId).props.children).replace(/(Belum dihitung|Hitung ulang|Habis|Rendah)$/, '');
}

function flatten(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'props' in (value as { props?: unknown })) {
    return flatten((value as { props: { children?: unknown } }).props.children);
  }
  return '';
}

async function storedEvents() {
  return mockPhone.store.readAll();
}

describe('Stok — stok awal saat menyiapkan toko', () => {
  it('mencatat hitungan awal sebagai peristiwa stock.opening, bukan angka diam-diam', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    fireEvent.press(screen.getByTestId('stok-awal'));
    fireEvent.changeText(screen.getByTestId(`stok-awal-${varianId}`), '12');
    fireEvent.press(screen.getByTestId('simpan-stok-awal'));
    await act(async () => {});

    expect(stringOf(`stok-angka-${varianId}`)).toBe('12');
    const opening = (await storedEvents()).filter((event) => event.type === 'stock.opening');
    expect(opening).toHaveLength(1);
    expect(opening[0].payload).toEqual({ varianId, qty: 12 });
  });

  it('membiarkan varian yang dilewati tetap belum dihitung, bukan nol', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    fireEvent.press(screen.getByTestId('stok-awal'));
    fireEvent.press(screen.getByTestId('lewati-stok-awal'));
    await act(async () => {});

    expect(app.stockOf(varianId)).toEqual({ kind: 'unknown' });
    expect(screen.getByText('Belum dihitung')).toBeTruthy();
    expect((await storedEvents()).filter((event) => event.type === 'stock.opening')).toHaveLength(0);
  });

  it('menampilkan stok awal di riwayat sebagai pergerakan yang bisa dibaca', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    fireEvent.press(screen.getByTestId('stok-awal'));
    fireEvent.changeText(screen.getByTestId(`stok-awal-${varianId}`), '12');
    fireEvent.press(screen.getByTestId('simpan-stok-awal'));
    await act(async () => {});

    fireEvent.press(screen.getByTestId(`riwayat-${varianId}`));
    await act(async () => {});

    expect(screen.getByText('Stok awal')).toBeTruthy();
    expect(screen.getByText('+12')).toBeTruthy();
  });

  it('tidak menawarkan hitungan awal lagi untuk varian yang sudah dihitung', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    fireEvent.press(screen.getByTestId('stok-awal'));
    fireEvent.changeText(screen.getByTestId(`stok-awal-${varianId}`), '12');
    fireEvent.press(screen.getByTestId('simpan-stok-awal'));
    await act(async () => {});

    fireEvent.press(screen.getByTestId('stok-awal'));
    await act(async () => {});

    expect(screen.queryByTestId(`stok-awal-${varianId}`)).toBeNull();
  });

  it('mengurangi stok awal dengan penjualan seperti pergerakan lain', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    fireEvent.press(screen.getByTestId('stok-awal'));
    fireEvent.changeText(screen.getByTestId(`stok-awal-${varianId}`), '10');
    fireEvent.press(screen.getByTestId('simpan-stok-awal'));
    await act(async () => {});

    screen.unmount();
    mounted = false;
    render(wrap(<KasirScreen />));
    await waitReady(act);
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    await act(async () => app.saveSale({ discount: { kind: 'none' }, tendered: 1_000_000 }, [{ varianId, qty: 3 }]));

    screen.unmount();
    mounted = false;
    await open();

    expect(stringOf(`stok-angka-${varianId}`)).toBe('7');
  });
});
