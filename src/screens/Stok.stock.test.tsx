import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import { KasirScreen } from '@/screens/Kasir';
import { colors } from '@/design';
import { app, resetPhone, wrap , storeView } from './testPhone';
import { createLedger } from '@/ledger/ledger';
import type { Shop } from '@/ledger/types';

/**
 * The Stok screen reading the log: what is on the shelf, per varian, and what
 * a correction does to it. Everything is done the way the owner does it —
 * typing a count with a reason on the screen, selling at the till — and every
 * assertion is what the screen shows.
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
  return createLedger(
    { nextIdentity: () => store.nextIdentity(), append: (events) => store.append(events), readAll: () => store.readAll(), lastSeq: () => store.lastSeq(), replaceAll: (events, lastSeq) => store.replaceAll(events, lastSeq) },
    'gawai-uji',
  ).shop();
}

/** Creates a kategori and a produk through the forms the owner uses. */
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

async function seedVarian(produkId: string, nama: string) {
  fireEvent.press(screen.getByTestId(`tambah-varian-${produkId}`));
  fireEvent.changeText(screen.getByTestId('varian-nama'), nama);
  fireEvent.changeText(screen.getByTestId('varian-harga'), '1.000');
  fireEvent.press(screen.getByTestId('simpan-varian'));
  await act(async () => {});
  return (await phoneShop()).varian.find((entry) => entry.nama === nama)!.id;
}

/** The owner counting the shelf: open the varian, type the number, say why, save. */
async function count(varianId: string, counted: string, reason: string) {
  fireEvent.press(screen.getByTestId(`hitung-${varianId}`));
  fireEvent.changeText(screen.getByTestId('hitung-jumlah'), counted);
  fireEvent.changeText(screen.getByTestId('hitung-alasan'), reason);
  fireEvent.press(screen.getByTestId('simpan-hitung'));
  await act(async () => {});
}

/** What the list reads, top to bottom: the name each row announces. */
function listed(): string[] {
  return screen.getAllByTestId(/^stok-baris-/).map((row) => String(row.props.accessibilityLabel).split(',')[0]);
}

/** Sells lines at the till, through the till's own screens. */
async function sellAtTill(lines: { varianId: string; qty: number }[]) {
  screen.unmount();
  render(wrap(<KasirScreen />));
  for (let i = 0; i < 100 && !app?.ready && !app?.error; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  for (const line of lines) fireEvent.press(screen.getByTestId(`grid-${line.varianId}`));
  await act(async () => app.saveSale({ discount: { kind: 'none' }, tendered: 1_000_000 }, lines));
  screen.unmount();
  await open();
}

describe('Stok — what is on the shelf', () => {
  it('reads a varian nobody has counted as unknown, and never as out of stock', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    const row = screen.getByTestId(`stok-baris-${varianId}`);
    expect(row.props.accessibilityLabel).toMatch(/belum dihitung/i);
    expect(screen.queryByText('Habis')).toBeNull();
  });

  it('puts a negative count first, then low, then unknown, then the rest', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Tepung terigu');
    // Names chosen so a name-only order differs from the stock order.
    const ids: Record<string, string> = {};
    for (const nama of ['Amanda lada', 'Budi gula', 'Citra kopi', 'Ari teh', 'Dewi sirup']) {
      ids[nama] = await seedVarian(produkId, nama);
    }
    // Citra is counted at 1; then sells two at the till, and the count is −1.
    await count(ids['Citra kopi'], '1', 'Hitung rak');
    // Amanda gets the owner's minimum of 5 and is left at 3: low, not out.
    fireEvent.press(screen.getByTestId(`minimum-${ids['Amanda lada']}`));
    fireEvent.changeText(screen.getByTestId('minimum-jumlah'), '5');
    fireEvent.press(screen.getByTestId('simpan-minimum'));
    await act(async () => {});
    await count(ids['Amanda lada'], '3', 'Hitung rak');
    // Ari is counted and fine; it is named first and must still read last.
    await count(ids['Ari teh'], '40', 'Hitung rak');

    await sellAtTill([{ varianId: ids['Citra kopi'], qty: 2 }]);
    expect(app.error).toBe(null);

    expect(listed()).toEqual([
      'Citra kopi', // −1: the app and the shelf disagree — first, in red
      'Amanda lada', // 3, below its minimum of 5 — low
      'Budi gula', // never counted — a question, not a warning
      'Dewi sirup', // never counted
      'Ari teh', // 40 — fine, so it reads last
    ]);
  });

  it('shows a negative count in red above the low ones', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Tepung terigu');
    const kosong = await seedVarian(produkId, 'Amanda lada');
    const habis = await seedVarian(produkId, 'Budi gula');
    await count(kosong, '0', 'Rak kosong');
    await count(habis, '2', 'Hitung rak');

    await sellAtTill([{ varianId: habis, qty: 3 }]); // 2 counted, 3 sold → −1

    expect(listed()).toEqual(['Budi gula', 'Amanda lada']);
    // Red in the ink DESIGN reserves for it, on the name and the number, with
    // the word "Hitung ulang" beside it — colour is never the only signal.
    expect(screen.getByText('Budi gula')).toHaveStyle({ color: colors.error });
    expect(screen.getByText('Hitung ulang')).toBeTruthy();
    expect(stringOf(`stok-angka-${habis}`)).toBe('−1');
    // The merely-out varian is not red.
    expect(screen.getByText('Amanda lada')).not.toHaveStyle({ color: colors.error });
  });
});

