import { createLedger, type Ledger } from './ledger';
import { MemoryStore } from './memoryStore';
import { receiptOf } from './receipt';
import type { Shop } from './types';

/**
 * The receipt is the paper the customer takes away, so the figures on it are
 * what the tests read: a sale is rung up, a receipt is built from the sale
 * that was written, and the lines on the paper are checked against the total
 * printed beneath them.
 *
 * The expected amounts are worked by hand from the shop's price list, never
 * recomputed with the app's arithmetic.
 */

describe('the receipt for a sale', () => {
  it('prints its lines and adds up exactly to the total printed beneath them', async () => {
    const till = await newTill();
    const telur = await till.add({ nama: 'Telur', harga: 4450 });

    // Gross 4.450 − discount 1.200 = 3.250 → pembulatan +250 → 3.500 paid
    // in cash; 10.000 tendered leaves 6.500 kembalian.
    const sale = await till.sell([{ varianId: telur, qty: 1 }], {
      discount: { kind: 'rupiah', value: 1200 },
      tendered: 10000,
    });

    const nota = receiptOf(sale);

    expect(nota.lines).toEqual([{ label: 'Telur', qty: '×1', amount: 4450 }]);
    expect(nota.discount).toBe(1200);
    expect(nota.rounding).toBe(250);
    expect(nota.total).toBe(3500);
    // 4.450 − 1.200 + 250 = 3.500, the figure printed as the total.
    expect(sumPrinted(nota)).toBe(nota.total);
    expect(nota.tendered).toBe(10000);
    expect(nota.kembalian).toBe(6500);
  });

  it('prints two variants of the same product as two separate lines', async () => {
    const till = await newTill();
    const produkId = await till.addProduk('Tepung terigu');
    const kg1 = await till.add({ nama: 'Tepung terigu 1 kg', harga: 13500, produkId, satuan: 'kg', jualBy: 'weight' });
    const kg2 = await till.add({ nama: 'Tepung terigu 2 kg', harga: 26000, produkId, satuan: 'kg', jualBy: 'weight' });

    const sale = await till.sell(
      [
        { varianId: kg1, qty: 1 },
        { varianId: kg2, qty: 1 },
      ],
      { discount: { kind: 'none' }, tendered: 40000 },
    );

    const nota = receiptOf(sale);

    expect(nota.lines.map((line) => line.label)).toEqual(['Tepung terigu 1 kg', 'Tepung terigu 2 kg']);
    // 39.500 is on the step: no pembulatan; 40.000 tendered leaves 500.
    expect(nota.rounding).toBe(0);
    expect(nota.total).toBe(39500);
    expect(nota.kembalian).toBe(500);
    expect(sumPrinted(nota)).toBe(nota.total);
  });
});

// ---------------------------------------------------------------------------

function sumPrinted(nota: ReturnType<typeof receiptOf>): number {
  const goods = nota.lines.reduce((sum, line) => sum + line.amount, 0);
  return goods - nota.discount + nota.rounding;
}

interface Till {
  ledger: Ledger;
  addProduk(nama: string): Promise<string>;
  add(input: {
    nama: string;
    harga: number;
    produkId?: string;
    satuan?: 'pcs' | 'kg';
    jualBy?: 'unit' | 'weight';
  }): Promise<string>;
  sell(
    lines: { varianId: string; qty: number }[],
    payment: { discount: { kind: 'none' } | { kind: 'rupiah'; value: number }; tendered: number },
  ): Promise<Shop['sales'][number]>;
}

async function newTill(): Promise<Till> {
  const ledger = createLedger(new MemoryStore(), 'gawai-uji');
  const produkId = await ledger.append('produk.created', { kategoriId: 'kat-sembako', nama: 'Sembako' });
  return {
    ledger,
    addProduk: (nama) => ledger.append('produk.created', { kategoriId: 'kat-sembako', nama }),
    add: ({ nama, harga, produkId: produk = produkId, satuan = 'pcs', jualBy = 'unit' }) =>
      ledger.append('varian.created', { produkId: produk, nama, kode: null, satuan, jualBy, harga }),
    async sell(lines, payment) {
      const id = await ledger.recordSale(lines, payment);
      const sale = (await ledger.shop()).sales.find((entry) => entry.id === id);
      if (!sale) throw new Error('Penjualan tidak ada di catatan.');
      return sale;
    },
  };
}
