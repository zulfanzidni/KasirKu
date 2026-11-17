import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import { RiwayatScreen } from '@/screens/Riwayat';
import { app, mockPrinter, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Riwayat, driven the way the owner drives it: find a sale by its number, open
 * its nota, void it with a reason, and re-share the paper marked as cancelled.
 *
 * The sale is seeded through the real ledger; everything below is a tap on the
 * screen, and every assertion is what the owner sees.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

async function openRiwayat() {
  render(wrap(<RiwayatScreen />));
  return waitReady(act);
}

async function seedSale(harga = 10_000, qty = 1) {
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
  const saleId = await ledger.recordSale([{ varianId, qty }], {
    discount: { kind: 'none' },
    tendered: harga * qty,
  });
  return { saleId, varianId };
}

async function openSale(saleId: string) {
  fireEvent.press(screen.getByTestId(`riwayat-baris-${saleId}`));
  await act(async () => {});
}

describe('Riwayat — penjualan dan pembatalan', () => {
  it('lists a completed sale, opens its nota, and voids it with a reason', async () => {
    const { saleId } = await seedSale();
    await openRiwayat();

    expect(screen.getByTestId(`riwayat-baris-${saleId}`)).toBeTruthy();
    expect(screen.getByTestId(`riwayat-nomor-${saleId}`)).toHaveTextContent(/No\. \d{8}-/);

    await openSale(saleId);
    expect(screen.getByTestId('riwayat-detail')).toBeTruthy();
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(/No\./);
    expect(screen.queryByTestId('nota-batal')).toBeNull();

    // Void it, with the owner's reason.
    fireEvent.press(screen.getByTestId('riwayat-batal'));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('riwayat-alasan'), 'Salah input');
    fireEvent.press(screen.getByTestId('riwayat-simpan-batal'));
    await act(async () => {});

    // The sale is still listed, marked as voided, and its nota says so.
    expect(screen.getByTestId(`riwayat-baris-${saleId}`)).toBeTruthy();
    expect(screen.getByTestId(`riwayat-status-${saleId}`)).toHaveTextContent('Dibatalkan');
    expect(screen.getByTestId('nota-batal')).toHaveTextContent(/NOTA DIBATALKAN/);
    expect(screen.getByTestId('nota-batal')).toHaveTextContent(/Salah input/);
    expect(app.todayTotals().penjualan).toBe(0);
  });

  it('refuses a void with no reason, because the reason is the record', async () => {
    const { saleId } = await seedSale();
    await openRiwayat();
    await openSale(saleId);

    fireEvent.press(screen.getByTestId('riwayat-batal'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('riwayat-simpan-batal'));
    await act(async () => {});

    expect(screen.getByTestId('riwayat-galat')).toHaveTextContent(/alasan/i);
    expect(screen.queryByTestId(`riwayat-status-${saleId}`)).toBeNull();
  });

  it('re-sharing a voided sale’s receipt prints it marked as voided', async () => {
    const { saleId } = await seedSale();
    await phoneLedger().voidSale({ saleId, alasan: 'Barang dikembalikan' });
    await openRiwayat();
    await openSale(saleId);

    fireEvent.press(screen.getByTestId('riwayat-bagikan'));
    await act(async () => {});

    expect(mockPrinter.printed).toHaveLength(1);
    // The number the customer holds is still traceable, and the paper cannot
    // claim the cancelled sale still stands.
    expect(mockPrinter.printed[0]).toContain('DIBATALKAN');
    expect(mockPrinter.printed[0]).toContain('Barang dikembalikan');
    expect(mockPrinter.printed[0]).toContain('No.');
  });

  it('a re-rung sale counts once, and the voided one stays in the history', async () => {
    const { saleId, varianId } = await seedSale();
    await phoneLedger().voidSale({ saleId, alasan: 'Salah input' });

    // Ring the replacement up at the till, exactly as any new sale.
    render(wrap(<KasirScreen />));
    await waitReady(act);
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    await act(async () =>
      app.saveSale({ discount: { kind: 'none' }, tendered: 10_000 }, [{ varianId, qty: 1 }]),
    );

    expect(app.todayTotals().penjualan).toBe(10_000);

    screen.unmount();
    await openRiwayat();
    expect(screen.getByTestId(`riwayat-baris-${saleId}`)).toBeTruthy();
    expect(screen.getByTestId(`riwayat-status-${saleId}`)).toHaveTextContent('Dibatalkan');
    expect(screen.getByTestId('riwayat-ringkasan')).toHaveTextContent(/1 transaksi/);
  });
});
