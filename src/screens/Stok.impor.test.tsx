import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import { KasirScreen } from '@/screens/Kasir';
import { app, mockImportFiles, mockPhone, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';
import type { Shop } from '@/ledger/types';

/**
 * Impor barang — the owner's spreadsheet, pasted or picked, previewed before a
 * single event is written.
 *
 * The import is two steps on purpose: a pure preview that says what would be
 * created and which rows are wrong, then a commit that writes the whole
 * catalog or nothing at all. A half-imported catalog is worse than none.
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

async function storedEvents() {
  return mockPhone.store.readAll();
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

/** Opens the import screen from the Barang header. */
async function openImpor() {
  fireEvent.press(screen.getByTestId('impor-barang'));
  await act(async () => {});
}

/** Pastes rows and asks for the preview. */
async function preview(rows: string) {
  fireEvent.changeText(screen.getByTestId('impor-teks'), rows);
  fireEvent.press(screen.getByTestId('impor-pratinjau'));
  await act(async () => {});
}

const HEADER = 'kategori\tproduk\tvarian\tsatuan\tharga\tkode\tstok awal';

const DUA_BARANG = [
  HEADER,
  'Sembako\tIndomie goreng\tIndomie goreng\tbungkus\t3.500\tIDM\t40',
  'Sembako\tTepung terigu\tTepung terigu 1 kg\tkg\t13.500\t\t10',
].join('\n');

describe('Impor — pratinjau sebelum menulis apa pun', () => {
  it('menampilkan kategori, produk dan varian yang akan dibuat, tanpa menulis apa pun', async () => {
    await open();
    await openImpor();
    await preview(DUA_BARANG);

    expect(screen.getByTestId('impor-kategori')).toHaveTextContent(/Sembako/);
    expect(screen.getByTestId('impor-produk')).toHaveTextContent(/Indomie goreng/);
    expect(screen.getByTestId('impor-produk')).toHaveTextContent(/Tepung terigu/);
    expect(screen.getByTestId('impor-varian')).toHaveTextContent(/Indomie goreng/);
    expect(screen.getByTestId('impor-varian')).toHaveTextContent(/Tepung terigu 1 kg/);

    // The preview is a question, not a write: the log is still empty.
    expect((await phoneShop()).varian).toHaveLength(0);
    expect((await storedEvents()).filter((event) => event.type === 'varian.created')).toHaveLength(0);
  });

  it('tidak menulis apa pun hanya karena barisnya sudah ditempel', async () => {
    await open();
    await openImpor();
    fireEvent.changeText(screen.getByTestId('impor-teks'), DUA_BARANG);
    await act(async () => {});

    expect((await phoneShop()).kategori).toHaveLength(0);
    expect((await phoneShop()).produk).toHaveLength(0);
    expect((await phoneShop()).varian).toHaveLength(0);
  });
});

describe('Impor — baris yang salah menghalangi impor', () => {
  it('menyebut barisnya saat harga bukan angka dan satuan kosong, lalu menolak menyimpan', async () => {
    await open();
    await openImpor();
    await preview(
      [
        HEADER,
        'Sembako\tIndomie goreng\tIndomie goreng\tbungkus\tseribu\t\t',
        'Sembako\tTepung terigu\tTepung terigu 1 kg\t\t13.500\t\t',
      ].join('\n'),
    );

    expect(screen.getByText('Baris 2: harga harus angka rupiah bulat.')).toBeTruthy();
    expect(screen.getByText('Baris 3: satuan wajib diisi (pcs, bungkus, kg, liter, sak).')).toBeTruthy();
    expect(screen.getByTestId('impor-simpan').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('impor-simpan'));
    await act(async () => {});

    expect((await phoneShop()).varian).toHaveLength(0);
    expect((await storedEvents()).filter((event) => event.type === 'varian.created')).toHaveLength(0);
  });

  it('menolak baris yang variannya sudah ada, supaya tidak ada dua barang bernama sama', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    fireEvent.press(screen.getByTestId(`tambah-varian-${produkId}`));
    fireEvent.changeText(screen.getByTestId('varian-nama'), 'Indomie goreng');
    fireEvent.changeText(screen.getByTestId('varian-harga'), '3.500');
    fireEvent.press(screen.getByTestId('simpan-varian'));
    await act(async () => {});

    await openImpor();
    await preview([HEADER, 'Sembako\tIndomie goreng\tIndomie goreng\tbungkus\t3.500\t\t'].join('\n'));

    expect(screen.getByText('Baris 2: varian Indomie goreng sudah ada di produk Indomie goreng.')).toBeTruthy();
    expect(screen.getByTestId('impor-simpan').props.accessibilityState.disabled).toBe(true);
  });
});

