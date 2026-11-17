import { emptyShop, foldEvents, sumSales, type LedgerEvent } from './events';
import { DEFAULT_RECEIPT } from './receipt';
export type { LedgerEvent };

/**
 * A record's id is its `created` event's id. Two phones that receive the same
 * event therefore name the record the same thing, which is what makes a sale
 * line written on one phone resolve on the other.
 */
const ids = { kategori: 'evt-kat', produk: 'evt-prd', varian: 'evt-var' } as const;

describe('the ledger as the shop sees it', () => {
  it('starts as an empty shop', () => {
    expect(emptyShop()).toEqual({
      kategori: [],
      produk: [],
      varian: [],
      pelanggan: [],
      sales: [],
      receipt: DEFAULT_RECEIPT,
      receiptAt: null,
    });
  });

  it('records master data created on the device', () => {
    const shop = foldEvents([
      kategori(),
      produk(),
      varian({ satuan: 'kg', jualBy: 'weight', harga: 13500 }),
    ]);

    expect(shop.kategori).toEqual([{ id: ids.kategori, nama: 'Tepung', parentId: null, archived: false }]);
    expect(shop.produk).toEqual([
      { id: ids.produk, kategoriId: ids.kategori, nama: 'Tepung terigu', archived: false },
    ]);
    expect(shop.varian).toEqual([
      {
        id: ids.varian,
        produkId: ids.produk,
        nama: 'Tepung terigu 1 kg',
        kode: 'TLG-1',
        satuan: 'kg',
        jualBy: 'weight',
        harga: 13500,
        // Nobody has set a low-stock minimum yet; that is a rule, not a missing field.
        minimum: null,
        archived: false,
      },
    ]);
  });

  it('shows a stored sale with the lines and prices it was made at, however old', () => {
    const sale: LedgerEvent = {
      id: 'sale-1',
      deviceId: 'gawai-1',
      seq: 10,
      createdAt: '2026-10-31T09:15:00.000Z',
      type: 'sale.completed',
      payload: {
        total: 40500,
        lines: [
          { varianId: ids.varian, nama: 'Tepung terigu 1 kg', satuan: 'kg', qty: 3, harga: 13500, jumlah: 40500 },
        ],
      },
    };

    const shop = foldEvents([kategori(), produk(), varian(), sale]);

    expect(shop.sales).toEqual([
      {
        id: 'sale-1',
        createdAt: '2026-10-31T09:15:00.000Z',
        total: 40500,
        // Written before sales carried a number; the envelope still earns it one.
        number: '20261031-GAWA-010',
        payment: null,
        pelangganId: null,
        pelangganNama: null,
        lines: [
          { varianId: ids.varian, nama: 'Tepung terigu 1 kg', satuan: 'kg', qty: 3, harga: 13500, jumlah: 40500 },
        ],
      },
    ]);
    expect(sumSales(shop.sales)).toBe(40500);
  });

  it('renames a kategori without renaming the produk inside it', () => {
    const shop = foldEvents([
      kategori(),
      produk(),
      {
        id: 'evt-kat-rename',
        deviceId: 'gawai-1',
        seq: 4,
        createdAt: '2026-10-31T08:03:00.000Z',
        type: 'kategori.updated',
        payload: { kategoriId: ids.kategori, nama: { value: 'Sembako', at: '2026-10-31T08:03:00.000Z' } },
      },
    ]);

    expect(shop.kategori[0].nama).toBe('Sembako');
    // The produk keeps its own name: a kategori is a grouping, not a prefix.
    expect(shop.produk[0].nama).toBe('Tepung terigu');
  });

  it('archives a kategori and leaves its produk in place, uncategorised', () => {
    const shop = foldEvents([
      kategori(),
      produk(),
      {
        id: 'evt-kat-archive',
        deviceId: 'gawai-1',
        seq: 4,
        createdAt: '2026-10-31T08:03:00.000Z',
        type: 'kategori.archived',
        payload: { kategoriId: ids.kategori, archived: true },
      },
    ]);

    expect(shop.kategori[0].archived).toBe(true);
    // The produk is not deleted and not renamed: it simply has no kategori now.
    expect(shop.produk).toHaveLength(1);
    expect(shop.produk[0]).toEqual(expect.objectContaining({ nama: 'Tepung terigu', kategoriId: null }));
  });

  it('moves a produk to another kategori without touching its name', () => {
    const shop = foldEvents([
      kategori(),
      produk(),
      {
        id: 'evt-prd-move',
        deviceId: 'gawai-1',
        seq: 4,
        createdAt: '2026-10-31T08:03:00.000Z',
        type: 'produk.updated',
        payload: { produkId: ids.produk, kategoriId: { value: 'evt-kat-lain', at: '2026-10-31T08:03:00.000Z' } },
      },
    ]);

    expect(shop.produk[0]).toEqual(
      expect.objectContaining({ nama: 'Tepung terigu', kategoriId: 'evt-kat-lain' }),
    );
  });

  it('archives a produk without erasing it or its varian', () => {
    const shop = foldEvents([
      kategori(),
      produk(),
      varian(),
      {
        id: 'evt-prd-archive',
        deviceId: 'gawai-1',
        seq: 4,
        createdAt: '2026-10-31T08:03:00.000Z',
        type: 'produk.archived',
        payload: { produkId: ids.produk, archived: true },
      },
    ]);

    expect(shop.produk[0].archived).toBe(true);
    // The varian is still in the log and still resolves by id: old receipts
    // and old stock figures keep reading correctly.
    expect(shop.varian).toHaveLength(1);
    expect(shop.varian[0].archived).toBe(false);
  });

  it('archives a varian without erasing it', () => {
    const shop = foldEvents([
      kategori(),
      produk(),
      varian(),
      {
        id: 'evt-var-archive',
        deviceId: 'gawai-1',
        seq: 4,
        createdAt: '2026-10-31T08:03:00.000Z',
        type: 'varian.archived',
        payload: { varianId: ids.varian, archived: true },
      },
    ]);

    expect(shop.varian[0].archived).toBe(true);
  });

  it('keeps the lines a sale was written with', () => {
    const sale: LedgerEvent = {
      id: 'sale-1',
      deviceId: 'gawai-1',
      seq: 10,
      createdAt: '2026-10-31T09:15:00.000Z',
      type: 'sale.completed',
      payload: {
        total: 81000,
        lines: [
          { varianId: ids.varian, nama: 'Tepung terigu 1 kg', satuan: 'kg', qty: 6, harga: 13500, jumlah: 81000 },
        ],
      },
    };

    expect(foldEvents([sale]).sales[0].lines).toHaveLength(1);
    expect(emptyShop().sales).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function kategori(nama = 'Tepung'): LedgerEvent {
  return {
    id: ids.kategori,
    deviceId: 'gawai-1',
    seq: 1,
    createdAt: '2026-10-31T08:00:00.000Z',
    type: 'kategori.created',
    payload: { nama, parentId: null },
  };
}

function produk(nama = 'Tepung terigu'): LedgerEvent {
  return {
    id: ids.produk,
    deviceId: 'gawai-1',
    seq: 2,
    createdAt: '2026-10-31T08:01:00.000Z',
    type: 'produk.created',
    payload: { kategoriId: ids.kategori, nama },
  };
}

function varian(
  overrides: Partial<{
    nama: string;
    kode: string | null;
    satuan: 'pcs' | 'bungkus' | 'kg' | 'liter' | 'sak';
    jualBy: 'unit' | 'weight';
    harga: number;
  }> = {},
): LedgerEvent {
  return {
    id: ids.varian,
    deviceId: 'gawai-1',
    seq: 3,
    createdAt: '2026-10-31T08:02:00.000Z',
    type: 'varian.created',
    payload: {
      produkId: ids.produk,
      nama: 'Tepung terigu 1 kg',
      kode: 'TLG-1',
      satuan: 'kg',
      jualBy: 'weight',
      harga: 13500,
      ...overrides,
    },
  };
}
