import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import { KasirScreen } from '@/screens/Kasir';
import { ReceiptScreen } from '@/screens/Receipt';
import { app, phoneLedger, resetPhone, wrap } from './testPhone';
import { sumSales } from '@/ledger/events';
import type { Shop } from '@/ledger/types';

/**
 * Editing the product list the way the owner does: renaming a kategori,
 * moving a produk to another kategori, and archiving either. Every assertion
 * is what the screen shows, and the past is checked against the nota the
 * customer already took away.
 */

let rendered = false;

beforeEach(() => {
  resetPhone();
  rendered = false;
});

async function open() {
  if (rendered) screen.unmount();
  rendered = true;
  render(wrap(<StokScreen />));
  for (let i = 0; i < 100 && !app?.ready && !app?.error; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  await act(async () => {});
  if (app.error) throw new Error('Catatan gagal dibuka: ' + app.error);
  return app;
}

/** Opens the till on the same phone, after the list has been edited. */
async function openKasir() {
  if (rendered) screen.unmount();
  rendered = true;
  render(wrap(<KasirScreen />));
  for (let i = 0; i < 100 && !app?.ready && !app?.error; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  await act(async () => {});
  if (app.error) throw new Error('Catatan gagal dibuka: ' + app.error);
  return app;
}

/** The shop as another reader sees it, straight off the phone's storage. */
async function phoneShop(): Promise<Shop> {
  return phoneLedger().shop();
}

async function seedKategori(nama: string) {
  fireEvent.press(screen.getByTestId('tambah-barang'));
  fireEvent.changeText(screen.getByTestId('kategori-nama'), nama);
  fireEvent.press(screen.getByTestId('simpan-kategori'));
  await act(async () => {});
  return (await phoneShop()).kategori.find((entry) => entry.nama === nama)!.id;
}

async function seedProduk(kategoriId: string, nama: string) {
  fireEvent.press(screen.getByTestId(`tambah-produk-${kategoriId}`));
  fireEvent.changeText(screen.getByTestId('produk-nama'), nama);
  fireEvent.press(screen.getByTestId('simpan-produk'));
  await act(async () => {});
  return (await phoneShop()).produk.find((entry) => entry.nama === nama)!.id;
}

async function seedVarian(produkId: string, nama: string, harga = '1.000') {
  fireEvent.press(screen.getByTestId(`tambah-varian-${produkId}`));
  fireEvent.changeText(screen.getByTestId('varian-nama'), nama);
  fireEvent.changeText(screen.getByTestId('varian-harga'), harga);
  fireEvent.press(screen.getByTestId('simpan-varian'));
  await act(async () => {});
  return (await phoneShop()).varian.find((entry) => entry.nama === nama)!.id;
}

/** Renames a kategori through its edit sheet. */
async function renameKategori(kategoriId: string, nama: string) {
  fireEvent.press(screen.getByTestId(`ubah-kategori-${kategoriId}`));
  fireEvent.changeText(screen.getByTestId('kategori-nama-ubah'), nama);
  fireEvent.press(screen.getByTestId('simpan-kategori-ubah'));
  await act(async () => {});
}

/** The owner counting the shelf: open the varian, type the number, say why, save. */
async function count(varianId: string, counted: string, reason: string) {
  fireEvent.press(screen.getByTestId(`hitung-${varianId}`));
  fireEvent.changeText(screen.getByTestId('hitung-jumlah'), counted);
  fireEvent.changeText(screen.getByTestId('hitung-alasan'), reason);
  fireEvent.press(screen.getByTestId('simpan-hitung'));
  await act(async () => {});
}

describe('Stok — renaming a kategori', () => {
  it('renames the kategori and leaves its produk names untouched', async () => {
    await open();
    const kategoriId = await seedKategori('Tepung');
    await seedProduk(kategoriId, 'Tepung terigu');

    await renameKategori(kategoriId, 'Sembako');

    expect(screen.getByText('Sembako')).toBeTruthy();
    expect(screen.queryByText('Tepung')).toBeNull();
    // The produk is still there, under its own name.
    expect(screen.getByText('Tepung terigu')).toBeTruthy();
    expect((await phoneShop()).produk[0].nama).toBe('Tepung terigu');
  });
});

describe('Stok — archiving a kategori', () => {  it('leaves its produk in place, uncategorised, rather than deleting them', async () => {
    await open();
    const kategoriId = await seedKategori('Tepung');
    await seedProduk(kategoriId, 'Tepung terigu');

    fireEvent.press(screen.getByTestId(`ubah-kategori-${kategoriId}`));
    fireEvent.press(screen.getByTestId('arsipkan-kategori'));
    await act(async () => {});

    // The kategori is gone from the working list…
    expect(screen.queryByText('Tepung')).toBeNull();
    // …but its produk is still there, now under "Tanpa kategori".
    expect(screen.getByText('Tanpa kategori')).toBeTruthy();
    expect(screen.getByText('Tepung terigu')).toBeTruthy();
    expect((await phoneShop()).produk[0]).toEqual(
      expect.objectContaining({ nama: 'Tepung terigu', kategoriId: null }),
    );
  });
});

describe('Stok — moving a produk', () => {
  it('moves it to another kategori without renaming it', async () => {
    await open();
    const tepung = await seedKategori('Tepung');
    const sembako = await seedKategori('Sembako');
    const produkId = await seedProduk(tepung, 'Tepung terigu');

    fireEvent.press(screen.getByTestId(`ubah-produk-${produkId}`));
    fireEvent.press(screen.getByTestId(`pindah-kategori-${sembako}`));
    fireEvent.press(screen.getByTestId('simpan-produk-ubah'));
    await act(async () => {});

    expect((await phoneShop()).produk[0]).toEqual(
      expect.objectContaining({ nama: 'Tepung terigu', kategoriId: sembako }),
    );

    // Proof at the screen: archive the old kategori. The produk must stay
    // under Sembako, not fall into "Tanpa kategori".
    fireEvent.press(screen.getByTestId(`ubah-kategori-${tepung}`));
    fireEvent.press(screen.getByTestId('arsipkan-kategori'));
    await act(async () => {});

    expect(screen.queryByText('Tanpa kategori')).toBeNull();
    expect(screen.getByText('Sembako')).toBeTruthy();
    expect(screen.getByText('Tepung terigu')).toBeTruthy();
  });
});

describe('Stok — archiving a produk', () => {
  it('removes it from the Kasir grid while the log keeps it', async () => {
    await open();
    const kategoriId = await seedKategori('Sembako');
    const produkId = await seedProduk(kategoriId, 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');
    await count(varianId, '7', 'Hitung rak');

    fireEvent.press(screen.getByTestId(`ubah-produk-${produkId}`));
    fireEvent.press(screen.getByTestId('arsipkan-produk'));
    await act(async () => {});

    // Gone from the working list…
    expect(screen.queryByText('Indomie goreng')).toBeNull();

    // …and gone from the till.
    await openKasir();
    expect(screen.queryByTestId(`grid-${varianId}`)).toBeNull();

    // The log still holds the varian, so history can resolve it by id, and
    // archiving moved no derived stock figure.
    expect((await phoneShop()).varian).toHaveLength(1);
    expect(app.stockOf(varianId)).toEqual({ kind: 'counted', qty: 7 });
  });
});

describe('Stok — the past is immutable', () => {
  it('keeps a past receipt and its total exactly as sold after rename, move and archive', async () => {
    await open();
    const tepung = await seedKategori('Tepung');
    const sembako = await seedKategori('Sembako');
    const produkId = await seedProduk(tepung, 'Tepung terigu');
    const varianId = await seedVarian(produkId, 'Tepung terigu 1 kg', '13.500');

    // Sell one at the till, the way the cashier does.
    await openKasir();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    await act(async () => app.saveSale({ discount: { kind: 'none' }, tendered: 20_000 }, [{ varianId, qty: 1 }]));

    const sold = await phoneShop();
    const sale = sold.sales[0];
    expect(sale.lines[0]).toEqual(expect.objectContaining({ nama: 'Tepung terigu 1 kg', harga: 13_500 }));
    expect(sumSales(sold.sales)).toBe(13_500);

    // Rename the kategori, move the produk, then archive it.
    await open();
    await renameKategori(tepung, 'Sembako lama');
    fireEvent.press(screen.getByTestId(`ubah-produk-${produkId}`));
    fireEvent.press(screen.getByTestId(`pindah-kategori-${sembako}`));
    fireEvent.press(screen.getByTestId('simpan-produk-ubah'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId(`ubah-produk-${produkId}`));
    fireEvent.press(screen.getByTestId('arsipkan-produk'));
    await act(async () => {});

    const after = await phoneShop();
    // The sale is untouched: same line, same price, same total.
    expect(after.sales[0].lines).toEqual(sale.lines);
    expect(sumSales(after.sales)).toBe(13_500);

    // And the nota the customer took away still reads the same.
    if (rendered) screen.unmount();
    rendered = true;
    render(
      wrap(
        <ReceiptScreen sale={after.sales[0]} shop={after.receipt} onNewSale={() => {}} onShare={() => {}} />,
      ),
    );
    await act(async () => {});
    expect(screen.getByText('Tepung terigu 1 kg')).toBeTruthy();
    expect(screen.getByTestId('nota-gross')).toHaveTextContent('13.500');
  });
});
