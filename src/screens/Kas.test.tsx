import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasScreen } from '@/screens/Kas';
import { KasirScreen } from '@/screens/Kasir';
import { PelangganScreen } from '@/screens/Pelanggan';
import { PemasokScreen } from '@/screens/Pemasok';
import type { Discount } from '@/design';
import type { StoredEvent } from '@/ledger/store';
import { app, mockPhone, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Kas and Tutup Toko, driven the way the owner drives them: record what left
 * the drawer and what went in, declare a float, count the cash, read the day's
 * figures, and carry on selling afterwards.
 *
 * Every assertion is what the screen shows, in the shop's own words.
 */

let mounted = false;

beforeEach(() => {
  resetPhone();
  mounted = false;
});

async function openKas() {
  if (mounted) screen.unmount();
  mounted = true;
  render(wrap(<KasScreen />));
  return waitReady(act);
}

async function seedVarian(nama = 'Tepung terigu 1 kg', harga = 10_000) {
  const ledger = phoneLedger();
  const kategoriId = await ledger.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ledger.append('produk.created', { kategoriId, nama: 'Tepung terigu' });
  return ledger.append('varian.created', {
    produkId,
    nama,
    kode: null,
    satuan: 'kg',
    jualBy: 'weight',
    harga,
  });
}

/** A sale written through the real ledger, before the screen opens. */
async function seedSale(
  varianId: string,
  qty: number,
  tendered: number,
  options: { discount?: Discount; pelangganId?: string } = {},
) {
  return phoneLedger().recordSale([{ varianId, qty }], {
    discount: options.discount ?? { kind: 'none' },
    tendered,
    pelangganId: options.pelangganId,
  });
}

async function seedCount(at: string, payload: Record<string, unknown>) {
  const { id, seq } = await mockPhone.store.nextIdentity();
  await mockPhone.store.append([
    { id, deviceId: 'gawai-uji', seq, createdAt: at, type: 'cash.counted', payload } as StoredEvent,
  ]);
}

async function recordExpense(jumlah: string, keterangan: string) {
  fireEvent.press(screen.getByTestId('catat-pengeluaran'));
  await act(async () => {});
  fireEvent.changeText(screen.getByTestId('pengeluaran-jumlah'), jumlah);
  fireEvent.changeText(screen.getByTestId('pengeluaran-keterangan'), keterangan);
  fireEvent.press(screen.getByTestId('simpan-pengeluaran'));
  await act(async () => {});
}

async function recordWithdrawal(jumlah: string, keterangan = '') {
  fireEvent.press(screen.getByTestId('tarik-uang'));
  await act(async () => {});
  fireEvent.changeText(screen.getByTestId('tarik-jumlah'), jumlah);
  if (keterangan) fireEvent.changeText(screen.getByTestId('tarik-keterangan'), keterangan);
  fireEvent.press(screen.getByTestId('simpan-tarik'));
  await act(async () => {});
}

async function recordDeposit(jumlah: string) {
  fireEvent.press(screen.getByTestId('setor-uang'));
  await act(async () => {});
  fireEvent.changeText(screen.getByTestId('setor-jumlah'), jumlah);
  fireEvent.press(screen.getByTestId('simpan-setor'));
  await act(async () => {});
}

async function declareFloat(jumlah: string) {
  fireEvent.press(screen.getByTestId('nyatakan-kas-awal'));
  await act(async () => {});
  fireEvent.changeText(screen.getByTestId('float-jumlah'), jumlah);
  fireEvent.press(screen.getByTestId('simpan-float'));
  await act(async () => {});
}

/** Opens the count sheet, types what was found, and saves. */
async function countCash(jumlah: string, via: 'hitung-kas' | 'tutup-hitung' = 'hitung-kas') {
  fireEvent.press(screen.getByTestId(via));
  await act(async () => {});
  fireEvent.changeText(screen.getByTestId('hitung-jumlah'), jumlah);
  fireEvent.press(screen.getByTestId('simpan-hitung'));
  await act(async () => {});
}

describe('Kas — uang masuk dan keluar', () => {
  it('records an expense, a withdrawal and a deposit, each changing expected cash', async () => {
    await openKas();

    await declareFloat('200.000');
    expect(screen.getByTestId('kas-patokan')).toHaveTextContent('Patokan: kas awal Rp 200.000');
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/200\.000/);

    await recordExpense('25.000', 'Listrik');
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/175\.000/);
    expect(screen.getByTestId('kas-pengeluaran')).toHaveTextContent(/−Rp 25\.000/);

    await recordWithdrawal('50.000', 'Setor ke bank');
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/125\.000/);
    expect(screen.getByTestId('kas-tarik')).toHaveTextContent(/−Rp 50\.000/);

    await recordDeposit('100.000');
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/225\.000/);
    expect(screen.getByTestId('kas-setor')).toHaveTextContent(/Rp 100\.000/);
  });

  it('refuses an expense with no reason, because an unexplained outflow makes the count useless', async () => {
    await openKas();

    fireEvent.press(screen.getByTestId('catat-pengeluaran'));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('pengeluaran-jumlah'), '25.000');
    fireEvent.press(screen.getByTestId('simpan-pengeluaran'));
    await act(async () => {});

    expect(screen.getByTestId('pengeluaran-jumlah')).toBeTruthy();
    expect(screen.getByText(/Keterangan wajib diisi/)).toBeTruthy();
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/Kas yang seharusnya0/);
  });
});

