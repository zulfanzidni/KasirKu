import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import { KasirScreen } from '@/screens/Kasir';
import { colors } from '@/design';
import { app, mockPhone, phoneLedger, resetPhone, wrap } from './testPhone';
import type { Satuan, Shop } from '@/ledger/types';

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
  return phoneLedger().shop();
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

async function seedVarian(produkId: string, nama: string, satuan: Satuan = 'pcs') {
  fireEvent.press(screen.getByTestId(`tambah-varian-${produkId}`));
  fireEvent.changeText(screen.getByTestId('varian-nama'), nama);
  if (satuan !== 'pcs') fireEvent.press(screen.getByTestId(`satuan-${satuan}`));
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

describe('Stok — why a varian is low', () => {
  it('says the owner’s minimum is what flagged it', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Tepung terigu');
    const varianId = await seedVarian(produkId, 'Tepung terigu 1 kg');

    fireEvent.press(screen.getByTestId(`minimum-${varianId}`));
    fireEvent.changeText(screen.getByTestId('minimum-jumlah'), '5');
    fireEvent.press(screen.getByTestId('simpan-minimum'));
    await act(async () => {});
    await count(varianId, '3', 'Hitung rak');

    expect(screen.getByText('Rendah: di bawah minimum 5')).toBeTruthy();
  });

  it('flags a varian with no minimum by how fast it sold, and names that rule', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Tepung terigu');
    const varianId = await seedVarian(produkId, 'Tepung terigu 1 kg');

    // The shop has been selling this for ten days: two 12-packs, one long
    // enough ago to prove the history, one inside the short window.
    screen.unmount();
    mounted = false;
    await seedPastSale(varianId, 12, 10);
    await seedPastSale(varianId, 12, 2);
    await open();
    // The shelf holds 4 — less than one window of sales.
    await count(varianId, '4', 'Hitung gudang');

    expect(screen.getByText('Rendah: terjual 12 dalam 7 hari')).toBeTruthy();
  });

  it('admits it does not know when the history is too short, instead of inventing a figure', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    // One day of selling is not a selling speed.
    screen.unmount();
    mounted = false;
    await seedPastSale(varianId, 50, 1);
    await open();
    await count(varianId, '2', 'Hitung rak');

    expect(screen.getByText('Riwayat penjualan belum cukup untuk menilai. Atur minimum untuk peringatan.')).toBeTruthy();
    expect(screen.queryByText(/^Rendah: terjual/)).toBeNull();
  });
});

describe('Stok — whose goods they are', () => {
  it('counts goods that arrived as the shop’s own', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    screen.unmount();
    mounted = false;
    await seedReceived(varianId, 12, 'tunai');
    await open();

    expect(stringOf(`stok-angka-${varianId}`)).toBe('12');
  });

  it('does not let titip stock hide a shortage', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    fireEvent.press(screen.getByTestId(`minimum-${varianId}`));
    fireEvent.changeText(screen.getByTestId('minimum-jumlah'), '5');
    fireEvent.press(screen.getByTestId('simpan-minimum'));
    await act(async () => {});
    await count(varianId, '1', 'Hitung rak');

    // The supplier left fifty on the shelf, but they are not the shop's to sell
    // as its own — the warning must still stand.
    screen.unmount();
    mounted = false;
    await seedReceived(varianId, 50, 'titip');
    await open();

    expect(stringOf(`stok-angka-${varianId}`)).toBe('1');
    expect(screen.getByText('Rendah: di bawah minimum 5')).toBeTruthy();
  });

  it('reads a varian with only titip goods as never counted, not as owned stock', async () => {
    await open();
    const produkId = await seedProduk('Sembako', 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    screen.unmount();
    mounted = false;
    await seedReceived(varianId, 50, 'titip');
    await open();

    expect(stringOf(`stok-angka-${varianId}`)).toBe('—');
    expect(screen.getByText('Belum dihitung')).toBeTruthy();
  });
});

describe('Stok — repack or reorder', () => {
  it('shows the sack stock beside a low packet, and reads it as repack', async () => {
    await open();
    const produkId = await seedProduk('Tepung', 'Tepung terigu');
    const sak = await seedVarian(produkId, 'Tepung terigu 25 kg', 'sak');
    const packet = await seedVarian(produkId, 'Tepung terigu 1 kg', 'kg');
    await count(sak, '3', 'Hitung gudang');

    fireEvent.press(screen.getByTestId(`minimum-${packet}`));
    fireEvent.changeText(screen.getByTestId('minimum-jumlah'), '5');
    fireEvent.press(screen.getByTestId('simpan-minimum'));
    await act(async () => {});
    await count(packet, '1', 'Hitung rak');

    expect(screen.getByText('Stok sak: 3 · Repack')).toBeTruthy();
  });

  it('reads a low packet with no sacks left as reorder', async () => {
    await open();
    const produkId = await seedProduk('Tepung', 'Tepung terigu');
    const sak = await seedVarian(produkId, 'Tepung terigu 25 kg', 'sak');
    const packet = await seedVarian(produkId, 'Tepung terigu 1 kg', 'kg');
    await count(sak, '0', 'Rak kosong');

    fireEvent.press(screen.getByTestId(`minimum-${packet}`));
    fireEvent.changeText(screen.getByTestId('minimum-jumlah'), '5');
    fireEvent.press(screen.getByTestId('simpan-minimum'));
    await act(async () => {});
    await count(packet, '1', 'Hitung rak');

    expect(screen.getByText('Stok sak: 0 · Reorder')).toBeTruthy();
  });

  it('flags the bulk varian itself, apart from its packets', async () => {
    await open();
    const produkId = await seedProduk('Tepung', 'Tepung terigu');
    const sak = await seedVarian(produkId, 'Tepung terigu 25 kg', 'sak');
    const packet = await seedVarian(produkId, 'Tepung terigu 1 kg', 'kg');

    fireEvent.press(screen.getByTestId(`minimum-${sak}`));
    fireEvent.changeText(screen.getByTestId('minimum-jumlah'), '2');
    fireEvent.press(screen.getByTestId('simpan-minimum'));
    await act(async () => {});
    await count(sak, '1', 'Hitung gudang');
    await count(packet, '20', 'Hitung rak');

    expect(screen.getByText('Rendah: di bawah minimum 2')).toBeTruthy();
    // The sack is judged on its own count; it has no bulk sibling to point at.
    expect(screen.queryByTestId(`sak-${sak}`)).toBeNull();
  });
});

async function storedEvents() {
  return mockPhone.store.readAll();
}

/** A sale written into the phone's log as if it happened `daysAgo` days ago. */
async function seedPastSale(varianId: string, qty: number, daysAgo: number) {
  const store = mockPhone.store;
  const { id, seq } = await store.nextIdentity();
  const at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  await store.append([
    {
      id,
      seq,
      deviceId: 'gawai-uji',
      createdAt: at,
      type: 'sale.completed',
      payload: {
        lines: [{ varianId, nama: 'Tepung terigu 1 kg', satuan: 'kg', qty, harga: 1000, jumlah: 1000 * qty }],
        total: 1000 * qty,
      },
    } as never,
  ]);
}

/** Goods arriving from a supplier, in the way they arrived. */
async function seedReceived(varianId: string, qty: number, settlement: 'tunai' | 'tempo' | 'titip') {
  const store = mockPhone.store;
  const { id, seq } = await store.nextIdentity();
  await store.append([
    {
      id,
      seq,
      deviceId: 'gawai-uji',
      createdAt: new Date().toISOString(),
      type: 'stock.received',
      payload: { varianId, qty, settlement },
    } as never,
  ]);
}
