import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { PelangganScreen } from '@/screens/Pelanggan';
import { PemasokScreen } from '@/screens/Pemasok';
import type { Ledger } from '@/ledger';
import { PHONE_PORTRAIT, phoneLedger, resetPhone, setWindow, waitReady, wrap } from './testPhone';

/**
 * Orang in the other shape: the list on the left and the person it is about on
 * the right. A supplier's pane is what the shop owes, what is still on the
 * shelf in titip, and the record the visits produced; a customer's pane is the
 * hutang and the nota behind it.
 *
 * Nothing here asserts style values — only which half is on screen, what it
 * says, and that acting in the pane moves the figure beside the list.
 */

jest.setTimeout(30_000);

const LANDSCAPE = { width: 891, height: 411 } as const;

beforeEach(() => {
  resetPhone();
  setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
});

afterAll(() => setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height));

async function start(node: ReactNode) {
  setWindow(LANDSCAPE.width, LANDSCAPE.height);
  render(wrap(node));
  return waitReady(act);
}

/** A sellable varian, written straight to the log: master data is not under test. */
async function seedVarian(ledger: Ledger, nama = 'Beras', satuan: 'pcs' | 'kg' = 'kg') {
  const kategoriId = await ledger.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ledger.append('produk.created', { kategoriId, nama });
  return ledger.append('varian.created', {
    produkId,
    nama,
    kode: null,
    satuan,
    jualBy: satuan === 'kg' ? 'weight' : 'unit',
    harga: 15_000,
  });
}

async function seedSupplier(ledger: Ledger, nama: string) {
  return ledger.append('supplier.created', { nama, telepon: null });
}

describe('Pemasok - landscape', () => {
  it('opens with an empty pane, then shows the selected supplier utang, titip and visit record', async () => {
    const ledger = phoneLedger();
    const varianId = await seedVarian(ledger);
    const supplierId = await seedSupplier(ledger, 'CV Sumber Rejeki');
    await ledger.append('stock.received', {
      varianId,
      qty: 5,
      settlement: 'tempo',
      supplierId,
      hargaBeli: 2_000,
    });
    await ledger.append('stock.received', {
      varianId,
      qty: 8,
      settlement: 'titip',
      supplierId,
      hargaBeli: 3_000,
    });

    await start(<PemasokScreen />);

    expect(screen.getByText('Pilih pemasok')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`pemasok-baris-${supplierId}`));

    expect(screen.getByTestId(`pane-utang-${supplierId}`)).toHaveTextContent('Utang Rp 10.000');
    expect(screen.getByTestId(`pane-rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 10.000 · Titip terjual Rp 0 · Dibayar Rp 0',
    );
    expect(screen.getByTestId(`pane-titip-${supplierId}`)).toHaveTextContent('Titip di rak: 8 kg');
    // The list is still beside the pane.
    expect(screen.getByTestId(`pemasok-baris-${supplierId}`)).toBeTruthy();
  });

  it('records a payment from the pane and moves the figure without leaving the list', async () => {
    const ledger = phoneLedger();
    const varianId = await seedVarian(ledger);
    const supplierId = await seedSupplier(ledger, 'Pemasok Campur');
    await ledger.append('stock.received', {
      varianId,
      qty: 5,
      settlement: 'tempo',
      supplierId,
      hargaBeli: 2_000,
    });

    await start(<PemasokScreen />);
    fireEvent.press(screen.getByTestId(`pemasok-baris-${supplierId}`));

    fireEvent.press(screen.getByTestId(`pane-bayar-${supplierId}`));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('bayar-jumlah'), '4.000');
    fireEvent.press(screen.getByTestId('simpan-bayar'));
    await act(async () => {});

    expect(screen.getByTestId(`pane-utang-${supplierId}`)).toHaveTextContent('Utang Rp 6.000');
    expect(screen.getByTestId(`pane-rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 10.000 · Titip terjual Rp 0 · Dibayar Rp 4.000',
    );
    expect(screen.getByTestId(`pemasok-baris-${supplierId}`)).toBeTruthy();
  });

  it('says a supplier owes nothing in words, not as a zero balance', async () => {
    const ledger = phoneLedger();
    const supplierId = await seedSupplier(ledger, 'Pemasok Baru');

    await start(<PemasokScreen />);
    fireEvent.press(screen.getByTestId(`pemasok-baris-${supplierId}`));

    expect(screen.getByTestId(`pane-utang-${supplierId}`)).toHaveTextContent('Tidak ada utang');
  });
});

describe('Pelanggan - landscape', () => {
  it('opens with an empty pane, then shows the selected customer hutang and nota', async () => {
    const ledger = phoneLedger();
    const varianId = await seedVarian(ledger);
    const pelangganId = await ledger.tambahPelanggan({ nama: 'Bu Ani' });
    await ledger.recordSale([{ varianId, qty: 2 }], {
      discount: { kind: 'none' },
      tendered: 20_000,
      pelangganId,
    });

    await start(<PelangganScreen />);

    expect(screen.getByText('Pilih pelanggan')).toBeTruthy();
    // The portrait detail sheet is not the landscape answer.
    expect(screen.queryByTestId('detail-pelanggan')).toBeNull();

    fireEvent.press(screen.getByTestId(`pelanggan-baris-${pelangganId}`));

    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Hutang 10.000');
    expect(screen.getByText('Penjualan')).toBeTruthy();
    expect(screen.getByTestId(`pelanggan-baris-${pelangganId}`)).toBeTruthy();
  });

  it('records a payment from the pane and moves the balance without leaving the list', async () => {
    const ledger = phoneLedger();
    const varianId = await seedVarian(ledger);
    const pelangganId = await ledger.tambahPelanggan({ nama: 'Bu Ani' });
    await ledger.recordSale([{ varianId, qty: 2 }], {
      discount: { kind: 'none' },
      tendered: 20_000,
      pelangganId,
    });

    await start(<PelangganScreen />);
    fireEvent.press(screen.getByTestId(`pelanggan-baris-${pelangganId}`));

    fireEvent.press(screen.getByTestId('catat-pembayaran'));
    await act(async () => {});
    fireEvent(screen.getByTestId('bayar-hutang-jumlah'), 'changeText', '4.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran-hutang'));
    await act(async () => {});

    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Hutang 6.000');
    expect(screen.getByText('−4.000')).toBeTruthy();
    expect(screen.getByTestId(`pelanggan-baris-${pelangganId}`)).toBeTruthy();
    expect(screen.queryByTestId('detail-pelanggan')).toBeNull();
  });

  it('says a customer with nothing owed is lunas, not a zero balance', async () => {
    const ledger = phoneLedger();
    const pelangganId = await ledger.tambahPelanggan({ nama: 'Pak Budi' });

    await start(<PelangganScreen />);
    fireEvent.press(screen.getByTestId(`pelanggan-baris-${pelangganId}`));

    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Lunas');
  });
});