describe('Kas — kas awal', () => {
  it('declaring an opening float sets the baseline expected cash folds from', async () => {
    const varianId = await seedVarian();
    await seedSale(varianId, 3, 30_000);
    await openKas();

    // Before a float, the screen says plainly that there is no baseline.
    expect(screen.getByTestId('kas-patokan')).toHaveTextContent(/Patokan: belum ada/);
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/30\.000/);

    // Declaring a float supersedes the earlier cash: it says what is in the
    // drawer now, so only movements after it are folded.
    await declareFloat('100.000');

    expect(screen.getByTestId('kas-patokan')).toHaveTextContent('Patokan: kas awal Rp 100.000');
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/100\.000/);
  });
});

describe('Kas — pembayaran pemasok dan hutang', () => {
  it('paying a supplier takes cash out, and a customer payment puts cash in', async () => {
    const varianId = await seedVarian();
    const ledger = phoneLedger();
    const pelangganId = await ledger.append('pelanggan.created', { nama: 'Bu Ani', telepon: null });
    const supplierId = await ledger.append('supplier.created', { nama: 'CV Sumber Rejeki', telepon: null });
    // 20.000 sold, 5.000 handed over, 15.000 becomes hutang.
    await seedSale(varianId, 2, 5_000, { pelangganId });
    // A tempo delivery creates 10.000 owed to the supplier.
    await ledger.append('stock.received', {
      varianId,
      qty: 10,
      settlement: 'tempo',
      supplierId,
      hargaBeli: 1_000,
    });

    // Receive a hutang payment on the customer screen.
    render(wrap(<PelangganScreen />));
    mounted = true;
    await waitReady(act);
    fireEvent.press(screen.getByTestId(`pelanggan-baris-${pelangganId}`));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('catat-pembayaran'));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('bayar-hutang-jumlah'), '4.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran-hutang'));
    await act(async () => {});

    // Pay part of the supplier payable on the supplier screen.
    screen.unmount();
    render(wrap(<PemasokScreen />));
    await waitReady(act);
    fireEvent.press(screen.getByTestId(`bayar-${supplierId}`));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('bayar-jumlah'), '4.000');
    fireEvent.press(screen.getByTestId('simpan-bayar'));
    await act(async () => {});

    await openKas();
    // 5.000 cash from the sale + 4.000 hutang payment − 4.000 paid to supplier.
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/5\.000/);
    expect(screen.getByTestId('kas-penjualan')).toHaveTextContent(/Rp 5\.000/);
    expect(screen.getByTestId('kas-hutang')).toHaveTextContent(/Rp 4\.000/);
    expect(screen.getByTestId('kas-pemasok')).toHaveTextContent(/−Rp 4\.000/);
  });
});

describe('Kas — penjualan dibatalkan', () => {
  it('a voided sale takes its cash back out of the drawer, and the screen says why', async () => {
    const varianId = await seedVarian();
    const saleId = await seedSale(varianId, 3, 30_000);
    await openKas();

    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/30\.000/);

    await act(async () => app.voidSale({ saleId, alasan: 'Salah input' }));

    // The sale is still shown, and the refund cancels it: the drawer is empty.
    expect(screen.getByTestId('kas-penjualan')).toHaveTextContent(/Rp 30\.000/);
    expect(screen.getByTestId('kas-pembatalan')).toHaveTextContent(/−Rp 30\.000/);
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/Kas yang seharusnya0/);
  });
});

