import { createLedger, type Ledger } from './ledger';
import { MemoryStore } from './memoryStore';
import { dayStamp } from './saleNumber';

/**
 * Two phones selling on the same day, offline, never talking to each other.
 *
 * The sale's identity is its UUID; the number on the receipt is only for a
 * person to find a sale by. So the test is the customer's question — "can two
 * receipts that day carry the same number?" — asked of two independent logs.
 */

describe('two phones selling on the same day', () => {
  it('give their sales different numbers, and every sale keeps its own UUID as its key', async () => {
    const left = await newPhone('3f2a9c11-6b7e-4a2f-9a55-0e1d2c3b4a5f');
    const right = await newPhone('b81e7d42-0c9a-4d33-8f10-77aa2e4c9d61');

    const leftOne = await left.sell();
    const rightOne = await right.sell();
    const leftTwo = await left.sell();

    const numbers = [leftOne.number, rightOne.number, leftTwo.number];
    expect(new Set(numbers).size).toBe(3);
    expect(new Set([leftOne.id, rightOne.id, leftTwo.id]).size).toBe(3);

    // Readable: the day it happened, the phone that rang it, and the event's
    // place in that phone's log. The day is read from the clock, not written
    // into the test: a hardcoded date passes on exactly one day of the year.
    const today = dayStamp(new Date().toISOString());
    expect(numbers).toEqual([
      expect.stringMatching(new RegExp(`^${today}-3F2A-\\d{3}$`)),
      expect.stringMatching(new RegExp(`^${today}-B81E-\\d{3}$`)),
      expect.stringMatching(new RegExp(`^${today}-3F2A-\\d{3}$`)),
    ]);
    // The two phones are told apart by their own segment, not by a sequence;
    // the same phone's two sales sort in the order they were rung.
    expect(leftOne.number.slice(0, 12)).toBe(leftTwo.number.slice(0, 12));
    expect(leftOne.number < leftTwo.number).toBe(true);
  });
});

async function newPhone(deviceId: string) {
  const ledger: Ledger = createLedger(new MemoryStore(), deviceId);
  const varianId = await ledger.append('varian.created', {
    produkId: 'prd-indomie',
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });

  return {
    async sell() {
      const id = await ledger.recordSale([{ varianId, qty: 1 }], { discount: { kind: 'none' }, tendered: 3500 });
      const sale = (await ledger.shop()).sales.find((entry) => entry.id === id);
      if (!sale) throw new Error('Penjualan tidak ada di catatan.');
      return sale;
    },
  };
}
