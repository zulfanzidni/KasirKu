import { createLedger, type Ledger } from './ledger';
import { MemoryStore } from './memoryStore';
import { hutangOf } from './hutang';
import type { PaymentInput, Shop } from './types';

/**
 * Hutang, at the seam the screens use: a sale is rung up, a customer is
 * chosen, and the balance is read back off the log. Nothing here stores a
 * balance — every figure is the fold of the events that made it.
 *
 * The amounts are worked by hand from the shop's price list.
 */

describe('a sale paid only in part', () => {
  it('leaves the unpaid remainder as the chosen customer’s hutang', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });
    const ani = await till.pelanggan('Bu Ani');

    // 2 × 15.000 = 30.000; 20.000 handed over leaves 10.000 unpaid.
    const sale = await till.sell([{ varianId: beras, qty: 2 }], {
      discount: { kind: 'none' },
      tendered: 20000,
      pelangganId: ani,
    });

    expect(sale.total).toBe(30000);
    expect(sale.payment?.unpaid).toBe(10000);
    expect(sale.pelangganNama).toBe('Bu Ani');

    const hutang = hutangOf(await till.ledger.events(), ani);
    expect(hutang.state).toEqual({ kind: 'hutang', jumlah: 10000 });
    expect(hutang.entries).toHaveLength(1);
    expect(hutang.entries[0]).toMatchObject({ kind: 'penjualan', jumlah: 10000 });
  });

  it('refuses to save a shortfall with no customer, and says why', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });

    await expect(
      till.ledger.recordSale([{ varianId: beras, qty: 2 }], {
        discount: { kind: 'none' },
        tendered: 20000,
      }),
    ).rejects.toThrow(/hutang.*pilih pelanggan/i);

    // A refusal writes nothing: the log has the varian and no sale.
    expect((await till.ledger.shop()).sales).toHaveLength(0);
  });

  it('records a customer payment as its own event, reducing the balance and joining the history', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });
    const ani = await till.pelanggan('Bu Ani');
    await till.sell([{ varianId: beras, qty: 2 }], { discount: { kind: 'none' }, tendered: 20000, pelangganId: ani });

    // 10.000 owed; she hands over 6.000.
    await till.ledger.catatPembayaranHutang({ pelangganId: ani, jumlah: 6000 });

    const hutang = hutangOf(await till.ledger.events(), ani);
    expect(hutang.state).toEqual({ kind: 'hutang', jumlah: 4000 });
    expect(hutang.entries.map((entry) => entry.kind)).toEqual(['penjualan', 'pembayaran']);
    expect(hutang.entries[1]).toMatchObject({ kind: 'pembayaran', jumlah: 6000, setelah: 4000 });
  });

  it('writes off the rest of the debt as its own event, clearing it without collecting cash', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });
    const ani = await till.pelanggan('Bu Ani');
    await till.sell([{ varianId: beras, qty: 2 }], { discount: { kind: 'none' }, tendered: 20000, pelangganId: ani });

    await till.ledger.hapusBukuHutang({ pelangganId: ani, alasan: 'Barang rusak, tidak jadi ditagih' });

    const hutang = hutangOf(await till.ledger.events(), ani);
    expect(hutang.state).toEqual({ kind: 'lunas' });
    expect(hutang.entries.map((entry) => entry.kind)).toEqual(['penjualan', 'hapusbuku']);
    expect(hutang.entries[1]).toMatchObject({
      kind: 'hapusbuku',
      jumlah: 10000,
      alasan: 'Barang rusak, tidak jadi ditagih',
      setelah: 0,
    });
  });

  it('refuses a write-off with no reason, so a forgotten debt always has an explanation', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });
    const ani = await till.pelanggan('Bu Ani');
    await till.sell([{ varianId: beras, qty: 2 }], { discount: { kind: 'none' }, tendered: 20000, pelangganId: ani });

    await expect(till.ledger.hapusBukuHutang({ pelangganId: ani, alasan: '   ' })).rejects.toThrow(/alasan/i);
    expect(hutangOf(await till.ledger.events(), ani).state).toEqual({ kind: 'hutang', jumlah: 10000 });
  });

  it('shows an overpayment as a credit, never as a hidden negative hutang', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });
    const ani = await till.pelanggan('Bu Ani');
    await till.sell([{ varianId: beras, qty: 2 }], { discount: { kind: 'none' }, tendered: 20000, pelangganId: ani });

    // 10.000 owed; she hands over 15.000, so 5.000 stays with the shop as credit.
    await till.ledger.catatPembayaranHutang({ pelangganId: ani, jumlah: 15000 });

    const hutang = hutangOf(await till.ledger.events(), ani);
    expect(hutang.state).toEqual({ kind: 'kredit', jumlah: 5000 });
    expect(hutang.saldo).toBe(-5000);
    expect(hutang.entries[1]).toMatchObject({ kind: 'pembayaran', jumlah: 15000, setelah: -5000 });
  });

  it('refuses to archive a customer who still owes, and allows it once the debt is settled', async () => {
    const till = await newTill();
    const beras = await till.varian({ nama: 'Beras sania 1 kg', harga: 15000 });
    const ani = await till.pelanggan('Bu Ani');
    await till.sell([{ varianId: beras, qty: 2 }], { discount: { kind: 'none' }, tendered: 20000, pelangganId: ani });

    await expect(till.ledger.arsipkanPelanggan(ani)).rejects.toThrow(/hutang/i);
    expect((await till.ledger.shop()).pelanggan.find((entry) => entry.id === ani)?.archived).toBe(false);

    await till.ledger.hapusBukuHutang({ pelangganId: ani, alasan: 'Sudah tidak ditagih' });
    await till.ledger.arsipkanPelanggan(ani);

    expect((await till.ledger.shop()).pelanggan.find((entry) => entry.id === ani)?.archived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A till over an in-memory log, seeded the way the app seeds one.
// ---------------------------------------------------------------------------

interface SeededTill {
  ledger: Ledger;
  store: MemoryStore;
  varian(input: { nama: string; harga: number }): Promise<string>;
  pelanggan(nama: string): Promise<string>;
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
    async pelanggan(nama) {
      return ledger.tambahPelanggan({ nama });
    },
    async sell(lines, payment) {
      const saleId = await ledger.recordSale(lines, payment);
      const sale = (await ledger.shop()).sales.find((entry) => entry.id === saleId);
      if (!sale) throw new Error('Penjualan tidak ada di catatan.');
      return sale;
    },
  };
}
