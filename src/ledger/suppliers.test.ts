import { createLedger } from './ledger';
import { MemoryStore } from './memoryStore';
import { stockOf, titipStockOf } from './stock';
import {
  createSupplierBook,
  supplierPayable,
  supplierPayables,
  titipStock,
  type SupplierReader,
} from './suppliers';
import type { PaymentInput } from './types';

/**
 * Suppliers and what the shop owes them, read only through the ledger seam.
 * Every figure is a fold of the log: a tempo delivery creates debt on arrival,
 * a titip delivery creates it only when a unit sells, and a payment leaves the
 * remainder standing.
 */

const paid = (rupiah: number): PaymentInput => ({ discount: { kind: 'none' }, tendered: rupiah });

async function shopWith(names: string[]) {
  const ledger = createLedger(new MemoryStore(), 'gawai-1');
  const kategoriId = await ledger.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ledger.append('produk.created', { kategoriId, nama: 'Tepung terigu' });
  const ids: Record<string, string> = {};
  for (const nama of names) {
    ids[nama] = await ledger.append('varian.created', {
      produkId,
      nama,
      kode: null,
      satuan: 'pcs',
      jualBy: 'unit',
      harga: 10_000,
    });
  }

  // The book reads the log as it stands after every write, the way the
  // provider's refs do on the phone.
  let reader: SupplierReader = { shop: await ledger.shop(), events: await ledger.events() };
  const book = createSupplierBook(
    async (type, payload) => {
      const id = await ledger.append(type, payload);
      reader = { shop: await ledger.shop(), events: await ledger.events() };
      return id;
    },
    () => reader,
  );

  return { ledger, ids, book };
}

describe('a delivery note in tunai, tempo and titip', () => {
  it('records one visit as one nota, and only tempo creates debt on arrival', async () => {
    const { ledger, ids, book } = await shopWith(['Tunai', 'Tempo', 'Titip']);
    const supplierId = await book.createSupplier({ nama: 'CV Sumber Rejeki' });

    const notaId = await book.receiveDelivery({
      supplierId,
      lines: [
        { varianId: ids.Tunai, qty: 10, settlement: 'tunai', hargaBeli: 1_000 },
        { varianId: ids.Tempo, qty: 5, settlement: 'tempo', hargaBeli: 2_000 },
        { varianId: ids.Titip, qty: 8, settlement: 'titip', hargaBeli: 3_000 },
      ],
    });

    // Tunai and tempo are the shop's own; titip is not.
    expect(stockOf(await ledger.events(), ids.Tunai).stock).toEqual({ kind: 'counted', qty: 10 });
    expect(stockOf(await ledger.events(), ids.Tempo).stock).toEqual({ kind: 'counted', qty: 5 });
    expect(stockOf(await ledger.events(), ids.Titip).stock).toEqual({ kind: 'unknown' });
    expect(titipStockOf(await ledger.events(), ids.Titip)).toBe(8);

    // Only the tempo line is owed: 5 × 2.000.
    expect(supplierPayable(await ledger.events(), supplierId)).toEqual({
      tempo: 10_000,
      titip: 0,
      paid: 0,
      total: 10_000,
    });

    // One visit, one nota id, one event per line.
    const received = (await ledger.events()).filter((event) => event.type === 'stock.received');
    expect(received).toHaveLength(3);
    expect(new Set(received.map((event) => (event.payload as { notaId: string }).notaId))).toEqual(new Set([notaId]));
  });

  it('keeps each supplier’s debt apart', async () => {
    const { ledger, ids, book } = await shopWith(['A', 'B']);
    const satu = await book.createSupplier({ nama: 'Pemasok Satu' });
    const dua = await book.createSupplier({ nama: 'Pemasok Dua' });

    await book.receiveDelivery({
      supplierId: satu,
      lines: [{ varianId: ids.A, qty: 2, settlement: 'tempo', hargaBeli: 5_000 }],
    });
    await book.receiveDelivery({
      supplierId: dua,
      lines: [{ varianId: ids.B, qty: 3, settlement: 'tempo', hargaBeli: 4_000 }],
    });

    const rows = supplierPayables(await ledger.events(), (await ledger.shop()).supplier);
    expect(rows.map((row) => [row.supplier.nama, row.total])).toEqual([
      ['Pemasok Dua', 12_000],
      ['Pemasok Satu', 10_000],
    ]);
  });
});

