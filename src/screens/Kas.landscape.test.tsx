import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { KasScreen } from '@/screens/Kas';
import { PHONE_PORTRAIT, phoneLedger, resetPhone, setWindow, waitReady, wrap } from './testPhone';

/**
 * The drawer in the other shape.
 *
 * Landscape is where the movement list and the actions that change it stand
 * side by side, so recording an expense never hides the balance it is checked
 * against. Tutup Toko keeps the expected cash and its total window in view while
 * the owner counts, in both shapes.
 */

beforeEach(() => {
  resetPhone();
  setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
});

afterAll(() => setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height));

async function openKasLandscape() {
  setWindow(891, 411);
  render(wrap(<KasScreen />));
  return waitReady(act);
}

async function openKasPortrait() {
  setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
  render(wrap(<KasScreen />));
  return waitReady(act);
}

async function seedSale(harga = 30_000) {
  const ledger = phoneLedger();
  const kategoriId = await ledger.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ledger.append('produk.created', { kategoriId, nama: 'Tepung terigu' });
  const varianId = await ledger.append('varian.created', {
    produkId,
    nama: 'Tepung terigu 1 kg',
    kode: null,
    satuan: 'kg',
    jualBy: 'weight',
    harga,
  });
  return ledger.recordSale([{ varianId, qty: 1 }], {
    discount: { kind: 'none' },
    tendered: harga,
  });
}

async function recordExpense(jumlah: string, keterangan: string) {
  fireEvent.press(screen.getByTestId('catat-pengeluaran'));
  await act(async () => {});
  fireEvent.changeText(screen.getByTestId('pengeluaran-jumlah'), jumlah);
  fireEvent.changeText(screen.getByTestId('pengeluaran-keterangan'), keterangan);
  fireEvent.press(screen.getByTestId('simpan-pengeluaran'));
  await act(async () => {});
}

describe('Kas — landscape', () => {
  it('shows the drawer’s movements beside the actions that change it', async () => {
    await openKasLandscape();

    const left = screen.getByTestId('kas-kolom-kiri');
    const right = screen.getByTestId('kas-kolom-kanan');

    // The balance and every movement are on the left…
    expect(within(left).getByTestId('kas-expected')).toBeTruthy();
    expect(within(left).getByTestId('kas-penjualan')).toBeTruthy();
    expect(within(left).getByTestId('kas-pengeluaran')).toBeTruthy();

    // …and the actions that change them, with Tutup Toko, are on the right.
    expect(within(right).getByTestId('catat-pengeluaran')).toBeTruthy();
    expect(within(right).getByTestId('hitung-kas')).toBeTruthy();
    expect(within(right).getByTestId('tutup-expected')).toBeTruthy();
    expect(within(right).getByTestId('tutup-hitung')).toBeTruthy();
  });

  it('recording an expense from the right updates the list and the expected cash on the left', async () => {
    await seedSale(30_000);
    await openKasLandscape();

    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/30\.000/);

    await recordExpense('25.000', 'Listrik');

    // Both halves are still on screen: nothing had to be scrolled away to see
    // the new balance beside the movement that produced it.
    expect(screen.getByTestId('kas-kolom-kiri')).toBeTruthy();
    expect(screen.getByTestId('kas-kolom-kanan')).toBeTruthy();
    expect(screen.getByTestId('kas-expected')).toHaveTextContent(/5\.000/);
    expect(screen.getByTestId('kas-pengeluaran')).toHaveTextContent(/−Rp 25\.000/);
  });

  it('keeps the expected cash and the total window above the save button while counting', async () => {
    await seedSale(45_000);
    await openKasLandscape();

    fireEvent.press(screen.getByTestId('tutup-hitung'));
    await act(async () => {});

    // The count field is focused, and the figure it is checked against is still
    // there — below the field, above the save button, so focusing cannot scroll
    // it away.
    fireEvent(screen.getByTestId('hitung-jumlah'), 'focus');

    expect(screen.getByTestId('hitung-expected')).toHaveTextContent('Kas yang seharusnya Rp 45.000');
    const summary = screen.getByTestId('hitung-ringkasan');
    expect(within(summary).getByTestId('hitung-expected')).toBeTruthy();
    expect(within(summary).getByTestId('hitung-total')).toHaveTextContent(/45\.000/);
    expect(screen.getByTestId('simpan-hitung')).toBeTruthy();
  });
});

describe('Kas — Tutup Toko in portrait', () => {
  it('keeps the expected cash and the total window above the save button while counting', async () => {
    await seedSale(45_000);
    await openKasPortrait();

    // Portrait is still one column: no landscape halves.
    expect(screen.queryByTestId('kas-kolom-kiri')).toBeNull();
    expect(screen.queryByTestId('kas-kolom-kanan')).toBeNull();

    fireEvent.press(screen.getByTestId('tutup-hitung'));
    await act(async () => {});
    fireEvent(screen.getByTestId('hitung-jumlah'), 'focus');

    expect(screen.getByTestId('hitung-expected')).toHaveTextContent('Kas yang seharusnya Rp 45.000');
    const summary = screen.getByTestId('hitung-ringkasan');
    expect(within(summary).getByTestId('hitung-expected')).toBeTruthy();
    expect(within(summary).getByTestId('hitung-total')).toHaveTextContent(/45\.000/);
    expect(screen.getByTestId('simpan-hitung')).toBeTruthy();
  });
});