/** The number a stock badge shows: the figure, before its state in words. */
function stringOf(testId: string): string {
  return flatten(screen.getByTestId(testId).props.children).replace(/(Belum dihitung|Hitung ulang|Habis|Rendah)$/, '');
}

/** The visible text under a testID, however React nested it. */
function flatten(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'props' in (value as { props?: unknown })) {
    return flatten((value as { props: { children?: unknown } }).props.children);
  }
  return '';
}

describe('Stok — correcting a count', () => {
  it('records the correction as a delta with its reason, and shows the counted number', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');
    await count(varianId, '10', 'Hitung gudang');

    await count(varianId, '8', 'Ada yang pecah');

    expect(stringOf(`stok-angka-${varianId}`)).toBe('8');
    // The history says what happened, as a delta: −2, not "now 8".
    fireEvent.press(screen.getByTestId(`riwayat-${varianId}`));
    await act(async () => {});
    expect(screen.getByText('Ada yang pecah')).toBeTruthy();
    expect(screen.getByText('−2')).toBeTruthy();
    expect(screen.getByText('+10')).toBeTruthy();
  });

  it('needs a reason before it will record anything', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    fireEvent.press(screen.getByTestId(`hitung-${varianId}`));
    fireEvent.changeText(screen.getByTestId('hitung-jumlah'), '10');
    fireEvent.press(screen.getByTestId('simpan-hitung'));
    await act(async () => {});

    expect(screen.getByText('Alasan hitung ulang wajib diisi.')).toBeTruthy();
    // Nothing was written: the varian still reads unknown on the list behind.
    expect(app.stockOf(varianId)).toEqual({ kind: 'unknown' });
  });

  it('lets two corrections sum rather than overwrite', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    await count(varianId, '10', 'Hitung gudang');
    await count(varianId, '12', 'Koreksi satu');
    await count(varianId, '14', 'Koreksi dua');

    expect(stringOf(`stok-angka-${varianId}`)).toBe('14');
    // And the log itself: three events, each holding a delta, that add.
    const deltas = (await storedEvents())
      .filter((event) => event.type === 'stock.adjusted')
      .map((event) => (event.payload as { delta: number }).delta);
    expect(deltas).toEqual([10, 2, 2]);
  });
});

describe('Stok — selling reduces the count', () => {
  it('reduces each sold varian and leaves the others alone', async () => {
    await open();
    const produkId = await seedProduk('Tepung', 'Tepung terigu');
    const kg1 = await seedVarian(produkId, 'Tepung terigu 1 kg');
    const kg2 = await seedVarian(produkId, 'Tepung terigu 2 kg');
    await count(kg1, '12', 'Hitung gudang');
    await count(kg2, '6', 'Hitung gudang');

    await sellAtTill([{ varianId: kg1, qty: 3 }]);

    expect(stringOf(`stok-angka-${kg1}`)).toBe('9');
    expect(stringOf(`stok-angka-${kg2}`)).toBe('6');
  });

  it('sells a varian at zero and shows a negative count', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');
    await count(varianId, '0', 'Rak kosong');

    await sellAtTill([{ varianId, qty: 1 }]);

    expect(stringOf(`stok-angka-${varianId}`)).toBe('−1');
  });
});

async function storedEvents() {
  return mockPhone.store.readAll();
}
