import { baselineLabel, cashCounts, cashDrawer } from './kas';
import { createLedger } from './ledger';
import { MemoryStore } from './memoryStore';
import type { PaymentInput } from './types';

/**
 * The drawer, read only through the ledger seam. Expected cash is a fold of
 * every event that moved money, never a stored balance: a float, a sale, a
 * customer payment, a supplier payment, an expense, a withdrawal, a deposit.
 *
 * The baseline is the last thing that said "the drawer held this much": a
 * declared opening float, or a previous count. The tests state which one the
 * answer used, because a difference the owner cannot explain is one they ignore.
 */

const paid = (rupiah: number): PaymentInput => ({ discount: { kind: 'none' }, tendered: rupiah });

async function shopWithVarian() {
  const ledger = createLedger(new MemoryStore(), 'gawai-1');
  const kategoriId = await ledger.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ledger.append('produk.created', { kategoriId, nama: 'Tepung terigu' });
  const varianId = await ledger.append('varian.created', {
    produkId,
    nama: 'Tepung terigu 1 kg',
    kode: null,
    satuan: 'kg',
    jualBy: 'weight',
    harga: 10_000,
  });
  return { ledger, varianId };
}

describe('kas di laci', () => {
  it('a cash expense lowers expected cash from the declared float', async () => {
    const ledger = createLedger(new MemoryStore(), 'gawai-1');
    await ledger.setOpeningFloat({ jumlah: 200_000 });
    await ledger.recordCashMovement({ kind: 'expense', jumlah: 25_000, keterangan: 'Listrik' });

    const drawer = cashDrawer(await ledger.events());

    expect(drawer.expected).toBe(175_000);
    expect(drawer.baseline).toMatchObject({ kind: 'float', jumlah: 200_000 });
    expect(drawer.pengeluaran).toBe(25_000);
  });

  it('counts every movement, and only the cash a sale actually took', async () => {
    const { ledger, varianId } = await shopWithVarian();
    await ledger.setOpeningFloat({ jumlah: 100_000 });

    // 20.000 sold and paid in full.
    await ledger.recordSale([{ varianId, qty: 2 }], paid(20_000));
    // 20.000 sold, 5.000 handed over, 15.000 became hutang.
    const pelangganId = await ledger.tambahPelanggan({ nama: 'Bu Ani' });
    await ledger.recordSale([{ varianId, qty: 2 }], {
      discount: { kind: 'none' },
      tendered: 5_000,
      pelangganId,
    });
    // The hutang is paid down in cash.
    await ledger.catatPembayaranHutang({ pelangganId, jumlah: 4_000 });
    // A supplier is paid, the takings are banked, and money is put in.
    await ledger.append('payable.paid', { supplierId: 'sup-1', amount: 30_000 });
    await ledger.recordCashMovement({ kind: 'withdrawn', jumlah: 50_000, keterangan: 'Setor ke bank' });
    await ledger.recordCashMovement({ kind: 'deposited', jumlah: 10_000 });

    const drawer = cashDrawer(await ledger.events());

    expect(drawer.penjualan).toBe(25_000);
    expect(drawer.hutang).toBe(4_000);
    expect(drawer.setor).toBe(10_000);
    expect(drawer.pemasok).toBe(30_000);
    expect(drawer.tarik).toBe(50_000);
    expect(drawer.expected).toBe(100_000 + 25_000 + 4_000 + 10_000 - 30_000 - 50_000);
  });
});

describe('patokan hitung kas', () => {
  it('with no float, the previous count becomes the baseline and is named', async () => {
    const { ledger, varianId } = await shopWithVarian();
    await ledger.recordSale([{ varianId, qty: 3 }], paid(30_000));
    // First count: 30.000 expected, 28.000 found. Nothing was declared before.
    await ledger.countCash({ counted: 28_000 });
    // A sale after the count starts from what the count found.
    await ledger.recordSale([{ varianId, qty: 1 }], paid(10_000));

    const drawer = cashDrawer(await ledger.events());
    expect(drawer.baseline).toMatchObject({ kind: 'count', jumlah: 28_000 });
    expect(drawer.expected).toBe(38_000);
    expect(baselineLabel(drawer.baseline)).toBe('Patokan: hitung terakhir Rp 28.000');

    // The second count compares against the first, and says so.
    await ledger.countCash({ counted: 35_000 });
    const [latest, first] = cashCounts(await ledger.events());

    expect(latest).toMatchObject({ expected: 38_000, counted: 35_000, difference: -3_000, baseline: 'count' });
    expect(first).toMatchObject({ expected: 30_000, counted: 28_000, difference: -2_000, baseline: 'nol' });
  });

  it('an explicit float supersedes the previous count', async () => {
    const { ledger, varianId } = await shopWithVarian();
    await ledger.recordSale([{ varianId, qty: 3 }], paid(30_000));
    await ledger.countCash({ counted: 30_000 });
    await ledger.setOpeningFloat({ jumlah: 200_000 });

    const drawer = cashDrawer(await ledger.events());
    expect(drawer.baseline).toMatchObject({ kind: 'float', jumlah: 200_000 });
    expect(drawer.expected).toBe(200_000);
    expect(baselineLabel(drawer.baseline)).toBe('Patokan: kas awal Rp 200.000');
  });

  it('before any float or count it says there is no baseline rather than assuming one', () => {
    const drawer = cashDrawer([]);

    expect(drawer.baseline).toBeNull();
    expect(drawer.expected).toBe(0);
    expect(baselineLabel(drawer.baseline)).toBe('Patokan: belum ada — dihitung dari nol');
  });

  it('records the count beside the expected figure and the baseline it used', async () => {
    const { ledger, varianId } = await shopWithVarian();
    await ledger.setOpeningFloat({ jumlah: 100_000 });
    await ledger.recordSale([{ varianId, qty: 5 }], paid(50_000));
    await ledger.countCash({ counted: 145_000, catatan: 'Uang kembalian terselip' });

    const [count] = cashCounts(await ledger.events());
    expect(count).toMatchObject({
      expected: 150_000,
      counted: 145_000,
      difference: -5_000,
      baseline: 'float',
      catatan: 'Uang kembalian terselip',
    });
    // The count is now the baseline for the next comparison.
    expect(cashDrawer(await ledger.events()).baseline).toMatchObject({ kind: 'count', jumlah: 145_000 });
  });
});
