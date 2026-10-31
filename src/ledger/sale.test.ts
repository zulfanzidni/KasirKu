import { emptyShop } from './events';
import { createLedger, saleDraft, type SaleLineInput } from './ledger';
import { MemoryStore } from './memoryStore';
import type { PaymentInput, Shop, Varian } from './types';

/** A sale rung up without taking cash yet — what these older tests assert about. */
const tunai: PaymentInput = { discount: { kind: 'none' }, tendered: 0 };

/**
 * The sale the log writes is the nota the cashier read out: the cart's price
 * and the cart's name, not a fresh lookup. A price change after the tap must
 * not move the figure on the nota or on the saved sale.
 */

const varian: Varian = {
  id: 'var-terigu',
  produkId: 'prd-terigu',
  nama: 'Tepung terigu 1 kg',
  kode: 'TLG-1',
  satuan: 'kg',
  jualBy: 'weight',
  harga: 13500,
  archived: false,
};

describe('writing a sale', () => {
  it('writes one line per varian with the quantity, price the nota carried, and total', () => {
    const shop: Shop = { ...emptyShop(), varian: [varian] };

    expect(
      saleDraft([{ varianId: varian.id, qty: 0.25, harga: 16000, nama: 'Tepung terigu 1 kg' }], shop, tunai),
    ).toEqual({
      lines: [
        {
          varianId: varian.id,
          nama: 'Tepung terigu 1 kg',
          satuan: 'kg',
          qty: 0.25,
          harga: 16000,
          jumlah: 4000,
        },
      ],
      total: 4000,
      // 4.000 is already a multiple of 500, so pembulatan is its own zero line.
      payment: {
        method: 'tunai',
        discount: 0,
        cashStep: 500,
        rounding: 0,
        net: 4000,
        tendered: 0,
        kembalian: 0,
        unpaid: 4000,
      },
    });
  });

  it('falls back to the logged varian when the nota gives no price', () => {
    const shop: Shop = { ...emptyShop(), varian: [varian] };

    expect(saleDraft([{ varianId: varian.id, qty: 3 }], shop, tunai).total).toBe(40500);
  });

  it('refuses a line for a varian that is not in the log', () => {
    const shop: Shop = emptyShop();

    expect(() => saleDraft([{ varianId: 'hilang', qty: 1 }], shop, tunai)).toThrow('Varian hilang tidak ditemukan.');
  });
});

/**
 * The ledger records what it is given: two calls are two events. Keeping a
 * double tap from becoming two sales is the screen's job, and the screen
 * tests hold it — this pins that the log does not silently merge or drop.
 */
describe('two saves handed to the ledger', () => {
  it('record two events rather than merging them', async () => {
    const ledger = createLedger(new MemoryStore(), 'gawai-1');
    const varianId = await ledger.append('varian.created', {
      produkId: varian.produkId,
      nama: varian.nama,
      kode: varian.kode,
      satuan: varian.satuan,
      jualBy: varian.jualBy,
      harga: varian.harga,
    });
    const lines: SaleLineInput[] = [{ varianId, qty: 2, harga: 13500 }];

    await ledger.recordSale(lines, tunai);
    await ledger.recordSale(lines, tunai);

    const sales = (await ledger.shop()).sales;
    expect(sales).toHaveLength(2);
    expect(sales[0].id).not.toBe(sales[1].id);
  });
});