describe('Impor — menyimpan setelah pratinjau diterima', () => {
  it('membuat semua barang sekaligus, mencatat stok awalnya, dan menampilkannya di Kasir', async () => {
    await open();
    await openImpor();
    await preview(DUA_BARANG);

    fireEvent.press(screen.getByTestId('impor-simpan'));
    await act(async () => {});

    const shop = await phoneShop();
    expect(shop.kategori.map((entry) => entry.nama)).toEqual(['Sembako']);
    expect(shop.produk.map((entry) => entry.nama)).toEqual(['Indomie goreng', 'Tepung terigu']);
    expect(shop.varian.map((entry) => entry.nama)).toEqual(['Indomie goreng', 'Tepung terigu 1 kg']);
    expect(shop.varian.map((entry) => entry.satuan)).toEqual(['bungkus', 'kg']);
    expect(shop.varian.map((entry) => entry.harga)).toEqual([3500, 13500]);

    // The opening count in the sheet is a real event, not a stored column.
    const indomie = shop.varian.find((entry) => entry.nama === 'Indomie goreng')!;
    expect(app.stockOf(indomie.id)).toEqual({ kind: 'counted', qty: 40 });
    expect((await storedEvents()).filter((event) => event.type === 'stock.opening')).toHaveLength(2);

    // And the till can sell them.
    screen.unmount();
    mounted = false;
    render(wrap(<KasirScreen />));
    await waitReady(act);
    expect(screen.getByTestId(`grid-${indomie.id}`)).toBeTruthy();
  });

  it('memakai kategori dan produk yang sudah ada, bukan membuatnya dua kali', async () => {
    await open();
    await seedProduk('Sembako', 'Indomie goreng');

    await openImpor();
    await preview([HEADER, 'Sembako\tIndomie goreng\tIndomie goreng 2 bungkus\tbungkus\t7.000\t\t'].join('\n'));

    // Only the varian is new; the preview says so.
    expect(screen.queryByTestId('impor-kategori')).toBeNull();
    expect(screen.queryByTestId('impor-produk')).toBeNull();
    expect(screen.getByTestId('impor-varian')).toHaveTextContent(/Indomie goreng 2 bungkus/);

    fireEvent.press(screen.getByTestId('impor-simpan'));
    await act(async () => {});

    const shop = await phoneShop();
    expect(shop.kategori).toHaveLength(1);
    expect(shop.produk).toHaveLength(1);
    expect(shop.varian.map((entry) => entry.nama)).toEqual(['Indomie goreng 2 bungkus']);
  });
});

describe('Impor — dari berkas spreadsheet', () => {
  it('mengisi baris dari berkas yang dipilih pemilik, lalu bisa dipratinjau dan disimpan', async () => {
    mockImportFiles.picked = { name: 'barang.csv', text: DUA_BARANG };
    await open();
    await openImpor();

    fireEvent.press(screen.getByTestId('impor-berkas'));
    await act(async () => {});

    expect(screen.getByTestId('impor-teks').props.value).toBe(DUA_BARANG);

    fireEvent.press(screen.getByTestId('impor-pratinjau'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('impor-simpan'));
    await act(async () => {});

    expect((await phoneShop()).varian).toHaveLength(2);
  });

  it('tidak mengubah apa pun saat pemilik membatalkan pilih berkas', async () => {
    mockImportFiles.picked = null;
    await open();
    await openImpor();

    fireEvent.press(screen.getByTestId('impor-berkas'));
    await act(async () => {});

    expect(screen.getByTestId('impor-teks').props.value).toBe('');
    expect((await phoneShop()).varian).toHaveLength(0);
  });
});
