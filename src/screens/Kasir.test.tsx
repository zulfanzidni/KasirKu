import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import type { Catalog } from '@/ledger/catalog';
import { createLedger } from '@/ledger/ledger';
import type { Shop } from '@/ledger/types';
import { app, mockPhone, resetPhone, waitReady, wrap } from './testPhone';

/**
 * The till, driven the way the owner drives it: tapping rows, choosing a
 * size, and saving. Seeding the shop goes through the same catalog the Stok
 * screen uses — inside act, because it writes the log the screen is reading.
 */

beforeEach(() => {
  resetPhone();
});

async function start() {
  render(wrap(<KasirScreen />));
  return waitReady(act);
}

/** Every catalog write lands inside act, so the screen re-renders as it would on the phone. */
function seeding(catalog: Catalog) {
  return {
    kategori: (nama: string) => act(async () => catalog.createKategori({ nama })),
    produk: (kategoriId: string, nama: string) => act(async () => catalog.createProduk({ kategoriId, nama })),
    varian: (input: Parameters<Catalog['createVarian']>[0]) => act(async () => catalog.createVarian(input)),
  };
}

async function seedIndomie() {
  const { catalog } = await start();
  const seed = seeding(catalog!);
  const kategoriId = await seed.kategori('Makanan');
  const produkId = await seed.produk(kategoriId, 'Indomie goreng');
  return seed.varian({
    produkId,
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
}

async function seedTepung() {
  const { catalog } = await start();
  const seed = seeding(catalog!);
  const kategoriId = await seed.kategori('Tepung');
  const produkId = await seed.produk(kategoriId, 'Tepung terigu');
  const kg1 = await seed.varian({
    produkId,
    nama: 'Tepung terigu 1 kg',
    kode: 'TLG-1',
    satuan: 'kg',
    jualBy: 'weight',
    harga: 13500,
  });
  const kg2 = await seed.varian({
    produkId,
    nama: 'Tepung terigu 2 kg',
    kode: 'TLG-2',
    satuan: 'kg',
    jualBy: 'weight',
    harga: 26000,
  });
  return { kg1, kg2 };
}

describe('Kasir', () => {
  it('opens on the till with Indonesian labels', async () => {
    await start();

    expect(screen.getByText('KasirKu')).toBeTruthy();
    expect(screen.getByTestId('cari-barang').props.placeholder).toBe('Cari nama barang…');
    expect(screen.getByText('Nota')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Bayar')).toBeTruthy();
  });

  it('adds exactly one on a tap, and three after three taps', async () => {
    const varianId = await seedIndomie();

    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    expect(screen.getByText('×3')).toBeTruthy();
    expect(app.cart).toEqual([expect.objectContaining({ varianId, qty: 3, jumlah: 10500 })]);
    expect(screen.getByText('10.500')).toBeTruthy();
  });

  it('opens the sizes of a multi-variant product before adding anything', async () => {
    const { kg1, kg2 } = await seedTepung();

    fireEvent.press(screen.getByTestId(`grid-${kg1}`));

    expect(screen.getByText('Pilih ukuran')).toBeTruthy();
    expect(screen.getByTestId(`pilih-${kg2}`)).toBeTruthy();
    expect(app.cart).toEqual([]);

    fireEvent.press(screen.getByTestId(`pilih-${kg2}`));

    expect(app.cart).toEqual([expect.objectContaining({ varianId: kg2, qty: 1, jumlah: 26000 })]);
  });

  it('offers 1/4, 1/2, 1 and 1.5 kg for a weight item and puts the chosen amount in the cart', async () => {
    const { catalog } = await start();
    const seed = seeding(catalog!);
    const kategoriId = await seed.kategori('Sembako');
    const produkId = await seed.produk(kategoriId, 'Gula pasir');
    const gula = await seed.varian({
      produkId,
      nama: 'Gula pasir',
      kode: 'GLA',
      satuan: 'kg',
      jualBy: 'weight',
      harga: 16000,
    });

    fireEvent.press(screen.getByTestId(`grid-${gula}`));

    for (const label of ['0,25 kg', '0,5 kg', '1 kg', '1,5 kg']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    fireEvent.press(screen.getByTestId(`pilih-${gula}-0.25`));

    expect(app.cart).toEqual([expect.objectContaining({ varianId: gula, qty: 0.25, jumlah: 4000 })]);
    expect(screen.getByText('×0,25')).toBeTruthy();
    expect(screen.getByText('4.000')).toBeTruthy();
  });

  it('narrows the grid to matching names as the search box is typed into', async () => {
    await seedIndomie();
    await seedTepung();

    fireEvent.changeText(screen.getByTestId('cari-barang'), 'indomie');

    expect(screen.getByText('Indomie goreng')).toBeTruthy();
    expect(screen.queryByText('Tepung terigu 1 kg')).toBeNull();
  });

  it('lets a quantity be edited and removed, with the total following', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    fireEvent.press(screen.getByLabelText('Buka nota'));
    fireEvent.changeText(screen.getByTestId(`jumlah-${varianId}`), '5');
    fireEvent(screen.getByTestId(`jumlah-${varianId}`), 'endEditing');

    expect(app.cart[0]).toMatchObject({ qty: 5, jumlah: 17500 });

    fireEvent.press(screen.getByTestId(`hapus-${varianId}`));

    expect(app.cart).toEqual([]);
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('cancels the whole nota only after a confirmation', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    fireEvent.press(screen.getByLabelText('Batalkan'));
    expect(screen.getByText('Kosongkan nota? Semua barang akan dibuang.')).toBeTruthy();
    expect(app.cart).toHaveLength(1);

    fireEvent.press(screen.getByTestId('kosongkan-nota'));
    expect(app.cart).toEqual([]);
  });

  it('records exactly one sale and shows the confirmation', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    fireEvent.press(screen.getByTestId('simpan-penjualan'));
    await act(async () => {});

    expect(screen.getByText('Tersimpan')).toBeTruthy();
    const shop = await phoneShop();
    expect(shop.sales).toHaveLength(1);
    expect(shop.sales[0].total).toBe(7000);
  });

  it('records exactly one sale when Bayar is tapped twice in one frame', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    const pay = screen.getByTestId('simpan-penjualan');
    // Two taps before the first save resolves: the guard, not the render, must stop the second.
    fireEvent.press(pay);
    fireEvent.press(pay);
    await act(async () => {});

    expect((await phoneShop()).sales).toHaveLength(1);
  });

  it('writes the sale from the nota, price included', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    fireEvent.press(screen.getByTestId('simpan-penjualan'));
    await act(async () => {});

    const sale = (await phoneShop()).sales[0];
    expect(sale.lines).toEqual([
      { varianId, nama: 'Indomie goreng', satuan: 'bungkus', qty: 2, harga: 3500, jumlah: 7000 },
    ]);
    expect(sale.total).toBe(7000);
  });

  it('still finds the sale after the app is closed and reopened', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId('simpan-penjualan'));
    await act(async () => {});
    expect((await phoneShop()).sales).toHaveLength(1);

    // A restart: a new provider over the same phone storage.
    screen.unmount();
    await start();

    expect((await phoneShop()).sales).toHaveLength(1);
    expect(app.shop.sales).toHaveLength(1);
  });

  it('tells the owner the previous nota was restored', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    await act(async () => {});

    screen.unmount();
    await start();

    expect(screen.getByTestId('nota-dipulihkan')).toBeTruthy();
    expect(app.cart).toEqual([expect.objectContaining({ varianId, qty: 1 })]);
  });

  it('sells three of a variant with two in stock without any error', async () => {
    const varianId = await seedIndomie();
    for (let i = 0; i < 3; i += 1) fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    fireEvent.press(screen.getByTestId('simpan-penjualan'));
    await act(async () => {});

    expect(screen.getByText('Tersimpan')).toBeTruthy();
    expect((await phoneShop()).sales[0].lines[0].qty).toBe(3);
  });
});

/** The shop read from the phone's storage by a fresh reader, not by the screen. */
async function phoneShop(): Promise<Shop> {
  const store = mockPhone.store;
  return createLedger(
    {
      nextIdentity: () => store.nextIdentity(),
      append: (events) => store.append(events),
      readAll: () => store.readAll(),
    },
    'gawai-uji',
  ).shop();
}
