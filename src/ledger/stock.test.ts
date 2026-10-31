import { createCatalog } from './catalog';
import { createLedger } from './ledger';
import { MemoryStore } from './memoryStore';
import { lowStock, sortStock, stockByVariant, stockHistory, stockOnHand } from './queries';
import type { PaymentInput, StockState, Varian } from './types';

/**
 * Stock is never stored: it is the log's own answer. These tests speak in the
 * shop's terms — what is on the shelf, what a correction does — and read the
 * answer only through the ledger's queries.
 */

/** The whole amount handed over; nothing here is about money. */
const paid = (rupiah: number): PaymentInput => ({ discount: { kind: 'none' }, tendered: rupiah });

/**
 * The Stok list's order, at the place it is decided: every state present at
 * once, with names that would sort differently by name alone, so swapping any
 * two ranks fails the test.
 */
describe('the order the Stok list reads in', () => {
  it('puts a negative count above low, then unknown, then the rest', () => {
    const row = (nama: string, stock: StockState, minimum: number | null = null) =>
      ({ varian: { ...varian(nama), minimum }, stock });

    const sorted = sortStock([
      row('Amanda lada', { kind: 'counted', qty: 40 }), //                        fine
      row('Budi gula', { kind: 'unknown' }), //                                   never counted
      row('Citra kopi', { kind: 'counted', qty: -1 }), //                        negative
      row('Ari teh', { kind: 'counted', qty: 0 }), //                            out
      row('Dewi sirup', { kind: 'counted', qty: 3 }, 5), //                      below its minimum
    ]);

    expect(sorted.map((entry) => entry.varian.nama)).toEqual([
      'Citra kopi',
      'Ari teh',
      'Dewi sirup',
      'Budi gula',
      'Amanda lada',
    ]);
  });
});

function varian(nama: string): Varian {
  return { id: nama, produkId: 'prd-1', nama, kode: null, satuan: 'pcs', jualBy: 'unit', harga: 1000, minimum: null, archived: false };
}

async function shopWith(varian: { nama: string; harga: number }[]) {
  const ledger = createLedger(new MemoryStore(), 'gawai-1');
  const kategoriId = await ledger.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ledger.append('produk.created', { kategoriId, nama: 'Tepung terigu' });
  const ids: Record<string, string> = {};
  for (const entry of varian) {
    ids[entry.nama] = await ledger.append('varian.created', {
      produkId,
      nama: entry.nama,
      kode: null,
      satuan: 'kg',
      jualBy: 'weight',
      harga: entry.harga,
    });
  }
  return { ledger, ids };
}

const KG1 = { nama: 'Tepung terigu 1 kg', harga: 13500 };
const KG2 = { nama: 'Tepung terigu 2 kg', harga: 26000 };

