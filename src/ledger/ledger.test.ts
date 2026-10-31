import { createLedger } from './ledger';
import { MemoryStore } from './memoryStore';
/**
 * The product's one promise, written as a test: a sale is written once, and it
 * is still there when the shop is reopened.
 */
describe('a sale survives the app closing', () => {
  it('finds the sale again after a restart', async () => {
    // One store stands in for the phone's disk: a restart keeps it, and
    // throws away every piece of in-memory state the app had.
    const disk = new MemoryStore();

    const before = createLedger(disk, 'gawai-1');
    const varianId = await before.append('varian.created', {
      produkId: 'prd-1',
      nama: 'Tepung terigu 1 kg',
      kode: 'TLG-1',
      satuan: 'kg',
      jualBy: 'weight',
      harga: 13500,
    });

    const saleId = await before.recordSale([{ varianId, qty: 3 }], { discount: { kind: 'none' }, tendered: 40500 });

    const reopened = createLedger(disk, 'gawai-1');
    const shop = await reopened.shop();

    expect(shop.sales.map((sale) => sale.id)).toEqual([saleId]);
    expect(shop.sales[0].total).toBe(40500);
    expect(shop.sales[0].lines).toEqual([
      { varianId, nama: 'Tepung terigu 1 kg', satuan: 'kg', qty: 3, harga: 13500, jumlah: 40500 },
    ]);
  });
});

