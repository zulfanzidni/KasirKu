import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import type { Catalog } from '@/ledger/catalog';
import { app, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Hutang at the counter, driven the way the owner drives it: ring up a basket,
 * press Bayar, choose the customer, then count the cash. The customer is a
 * step of its own, before the money — never an error after it.
 *
 * Indomie 3.500 and two Tepung 1 kg at 13.500 make a gross of 30.500.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

async function start() {
  render(wrap(<KasirScreen />));
  return waitReady(act);
}

function seeding(catalog: Catalog) {
  return {
    kategori: (nama: string) => act(async () => catalog.createKategori({ nama })),
    produk: (kategoriId: string, nama: string) => act(async () => catalog.createProduk({ kategoriId, nama })),
    varian: (input: Parameters<Catalog['createVarian']>[0]) => act(async () => catalog.createVarian(input)),
  };
}

/** One Indomie (3.500) and two Tepung 1 kg (2 × 13.500): gross 30.500. */
async function seedBasket() {
  const { catalog } = await start();
  const seed = seeding(catalog!);
  const makanan = await seed.kategori('Makanan');
  const indomieProduk = await seed.produk(makanan, 'Indomie goreng');
  const indomie = await seed.varian({
    produkId: indomieProduk,
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
  const sembako = await seed.kategori('Sembako');
  const tepungProduk = await seed.produk(sembako, 'Tepung terigu');
  const tepung = await seed.varian({
    produkId: tepungProduk,
    nama: 'Tepung terigu 1 kg',
    kode: 'TLG-1',
    satuan: 'kg',
    jualBy: 'weight',
    harga: 13500,
  });

  fireEvent.press(screen.getByTestId(`grid-${indomie}`));
  fireEvent.press(screen.getByTestId(`grid-${tepung}`));
  fireEvent.press(screen.getByTestId('pilih-' + tepung + '-1'));
  fireEvent.press(screen.getByTestId(`grid-${tepung}`));
  fireEvent.press(screen.getByTestId('pilih-' + tepung + '-1'));

  return { indomie, tepung };
}

async function addCustomer(nama: string) {
  return act(async () => app.tambahPelanggan({ nama }));
}

async function openCustomerStep() {
  fireEvent.press(screen.getByTestId('simpan-penjualan'));
  await act(async () => {});
}

async function pickCustomer(id: string) {
  fireEvent.press(screen.getByTestId(`pilih-pelanggan-${id}`));
  await act(async () => {});
}

async function typeTendered(value: string) {
  fireEvent(screen.getByTestId('uang-diterima'), 'changeText', value);
  await act(async () => {});
}

describe('choosing the customer before paying', () => {
  it('asks who the sale is for before it shows the payment step', async () => {
    await seedBasket();
    const ani = await addCustomer('Bu Ani');

    await openCustomerStep();

    // The picker is the step, not an error after the money was counted.
    expect(screen.getByText('Pelanggan')).toBeTruthy();
    expect(screen.getByTestId(`pilih-pelanggan-${ani}`)).toBeTruthy();
    expect(screen.queryByTestId('uang-diterima')).toBeNull();

    await pickCustomer(ani);

    expect(screen.getByTestId('bayar-pelanggan')).toHaveTextContent('Bu Ani');
    expect(screen.getByTestId('uang-diterima')).toBeTruthy();
  });

  it('records the unpaid remainder as hutang and prints the split on the nota', async () => {
    await seedBasket();
    const ani = await addCustomer('Bu Ani');
    await openCustomerStep();
    await pickCustomer(ani);

    // 30.500 total; 20.000 handed over leaves 10.500 as hutang.
    await typeTendered('20.000');
    expect(screen.getByTestId('bayar-hutang')).toHaveTextContent(/Kurang Rp 10\.500.*hutang Bu Ani/);
    expect(screen.getByTestId('simpan-pembayaran').props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(screen.getByTestId('simpan-pembayaran'));
    await act(async () => {});

    expect(screen.getByTestId('nota-total')).toHaveTextContent('Total30.500');
    expect(screen.getByTestId('nota-tunai')).toHaveTextContent('20.000');
    expect(screen.getByTestId('nota-kembalian')).toHaveTextContent('0');
    expect(screen.getByTestId('nota-hutang')).toHaveTextContent('10.500');

    const shop = await phoneLedger().shop();
    expect(shop.sales[0].pelangganNama).toBe('Bu Ani');
    expect(shop.sales[0].payment?.unpaid).toBe(10500);
  });

  it('refuses a walk-in sale whose cash falls short, and says a customer is needed', async () => {
    await seedBasket();
    await openCustomerStep();
    fireEvent.press(screen.getByTestId('pelanggan-umum'));
    await act(async () => {});

    await typeTendered('20.000');

    expect(screen.getByTestId('bayar-kurang')).toHaveTextContent(/Kurang Rp 10\.500.*pelanggan/i);
    expect(screen.getByTestId('simpan-pembayaran').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('counts the full value sold today while cash counts only what was paid', async () => {
    await seedBasket();
    const ani = await addCustomer('Bu Ani');
    await openCustomerStep();
    await pickCustomer(ani);
    await typeTendered('20.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran'));
    await act(async () => {});

    fireEvent.press(screen.getByTestId('nota-baru'));
    await act(async () => {});

    expect(screen.getByTestId('hari-ini-jualan')).toHaveTextContent('Jualan 30.500');
    expect(screen.getByTestId('hari-ini-tunai')).toHaveTextContent('Tunai 20.000');
  });
});