describe('stock, asked for per varian', () => {
  it('reads a varian nobody has ever counted as unknown — not as zero', async () => {
    const { ledger, ids } = await shopWith([KG1]);

    expect(await stockOnHand(ledger, ids[KG1.nama])).toEqual({ kind: 'unknown' });
  });

  it('leaves the unknown varian out of the low list, so a new shop is not all warnings', async () => {
    const { ledger } = await shopWith([KG1]);

    expect(await lowStock(ledger)).toEqual([]);
  });

  it('leaves the unknown varian out of the reorder list too, even beside a known-low one', async () => {
    const { ledger, ids } = await shopWith([KG1, KG2]);
    await ledger.recordSale([{ varianId: ids[KG2.nama], qty: 1 }], paid(26000));
    await adjust(ledger, ids[KG1.nama], 0, 'Hitung awal');

    // 1 kg was counted at 0 and is out; 2 kg has never been counted.
    expect((await lowStock(ledger)).map((entry) => entry.varian.nama)).toEqual([KG1.nama]);
  });

  it('counts a correction from the shelf: the counted number becomes the stock', async () => {
    const { ledger, ids } = await shopWith([KG1]);

    await adjust(ledger, ids[KG1.nama], 12, 'Hitung gudang');

    expect(await stockOnHand(ledger, ids[KG1.nama])).toEqual({ kind: 'counted', qty: 12 });
  });

  it('records the correction as a delta from what the app believed', async () => {
    const { ledger, ids } = await shopWith([KG1]);
    await adjust(ledger, ids[KG1.nama], 10, 'Hitung gudang');

    // The app believes 10; the shelf has 12; the delta written is +2.
    const eventId = await adjust(ledger, ids[KG1.nama], 12, 'Hitung ulang');

    const written = (await ledger.events()).find((event) => event.id === eventId);
    expect(written).toMatchObject({
      type: 'stock.adjusted',
      payload: { varianId: ids[KG1.nama], delta: 2, reason: 'Hitung ulang' },
    });
  });

  it('stores fractional corrections without drifting', async () => {
    const { ledger, ids } = await shopWith([KG1]);

    await adjust(ledger, ids[KG1.nama], 12.25, 'Hitung gudang');

    expect(await stockOnHand(ledger, ids[KG1.nama])).toEqual({ kind: 'counted', qty: 12.25 });
  });

  it('lets two corrections sum rather than overwrite', async () => {
    const { ledger, ids } = await shopWith([KG1]);
    await adjust(ledger, ids[KG1.nama], 10, 'Hitung awal');

    // The phone saw 10; the shelf says 12.
    await adjust(ledger, ids[KG1.nama], 12, 'Koreksi 1');
    // And later the packer finds two more.
    await adjust(ledger, ids[KG1.nama], 14, 'Koreksi 2');

    expect(await stockOnHand(ledger, ids[KG1.nama])).toEqual({ kind: 'counted', qty: 14 });
  });

  it('keeps each correction in the variant’s history, as a delta with its reason', async () => {
    const { ledger, ids } = await shopWith([KG1]);
    await adjust(ledger, ids[KG1.nama], 10, 'Hitung gudang');
    await adjust(ledger, ids[KG1.nama], 8, 'Ada yang pecah');

    const history = (await stockHistory(ledger, ids[KG1.nama])).map((entry) => ({
      kind: entry.kind,
      delta: entry.kind === 'adjusted' ? entry.delta : undefined,
      reason: entry.kind === 'adjusted' ? entry.reason : undefined,
    }));

    expect(history).toEqual([
      { kind: 'adjusted', delta: 10, reason: 'Hitung gudang' },
      { kind: 'adjusted', delta: -2, reason: 'Ada yang pecah' },
    ]);
  });

  it('sells at zero, and the count goes visibly negative', async () => {
    const { ledger, ids } = await shopWith([KG1]);
    await adjust(ledger, ids[KG1.nama], 0, 'Rak kosong');

    await ledger.recordSale([{ varianId: ids[KG1.nama], qty: 1 }], paid(13500));

    expect(await stockOnHand(ledger, ids[KG1.nama])).toEqual({ kind: 'counted', qty: -1 });
  });

  it('lists every live varian, with its own count — never pooled by produk', async () => {
    const { ledger, ids } = await shopWith([KG1, KG2]);
    await adjust(ledger, ids[KG1.nama], 5, 'Hitung gudang');

    const rows = await stockByVariant(ledger);

    // Two variants of one produk, two figures: the 1 kg count is 5 and the
    // 2 kg count is still nobody's — they were not added into 5.
    expect(rows.map((row) => [row.varian.nama, row.stock])).toEqual([
      [KG2.nama, { kind: 'unknown' }],
      [KG1.nama, { kind: 'counted', qty: 5 }],
    ]);
    // The row carries what the screen needs to draw it, from the log.
    expect(rows[1].varian).toMatchObject({ satuan: 'kg' });
  });

  it('keeps the owner’s minimum on the varian without disturbing its other fields', async () => {
    const { ledger, ids } = await shopWith([KG2]);
    // The real catalog, writing through the real ledger — the same path the
    // Stok minimum sheet uses, no stand-in.
    const catalog = createCatalog((type, payload) => ledger.append(type, payload));

    await catalog.setMinimum(ids[KG2.nama], 3);

    const varian = (await ledger.shop()).varian[0];
    expect(varian).toMatchObject({ nama: KG2.nama, harga: KG2.harga, satuan: 'kg', minimum: 3 });
  });

  it('judges a counted varian by the owner’s minimum, which is kept with the varian', async () => {
    const { ledger, ids } = await shopWith([KG1, KG2]);
    await adjust(ledger, ids[KG1.nama], 5, 'Hitung gudang');
    await adjust(ledger, ids[KG2.nama], 8, 'Hitung gudang');

    await ledger.append('varian.updated', { varianId: ids[KG2.nama], minimum: { value: 10, at: new Date().toISOString() } });

    expect((await lowStock(ledger)).map((entry) => entry.varian.nama)).toEqual([KG2.nama]);
  });
});

async function adjust(ledger: ReturnType<typeof createLedger>, varianId: string, counted: number, reason: string) {
  return ledger.adjustStock({ varianId, counted, reason });
}
