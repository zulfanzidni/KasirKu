import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import type { Catalog } from '@/ledger/catalog';
import type { Shop } from '@/ledger/types';
import { app, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * The till, driven the way the owner drives it: tapping tiles, choosing an
 * amount, and saving. Seeding the shop goes through the same catalog the Stok
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

async function seedIndomieDua() {
  const { catalog } = await start();
  const seed = seeding(catalog!);
  const kategoriId = await seed.kategori('Makanan');
  const produkId = await seed.produk(kategoriId, 'Indomie goreng');
  const biasa = await seed.varian({
    produkId,
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
  const jumbo = await seed.varian({
    produkId,
    nama: 'Indomie goreng jumbo',
    kode: 'IDM-J',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 5000,
  });
  return { biasa, jumbo };
}

async function seedGula() {
  const { catalog } = await start();
  const seed = seeding(catalog!);
  const kategoriId = await seed.kategori('Sembako');
  const produkId = await seed.produk(kategoriId, 'Gula pasir');
  return seed.varian({
    produkId,
    nama: 'Gula pasir',
    kode: 'GLA',
    satuan: 'kg',
    jualBy: 'weight',
    harga: 16000,
  });
}

describe('Kasir', () => {
  it('opens on the till with Indonesian labels', async () => {
    await start();

    expect(screen.getByText('KasirKu')).toBeTruthy();
    expect(screen.getByTestId('cari-barang').props.placeholder).toBe('Cari nama barang…');
    expect(screen.getByText('Nota kosong')).toBeTruthy();
    expect(screen.getByText('Kasir')).toBeTruthy();
    expect(screen.getByText('Bayar')).toBeTruthy();
  });

  it('adds exactly one on a tap, and three after three taps', async () => {
    const varianId = await seedIndomie();

    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    expect(screen.getByTestId(`qty-${varianId}`)).toHaveTextContent("3");
    expect(app.cart).toEqual([expect.objectContaining({ varianId, qty: 3, jumlah: 10500 })]);
    expect(screen.getByText('10.500')).toBeTruthy();
  });

  it('adds the varian whose tile was tapped, with no size reveal', async () => {
    const { jumbo } = await seedIndomieDua();

    fireEvent.press(screen.getByTestId(`grid-${jumbo}`));

    expect(app.cart).toEqual([expect.objectContaining({ varianId: jumbo, qty: 1, jumlah: 5000 })]);
    expect(screen.queryByText('Pilih ukuran')).toBeNull();
    expect(screen.queryByText('Berapa kg?')).toBeNull();
  });

  it('offers 1/4, 1/2, 1 and 1.5 kg for a weight item and puts the chosen amount in the cart', async () => {
    const gula = await seedGula();

    fireEvent.press(screen.getByTestId(`grid-${gula}`));

    for (const label of ['0,25 kg', '0,5 kg', '1 kg', '1,5 kg']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    fireEvent.press(screen.getByTestId(`pilih-${gula}-0.25`));

    expect(app.cart).toEqual([expect.objectContaining({ varianId: gula, qty: 0.25, jumlah: 4000 })]);
    expect(screen.getByTestId(`qty-${gula}`)).toHaveTextContent("0,25");
    expect(screen.getByText('4.000')).toBeTruthy();
  });

  it('narrows the grid to matching names as the search box is typed into', async () => {
    await seedIndomie();
    await seedGula();

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

    await pay();
    await act(async () => {});

    expect(screen.getByText('Struk')).toBeTruthy();
    const shop = await phoneShop();
    expect(shop.sales).toHaveLength(1);
    expect(shop.sales[0].total).toBe(7000);
  });

  it('records exactly one sale when Simpan & nota is tapped twice quickly', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    await offerPayment();
    const before = (await phoneShop()).sales.length;
    fireEvent.press(screen.getByTestId('simpan-pembayaran'));
    // Let the first press render. The button must be out of reach now — the
    // render, not a fired event, is what stops the second tap here.
    await act(async () => {});
    // Either the save is still running (button disabled and saying so) or it
    // has finished — never a second sale either way.
    const simpan = screen.queryByTestId('simpan-pembayaran');
    if (simpan) {
      expect(simpan.props.accessibilityState).toMatchObject({ disabled: true });
      expect(screen.getByText('Menyimpan…')).toBeTruthy();
      // A second tap that lands anyway must be refused by the in-flight guard.
      fireEvent.press(simpan);
    }
    await settleSale();

    expect((await phoneShop()).sales).toHaveLength(before + 1);
    expect(app.shop.sales).toHaveLength(before + 1);
  });

  it('starts no second write while the first is still in flight', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    // Two entrances into the save in the same tick, before either can render:
    // this is the race the button's disabled state cannot cover.
    const first = app.saveSale({ discount: { kind: 'none' }, tendered: 1_000_000 });
    const second = (): unknown => app.saveSale({ discount: { kind: 'none' }, tendered: 1_000_000 });
    expect(second()).toBeNull();
    expect(typeof (await first)).toBe('string');

    expect((await phoneShop()).sales).toHaveLength(1);
  });

  it('writes the sale from the nota, price included', async () => {
    const varianId = await seedIndomie();
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    await pay();
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
    await pay();
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

    await pay();
    await act(async () => {});

    expect(screen.getByText('Struk')).toBeTruthy();
    expect((await phoneShop()).sales[0].lines[0].qty).toBe(3);
  });
});

/** Bayar opens the customer step, then the payment step; nothing is written until the money is in. */
async function offerPayment() {
  fireEvent.press(screen.getByTestId('simpan-penjualan'));
  await act(async () => {});
  fireEvent.press(screen.getByTestId('pelanggan-umum'));
  await act(async () => {});
  fillTunai();
}

/**
 * Money on the counter: the owner typing the cash in the payment step. The
 * field defaults to nothing, so an empty field is an unpaid sale, which the
 * step refuses to save.
 */
function fillTunai() {
  fireEvent(screen.getByTestId('uang-diterima'), 'changeText', '1.000.000');
}

/**
 * Waits, inside act, until a save has finished — the log holds a sale and the
 * provider has folded it. Returns at once past the timeout so a test that
 * expects no sale still ends.
 */
async function settleSale() {
  for (let i = 0; i < 50; i += 1) {
    if ((await phoneShop()).sales.length > 0 && app.shop.sales.length > 0) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

/** The whole way the owner saves a sale: Bayar, then Simpan & nota. */
async function pay() {
  await offerPayment();
  fireEvent.press(screen.getByTestId('simpan-pembayaran'));
  await act(async () => {});
}

/** The shop read from the phone's storage by a fresh reader, not by the screen. */
async function phoneShop(): Promise<Shop> {
  return phoneLedger().shop();
}