describe('selling titip goods', () => {
  it('draws owned stock first, and only the titip units that sell become debt', async () => {
    const { ledger, ids, book } = await shopWith(['Tepung']);
    const supplierId = await book.createSupplier({ nama: 'Pemasok Titip' });
    await book.receiveDelivery({
      supplierId,
      lines: [
        { varianId: ids.Tepung, qty: 2, settlement: 'tunai', hargaBeli: 3_000 },
        { varianId: ids.Tepung, qty: 5, settlement: 'titip', hargaBeli: 3_000 },
      ],
    });

    // Three sold: the two owned units go first, then one titip unit.
    await ledger.recordSale([{ varianId: ids.Tepung, qty: 3 }], paid(30_000));

    expect(stockOf(await ledger.events(), ids.Tepung).stock).toEqual({ kind: 'counted', qty: 0 });
    expect(titipStockOf(await ledger.events(), ids.Tepung)).toBe(4);
    expect(supplierPayable(await ledger.events(), supplierId).total).toBe(3_000);

    // Four more: all titip, so the debt grows by 4 × 3.000.
    await ledger.recordSale([{ varianId: ids.Tepung, qty: 4 }], paid(40_000));

    expect(titipStockOf(await ledger.events(), ids.Tepung)).toBe(0);
    expect(supplierPayable(await ledger.events(), supplierId)).toEqual({
      tempo: 0,
      titip: 15_000,
      paid: 0,
      total: 15_000,
    });
  });

  it('creates no debt for a sale of the shop’s own goods', async () => {
    const { ledger, ids, book } = await shopWith(['Tepung']);
    const supplierId = await book.createSupplier({ nama: 'Pemasok Tunai' });
    await book.receiveDelivery({
      supplierId,
      lines: [{ varianId: ids.Tepung, qty: 5, settlement: 'tunai', hargaBeli: 3_000 }],
    });

    await ledger.recordSale([{ varianId: ids.Tepung, qty: 2 }], paid(20_000));

    expect(supplierPayable(await ledger.events(), supplierId).total).toBe(0);
  });
});

describe('returning unsold titip goods', () => {
  it('takes them off consignment stock and moves no money', async () => {
    const { ledger, ids, book } = await shopWith(['Tepung']);
    const supplierId = await book.createSupplier({ nama: 'Pemasok Titip' });
    await book.receiveDelivery({
      supplierId,
      lines: [{ varianId: ids.Tepung, qty: 10, settlement: 'titip', hargaBeli: 5_000 }],
    });

    await book.returnTitip({ supplierId, varianId: ids.Tepung, qty: 4 });

    expect(titipStockOf(await ledger.events(), ids.Tepung)).toBe(6);
    expect(supplierPayable(await ledger.events(), supplierId).total).toBe(0);
    expect(titipStock(await ledger.events(), supplierId)).toEqual([
      { supplierId, varianId: ids.Tepung, qty: 6 },
    ]);
  });
});

describe('paying a supplier', () => {
  it('reduces the total and lets the remainder carry over', async () => {
    const { ledger, ids, book } = await shopWith(['Tepung']);
    const supplierId = await book.createSupplier({ nama: 'Pemasok Campur' });
    await book.receiveDelivery({
      supplierId,
      lines: [
        { varianId: ids.Tepung, qty: 10, settlement: 'tempo', hargaBeli: 10_000 },
        { varianId: ids.Tepung, qty: 4, settlement: 'titip', hargaBeli: 10_000 },
      ],
    });
    await ledger.recordSale([{ varianId: ids.Tepung, qty: 14 }], paid(140_000));

    // 100.000 tempo + 40.000 titip that sold = 140.000.
    await book.paySupplier({ supplierId, amount: 50_000 });

    expect(supplierPayable(await ledger.events(), supplierId)).toEqual({
      tempo: 100_000,
      titip: 40_000,
      paid: 50_000,
      total: 90_000,
    });

    await book.paySupplier({ supplierId, amount: 90_000 });
    expect(supplierPayable(await ledger.events(), supplierId).total).toBe(0);
  });

  it('refuses to pay more than is owed', async () => {
    const { ledger, ids, book } = await shopWith(['Tepung']);
    const supplierId = await book.createSupplier({ nama: 'Pemasok' });
    await book.receiveDelivery({
      supplierId,
      lines: [{ varianId: ids.Tepung, qty: 1, settlement: 'tempo', hargaBeli: 10_000 }],
    });

    await expect(book.paySupplier({ supplierId, amount: 20_000 })).rejects.toThrow(
      'Pembayaran melebihi sisa utang Rp 10.000.',
    );
  });
});
