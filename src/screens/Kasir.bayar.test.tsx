import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import type { Catalog } from '@/ledger/catalog';
import type { Shop } from '@/ledger/types';
import { app, mockPrinter, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * The payment step and the nota after it, driven the way the owner drives
 * them: tap a few items, press Bayar, type what the customer handed over, and
 * read the kembalian back.
 *
 * Every amount is worked by hand: Indomie 3.500 and two Tepung 1 kg at 13.500
 * make a gross of 30.500.
 */

// Screen seeding runs a real ledger inside act; give it room when suites share the CPU.
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

async function openPayment() {
  fireEvent.press(screen.getByTestId('simpan-penjualan'));
  await act(async () => {});
}

async function typeTendered(value: string) {
  fireEvent(screen.getByTestId('uang-diterima'), 'changeText', value);
  await act(async () => {});
}

async function typeDiscount(value: string) {
  fireEvent(screen.getByTestId('bayar-diskon-input'), 'changeText', value);
  await act(async () => {});
}

describe('Bayar — taking cash', () => {
  it('shows gross, discount, pembulatan, net, tendered and kembalian', async () => {
    await seedBasket();
    await openPayment();

    // 30.500 is already on the 500 step, so pembulatan is a zero line.
    expect(screen.getByTestId('bayar-gross')).toHaveTextContent('30.500');
    expect(screen.getByTestId('bayar-diskon')).toHaveTextContent('0');
    expect(screen.getByTestId('bayar-pembulatan')).toHaveTextContent('—');
    expect(screen.getByTestId('bayar-total')).toHaveTextContent('Total30.500');
    expect(screen.getByTestId('bayar-kembalian')).toHaveTextContent('0');
    expect(screen.getByText('Kembalian')).toBeTruthy();
  });

  it('updates kembalian live as the customer hands over cash', async () => {
    await seedBasket();
    await openPayment();

    await typeTendered('50.000');
    expect(screen.getByTestId('bayar-kembalian')).toHaveTextContent('19.500');

    await typeTendered('30000');
    expect(screen.getByTestId('bayar-kembalian')).toHaveTextContent('0');
  });

  it('takes a rupiah discount off the gross, rounds the rest to 500 and pays the change', async () => {
    await seedBasket();
    await openPayment();

    // 30.500 − 1.200 = 29.300 → pembulatan +200 → 29.500; 50.000 leaves 20.500.
    await typeDiscount('1.200');
    await typeTendered('50.000');

    expect(screen.getByTestId('bayar-diskon')).toHaveTextContent('1.200');
    expect(screen.getByTestId('bayar-pembulatan')).toHaveTextContent('+200');
    expect(screen.getByTestId('bayar-total')).toHaveTextContent('Total29.500');
    expect(screen.getByTestId('bayar-kembalian')).toHaveTextContent('20.500');
  });

  it('takes a percentage discount', async () => {
    await seedBasket();
    await openPayment();

    await typeDiscount('10');
    await act(async () => {
      fireEvent.press(screen.getByTestId('diskon-persen'));
    });
    await typeTendered('30.000');

    // 10% of 30.500 = 3.050 → 27.450 + 50 → 27.500; 30.000 leaves 2.500.
    expect(screen.getByTestId('bayar-diskon')).toHaveTextContent('3.050');
    expect(screen.getByTestId('bayar-pembulatan')).toHaveTextContent('+50');
    expect(screen.getByTestId('bayar-total')).toHaveTextContent('Total27.500');
    expect(screen.getByTestId('bayar-kembalian')).toHaveTextContent('2.500');
  });

  it('hands back nothing when the cash falls short, and refuses to save it as a cash sale', async () => {
    await seedBasket();
    await openPayment();

    await typeTendered('20.000');

    expect(screen.getByTestId('bayar-kembalian')).toHaveTextContent('0');
    // 30.500 net; 20.000 handed over leaves 10.500 missing.
    expect(screen.getByTestId('bayar-kurang')).toHaveTextContent(/Kurang Rp 10\.500 dari total/);
    expect(screen.getByTestId('simpan-pembayaran').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('after paying — the nota', () => {
  it('shows the receipt with its lines, pembulatan, total, kembalian and sale number', async () => {
    await seedBasket();
    await openPayment();
    await typeDiscount('1.200');
    await typeTendered('50.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran'));
    await act(async () => {});

    expect(screen.getByText('Tersimpan')).toBeTruthy();
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(/^No\. \d{8}-.{4}-\d{3}$/);
    expect(screen.getByTestId('nota-gross')).toHaveTextContent('30.500');
    expect(screen.getByTestId('nota-diskon')).toHaveTextContent('−1.200');
    expect(screen.getByTestId('nota-pembulatan')).toHaveTextContent('+200');
    expect(screen.getByTestId('nota-total')).toHaveTextContent('Total29.500');
    expect(screen.getByTestId('nota-tunai')).toHaveTextContent('50.000');
    expect(screen.getByTestId('nota-kembalian')).toHaveTextContent('20.500');
    // The saved sale carries every figure, not only the total.
    expect((await phoneShop()).sales[0].payment).toMatchObject({
      discount: 1200,
      rounding: 200,
      net: 29500,
      tendered: 50000,
      kembalian: 20500,
    });
  });

  it('prints and shares the nota as a PDF when the owner taps Bagikan nota', async () => {
    await seedBasket();
    await openPayment();
    await typeDiscount('1.200');
    await typeTendered('50.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran'));
    await act(async () => {});

    const bagikan = screen.getByTestId('bagikan-nota');
    fireEvent.press(bagikan);
    // A second tap while the share sheet is opening must not write the PDF twice.
    fireEvent.press(bagikan);
    await act(async () => {});

    expect(mockPrinter.printed).toHaveLength(1);
    const paper = mockPrinter.printed[0];
    expect(paper).toContain('Indomie goreng');
    expect(paper).toContain('Pembulatan');
    expect(paper).toContain('+200');
    expect(paper).toContain('29.500');
    expect(paper).toContain('20.500');
    expect(mockPrinter.shared).toEqual([{ uri: 'file:///cache/nota-1.pdf', mimeType: 'application/pdf' }]);
  });
});

/** The shop read from the phone's storage by a fresh reader, not by the screen. */
async function phoneShop(): Promise<Shop> {
  return phoneLedger().shop();
}
