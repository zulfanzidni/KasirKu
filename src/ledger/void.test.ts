import { sumSales } from './events';
import { hutangOf } from './hutang';
import { cashDrawer } from './kas';
import { createLedger, type Ledger } from './ledger';
import { MemoryStore } from './memoryStore';
import { liveSales } from './queries';
import { receiptOf } from './receipt';
import { receiptHtml } from './receiptHtml';
import { stockOf, titipStockOf } from './stock';
import { supplierPayable } from './suppliers';
import type { PaymentInput } from './types';

/**
 * Voiding a sale, in the shop's terms (ADR 0001).
 *
 * A void is an appended event, never a deletion: the original sale stays in
 * the log and in Riwayat, and every derived figure cancels it. Re-ringing is
 * just a new sale, so a correction never inflates the day.
 */

const paid = (rupiah: number): PaymentInput => ({ discount: { kind: 'none' }, tendered: rupiah });

async function newTill() {
  const ledger = createLedger(new MemoryStore(), 'gawai-uji');
  const produkId = await ledger.append('produk.created', { kategoriId: 'kat', nama: 'Sembako' });
  const varianId = await ledger.append('varian.created', {
    produkId,
    nama: 'Indomie goreng',
    kode: null,
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
  return { ledger, varianId };
}

describe('membatalkan penjualan', () => {
  it('a voided sale stops counting, and the re-rung sale counts once', async () => {
    const { ledger, varianId } = await newTill();

    const first = await ledger.recordSale([{ varianId, qty: 2 }], paid(7_000));
    await ledger.voidSale({ saleId: first, alasan: 'Salah input' });
    const second = await ledger.recordSale([{ varianId, qty: 1 }], paid(3_500));

    const shop = await ledger.shop();

    // Nothing was deleted: both sales are still in the log.
    expect(shop.sales).toHaveLength(2);
    expect(shop.sales.find((sale) => sale.id === first)?.voided).toBe(true);
    expect(shop.sales.find((sale) => sale.id === first)?.voidReason).toBe('Salah input');

    // The voided sale no longer counts; the replacement counts once.
    expect(liveSales(shop).map((sale) => sale.id)).toEqual([second]);
    expect(sumSales(liveSales(shop))).toBe(3_500);
  });

  it('a voided sale gives its stock back, and the replacement takes it once', async () => {
    const { ledger, varianId } = await newTill();
    await ledger.recordOpeningStock({ varianId, qty: 10 });

    const first = await ledger.recordSale([{ varianId, qty: 3 }], paid(10_500));
    expect(stockOf(await ledger.events(), varianId).stock).toEqual({ kind: 'counted', qty: 7 });

    await ledger.voidSale({ saleId: first, alasan: 'Barang dikembalikan' });
    expect(stockOf(await ledger.events(), varianId).stock).toEqual({ kind: 'counted', qty: 10 });

    await ledger.recordSale([{ varianId, qty: 2 }], paid(7_000));
    expect(stockOf(await ledger.events(), varianId).stock).toEqual({ kind: 'counted', qty: 8 });
  });

  it('a voided sale cancels the debt it created, and a repayment stays as a credit', async () => {
    const { ledger, varianId } = await newTill();
    const pelangganId = await ledger.tambahPelanggan({ nama: 'Bu Ani' });

    // 7.000 sold, 3.500 handed over: 3.500 becomes Bu Ani's hutang.
    const saleId = await ledger.recordSale([{ varianId, qty: 2 }], {
      discount: { kind: 'none' },
      tendered: 3_500,
      pelangganId,
    });
    expect(hutangOf(await ledger.events(), pelangganId).state).toEqual({ kind: 'hutang', jumlah: 3_500 });

    // She pays 1.500 of it, then the sale is voided.
    await ledger.catatPembayaranHutang({ pelangganId, jumlah: 1_500 });
    await ledger.voidSale({ saleId, alasan: 'Salah pelanggan' });

    const hutang = hutangOf(await ledger.events(), pelangganId);
    // The debt is gone; the money she actually handed over is a credit.
    expect(hutang.state).toEqual({ kind: 'kredit', jumlah: 1_500 });
    expect(hutang.entries.some((entry) => entry.kind === 'pembayaran' && entry.jumlah === 1_500)).toBe(true);
  });

  it('a voided sale takes its cash back out of the drawer', async () => {
    const { ledger, varianId } = await newTill();
    await ledger.setOpeningFloat({ jumlah: 100_000 });
    const saleId = await ledger.recordSale([{ varianId, qty: 2 }], paid(7_000));

    expect(cashDrawer(await ledger.events()).expected).toBe(107_000);

    await ledger.voidSale({ saleId, alasan: 'Salah input' });
    const drawer = cashDrawer(await ledger.events());

    // The sale happened, and its refund cancels it, so the drawer is back to
    // the float. Both are shown, because the owner handed the money back.
    expect(drawer.expected).toBe(100_000);
    expect(drawer.penjualan).toBe(7_000);
    expect(drawer.pembatalan).toBe(7_000);
  });

  it('a voided sale’s receipt is marked as voided when it is re-shared', async () => {
    const { ledger, varianId } = await newTill();
    const saleId = await ledger.recordSale([{ varianId, qty: 2 }], paid(7_000));
    await ledger.voidSale({ saleId, alasan: 'Barang dikembalikan' });

    const sale = (await ledger.shop()).sales.find((entry) => entry.id === saleId)!;
    const nota = receiptOf(sale);

    expect(nota.voided).toBe(true);
    expect(nota.voidReason).toBe('Barang dikembalikan');

    const paper = receiptHtml(nota);
    // The number the customer holds is still on the paper, so it is traceable,
    // and the paper cannot claim the cancelled sale still stands.
    expect(paper).toContain(sale.number);
    expect(paper).toContain('DIBATALKAN');
    expect(paper).toContain('Barang dikembalikan');
  });

  it('a voided titip sale cancels what the shop owes the supplier', async () => {
    const { ledger, varianId } = await newTill();
    const supplierId = await ledger.append('supplier.created', { nama: 'CV Sumber Rejeki', telepon: null });
    await ledger.append('stock.received', {
      varianId,
      qty: 10,
      settlement: 'titip',
      supplierId,
      hargaBeli: 1_000,
    });

    const saleId = await ledger.recordSale([{ varianId, qty: 4 }], paid(14_000));
    // Four titip units sold: the shop owes 4.000 and six are still on the shelf.
    expect(supplierPayable(await ledger.events(), supplierId).total).toBe(4_000);
    expect(titipStockOf(await ledger.events(), varianId)).toBe(6);

    await ledger.voidSale({ saleId, alasan: 'Barang dikembalikan' });

    // The units are back on the shelf and the debt they created is gone.
    expect(supplierPayable(await ledger.events(), supplierId).total).toBe(0);
    expect(titipStockOf(await ledger.events(), varianId)).toBe(10);
  });

  it('refuses a void with no reason, and a second void of the same sale', async () => {
    const { ledger, varianId } = await newTill();
    const saleId = await ledger.recordSale([{ varianId, qty: 1 }], paid(3_500));

    await expect(ledger.voidSale({ saleId, alasan: '   ' })).rejects.toThrow(/alasan/i);
    await ledger.voidSale({ saleId, alasan: 'Salah input' });
    await expect(ledger.voidSale({ saleId, alasan: 'Sekali lagi' })).rejects.toThrow(/sudah dibatalkan/i);

    // Nothing was deleted: the original sale is still in the log.
    expect((await ledger.events()).filter((event) => event.type === 'sale.completed')).toHaveLength(1);
  });

  it('a second void of the same sale changes nothing', async () => {
    const { ledger, varianId } = await newTill();
    await ledger.recordOpeningStock({ varianId, qty: 10 });
    await ledger.setOpeningFloat({ jumlah: 100_000 });
    const saleId = await ledger.recordSale([{ varianId, qty: 3 }], paid(10_500));

    await ledger.voidSale({ saleId, alasan: 'Salah input' });
    // The other phone voided the same sale too; sync brings its event in.
    await ledger.append('sale.voided', { saleId, alasan: 'Salah input juga' });

    expect(stockOf(await ledger.events(), varianId).stock).toEqual({ kind: 'counted', qty: 10 });
    expect(cashDrawer(await ledger.events()).expected).toBe(100_000);
    expect(cashDrawer(await ledger.events()).pembatalan).toBe(10_500);
  });
});