describe('Kas — hitung kas', () => {
  it('shows the difference against expected and names the baseline used', async () => {
    const varianId = await seedVarian();
    await phoneLedger().setOpeningFloat({ jumlah: 200_000 });
    await seedSale(varianId, 3, 30_000);

    await openKas();
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/230\.000/);

    fireEvent.press(screen.getByTestId('hitung-kas'));
    await act(async () => {});
    expect(screen.getByTestId('hitung-patokan')).toHaveTextContent('Patokan: kas awal Rp 200.000');

    fireEvent.changeText(screen.getByTestId('hitung-jumlah'), '225.000');
    expect(screen.getByTestId('hitung-selisih')).toHaveTextContent('Selisih kurang Rp 5.000');

    fireEvent.press(screen.getByTestId('simpan-hitung'));
    await act(async () => {});

    expect(screen.getByTestId('hitung-baris-0')).toHaveTextContent(
      /Seharusnya Rp 230\.000 · Dihitung Rp 225\.000 · Selisih kurang Rp 5\.000 · Patokan kas awal/,
    );
  });

  it('with no declared float, compares against the previous count and says so', async () => {
    const varianId = await seedVarian();
    await seedSale(varianId, 3, 30_000);
    await openKas();

    // First count: 30.000 expected, 28.000 found. There was no baseline.
    fireEvent.press(screen.getByTestId('hitung-kas'));
    await act(async () => {});
    expect(screen.getByTestId('hitung-patokan')).toHaveTextContent(/Patokan: belum ada/);
    fireEvent.changeText(screen.getByTestId('hitung-jumlah'), '28.000');
    expect(screen.getByTestId('hitung-selisih')).toHaveTextContent('Selisih kurang Rp 2.000');
    fireEvent.press(screen.getByTestId('simpan-hitung'));
    await act(async () => {});

    // The count becomes the next baseline.
    expect(screen.getByTestId('kas-patokan')).toHaveTextContent('Patokan: hitung terakhir Rp 28.000');
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/28\.000/);

    // A later sale is folded on top of the count, not on top of zero.
    await seedSale(varianId, 1, 10_000);
    await openKas();
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/38\.000/);
    expect(screen.getByTestId('kas-patokan')).toHaveTextContent('Patokan: hitung terakhir Rp 28.000');

    fireEvent.press(screen.getByTestId('hitung-kas'));
    await act(async () => {});
    expect(screen.getByTestId('hitung-patokan')).toHaveTextContent('Patokan: hitung terakhir Rp 28.000');
    fireEvent.changeText(screen.getByTestId('hitung-jumlah'), '35.000');
    expect(screen.getByTestId('hitung-selisih')).toHaveTextContent('Selisih kurang Rp 3.000');
    fireEvent.press(screen.getByTestId('simpan-hitung'));
    await act(async () => {});

    expect(screen.getByTestId('hitung-baris-0')).toHaveTextContent(
      /Seharusnya Rp 38\.000 · Dihitung Rp 35\.000 · Selisih kurang Rp 3\.000 · Patokan hitung terakhir/,
    );
  });
});

describe('Kas — Tutup Toko', () => {
  it('lists the day’s sales, discount total and expected cash, and offers a count', async () => {
    const varianId = await seedVarian();
    // 50.000 sold, 5.000 discounted: the customer was charged 45.000.
    await seedSale(varianId, 5, 45_000, { discount: { kind: 'rupiah', value: 5_000 } });
    await openKas();

    expect(screen.getByTestId('tutup-penjualan')).toHaveTextContent(/Rp 45\.000/);
    expect(screen.getByTestId('tutup-diskon')).toHaveTextContent(/Rp 5\.000/);
    expect(screen.getByTestId('tutup-expected')).toHaveTextContent(/Rp 45\.000/);

    fireEvent.press(screen.getByTestId('tutup-hitung'));
    await act(async () => {});
    expect(screen.getByTestId('form-hitung')).toBeTruthy();
    expect(screen.getByTestId('hitung-expected')).toHaveTextContent(/Kas yang seharusnya/);
    expect(screen.getByTestId('hitung-expected')).toHaveTextContent(/45\.000/);
  });

  it('selling after Tutup Toko is still possible; the day is not locked', async () => {
    const varianId = await seedVarian();
    await openKas();

    // Close the day with an empty drawer.
    await countCash('0', 'tutup-hitung');
    expect(screen.getByTestId('hitung-baris-0')).toBeTruthy();

    // A late customer is served at the till, exactly as before.
    screen.unmount();
    mounted = true;
    render(wrap(<KasirScreen />));
    await waitReady(act);
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    await act(async () => app.saveSale({ discount: { kind: 'none' }, tendered: 10_000 }, [{ varianId, qty: 1 }]));

    await openKas();
    expect(screen.getByTestId('tutup-penjualan')).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/10\.000/);
  });

  it('lists past counts with expected, counted and the difference', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await seedCount(yesterday.toISOString(), {
      counted: 90_000,
      expected: 100_000,
      difference: -10_000,
      baseline: 'float',
      baselineJumlah: 50_000,
      baselineAt: yesterday.toISOString(),
      catatan: null,
    });
    await seedCount(now.toISOString(), {
      counted: 120_000,
      expected: 120_000,
      difference: 0,
      baseline: 'count',
      baselineJumlah: 90_000,
      baselineAt: yesterday.toISOString(),
      catatan: null,
    });

    await openKas();

    // Newest first: today's count, then yesterday's.
    expect(screen.getByTestId('hitung-baris-0')).toHaveTextContent(
      /Seharusnya Rp 120\.000 · Dihitung Rp 120\.000 · Selisih pas · Patokan hitung terakhir/,
    );
    expect(screen.getByTestId('hitung-baris-1')).toHaveTextContent(
      /Seharusnya Rp 100\.000 · Dihitung Rp 90\.000 · Selisih kurang Rp 10\.000 · Patokan kas awal/,
    );
  });
});
