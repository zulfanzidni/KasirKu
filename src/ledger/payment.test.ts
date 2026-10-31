import { createLedger, type Ledger } from './ledger';
import type { PaymentInput } from './types';
import { MemoryStore } from './memoryStore';
import type { Shop } from './types';

/**
 * Taking cash at the till, at the seam the screens use: put a varian in the
 * log, record a sale with a payment, and read the sale back out of the shop.
 *
 * The expected figures are worked by hand from the spec's order of operations
 * (gross → discount → cash rounding → net → tendered → kembalian), not
 * recomputed with the app's own arithmetic.
 */

describe('taking cash for a sale', () => {
  it('pays an exact multiple of the cash step with no rounding and no kembalian', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });

    const sale = await till.sell([{ varianId: beras, qty: 2 }], { discount: { kind: 'none' }, tendered: 30000 });

    expect(sale.total).toBe(30000);
    expect(sale.payment).toMatchObject({
      method: 'tunai',
      discount: 0,
      rounding: 0,
      net: 30000,
      tendered: 30000,
      kembalian: 0,
    });
  });

  it('rounds the net up to the nearest 500 and hands back the change', async () => {
    const till = await newTill();
    const indomie = await till.varian({ nama: 'Indomie goreng', harga: 3500 });

    // Gross 3 × 3.500 = 10.500, already on the step: nothing to round.
    const exact = await till.sell([{ varianId: indomie, qty: 3 }], { discount: { kind: 'none' }, tendered: 10500 });
    expect(exact.payment?.rounding).toBe(0);
    expect(exact.payment?.net).toBe(10500);

    // Gross 13.350 → pembulatan +150 → net 13.500; 20.000 tendered, kembalian 6.500.
    const telur = await till.varian({ nama: 'Telur', harga: 4450 });
    const sale = await till.sell([{ varianId: telur, qty: 3 }], { discount: { kind: 'none' }, tendered: 20000 });

    expect(sale.total).toBe(13350);
    expect(sale.payment?.rounding).toBe(150);
    expect(sale.payment?.net).toBe(13500);
    expect(sale.payment?.kembalian).toBe(6500);
  });
});

// ---------------------------------------------------------------------------
// A till over an in-memory log, seeded the way the app seeds one.
// ---------------------------------------------------------------------------

interface SeededTill {
  ledger: Ledger;
  store: MemoryStore;
  varian(input: { nama: string; harga: number }): Promise<string>;
  sell(
    lines: { varianId: string; qty: number }[],
    payment: PaymentInput,
  ): Promise<Shop['sales'][number]>;
}

async function newTill(deviceId = 'gawai-uji'): Promise<SeededTill> {
  const store = new MemoryStore();
  const ledger = createLedger(store, deviceId);
  const produkId = await ledger.append('produk.created', { kategoriId: 'kat-sembako', nama: 'Sembako' });

  return {
    ledger,
    store,
    async varian(input) {
      return ledger.append('varian.created', {
        produkId,
        nama: input.nama,
        kode: null,
        satuan: 'pcs',
        jualBy: 'unit',
        harga: input.harga,
      });
    },
    async sell(lines, payment) {
      const saleId = await ledger.recordSale(lines, payment);
      const sale = (await ledger.shop()).sales.find((entry) => entry.id === saleId);
      if (!sale) throw new Error('Penjualan tidak ada di catatan.');
      return sale;
    },
  };
}

