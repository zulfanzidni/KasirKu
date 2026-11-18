import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RiwayatScreen } from '@/screens/Riwayat';
import { app, mockPrinter, phoneLedger, PHONE_PORTRAIT, resetPhone, setWindow, waitReady, wrap } from './testPhone';

/**
 * Riwayat in the other shape: the day's nota on the left, the chosen nota's
 * paper on the right. The paper is the same `ReceiptPaper` the portrait sheet
 * shows and the printer writes, so a void cannot mark one and not the other.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
  setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
});

afterAll(() => setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height));

async function openRiwayat(width = 891, height = 411) {
  setWindow(width, height);
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

/** The number the customer holds, read from the ledger the screen reads. */
function numberOf(saleId: string): string {
  const sale = app.shop.sales.find((entry) => entry.id === saleId);
  if (!sale) throw new Error(`Penjualan ${saleId} tidak ada di catatan.`);
  return sale.number;
}

async function select(saleId: string) {
  fireEvent.press(screen.getByTestId(`riwayat-baris-${saleId}`));
  await act(async () => {});
}

describe('Riwayat — landscape', () => {
  it('puts the paper beside the list, and says Pilih nota until a row is chosen', async () => {
    const { saleId } = await seedSale();
    await openRiwayat();

    expect(screen.getByTestId('riwayat-pane')).toBeTruthy();
    expect(screen.getByText('Pilih nota')).toBeTruthy();
    // The portrait sheet is not also open behind the pane.
    expect(screen.queryByTestId('riwayat-detail')).toBeNull();

    await select(saleId);

    expect(screen.queryByText('Pilih nota')).toBeNull();
    expect(screen.getByTestId('nota-kertas')).toBeTruthy();
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(`No. ${numberOf(saleId)}`);
  });

  it('changes the paper when another row is chosen, and marks the chosen row', async () => {
    const first = await seedSale(10_000);
    const second = await seedSale(25_000);
    await openRiwayat();

    await select(first.saleId);
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(`No. ${numberOf(first.saleId)}`);
    expect(screen.getByTestId(`riwayat-baris-${first.saleId}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId(`riwayat-baris-${second.saleId}`).props.accessibilityState).toMatchObject({
      selected: false,
    });

    await select(second.saleId);
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(`No. ${numberOf(second.saleId)}`);
    expect(screen.getByTestId(`riwayat-baris-${second.saleId}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId(`riwayat-baris-${first.saleId}`).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('voids from the pane, marking the same paper and leaving the selection alone', async () => {
    const first = await seedSale(10_000);
    const second = await seedSale(25_000);
    await openRiwayat();
    await select(first.saleId);

    fireEvent.press(screen.getByTestId('riwayat-batal'));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('riwayat-alasan'), 'Salah input');
    fireEvent.press(screen.getByTestId('riwayat-simpan-batal'));
    await act(async () => {});

    // The paper the pane shows is the one the portrait sheet would mark.
    expect(screen.getByTestId('nota-batal')).toHaveTextContent(/NOTA DIBATALKAN/);
    expect(screen.getByTestId('nota-batal')).toHaveTextContent(/Salah input/);
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(`No. ${numberOf(first.saleId)}`);
    expect(screen.getByTestId(`riwayat-status-${first.saleId}`)).toHaveTextContent('Dibatalkan');

    // The neighbouring row was not selected by the void.
    expect(screen.getByTestId(`riwayat-baris-${first.saleId}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId(`riwayat-baris-${second.saleId}`).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('shares the selected nota from the pane without losing the selection', async () => {
    const first = await seedSale(10_000);
    const second = await seedSale(25_000);
    await openRiwayat();
    await select(second.saleId);

    fireEvent.press(screen.getByTestId('riwayat-bagikan'));
    await act(async () => {});

    expect(mockPrinter.printed).toHaveLength(1);
    expect(mockPrinter.printed[0]).toContain(`No. ${numberOf(second.saleId)}`);
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(`No. ${numberOf(second.saleId)}`);
    expect(screen.getByTestId(`riwayat-baris-${second.saleId}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId(`riwayat-baris-${first.saleId}`).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('keeps portrait as a plain list whose nota opens in the sheet', async () => {
    const { saleId } = await seedSale();
    await openRiwayat(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);

    expect(screen.queryByTestId('riwayat-pane')).toBeNull();
    expect(screen.queryByText('Pilih nota')).toBeNull();

    await select(saleId);

    expect(screen.getByTestId('riwayat-detail')).toBeTruthy();
    expect(screen.getByTestId('nota-nomor')).toHaveTextContent(`No. ${numberOf(saleId)}`);
  });
});
