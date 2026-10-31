import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import { PengaturanScreen } from '@/screens/Pengaturan';
import { mockPrinter, resetPhone, waitReady, wrap } from './testPhone';

/**
 * The whole way from settings to paper: the owner names the shop in Pengaturan,
 * rings a sale at the till, and the customer's nota carries that name.
 *
 * Two screens, one record. This is the ticket's claim that the header and
 * footer are *configurable in settings and appear on the receipt*, not merely
 * stored.
 */

// Two screens over a real ledger, seeded through the catalog: slower than
// jest's default allowance when the whole suite is running together.
jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

describe('the shop name the owner set appears on the nota', () => {
  it('carries through from Pengaturan to the sale and the PDF', async () => {
    render(
      wrap(
        <>
          <PengaturanScreen />
          <KasirScreen />
        </>,
      ),
    );
    const { catalog } = await waitReady(act);

    // The owner sets their words.
    fireEvent(screen.getByTestId('toko-nama'), 'changeText', 'Warung Bu Sri');
    fireEvent(screen.getByTestId('toko-keterangan'), 'changeText', 'Jl. Melati 12');
    fireEvent(screen.getByTestId('toko-footer'), 'changeText', 'Terima kasih, datang lagi ya.');
    fireEvent.press(screen.getByTestId('simpan-pengaturan'));
    await act(async () => {});

    // They ring a sale.
    const kategoriId = await act(async () => catalog!.createKategori({ nama: 'Makanan' }));
    const produkId = await act(async () => catalog!.createProduk({ kategoriId, nama: 'Indomie' }));
    const varianId = await act(async () =>
      catalog!.createVarian({
        produkId,
        nama: 'Indomie goreng',
        kode: 'IDM',
        satuan: 'bungkus',
        jualBy: 'unit',
        harga: 3500,
      }),
    );
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId('simpan-penjualan'));
    await act(async () => {});
    fireEvent(screen.getByTestId('uang-diterima'), 'changeText', '5.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran'));
    await act(async () => {});

    // The nota on screen.
    expect(screen.getByText('Warung Bu Sri')).toBeTruthy();
    expect(screen.getByText('Jl. Melati 12')).toBeTruthy();
    expect(screen.getByTestId('nota-footer')).toHaveTextContent('Terima kasih, datang lagi ya.');

    // And the paper the customer takes away.
    fireEvent.press(screen.getByTestId('bagikan-nota'));
    await act(async () => {});
    expect(mockPrinter.printed[0]).toContain('Warung Bu Sri');
    expect(mockPrinter.printed[0]).toContain('Jl. Melati 12');
    expect(mockPrinter.printed[0]).toContain('Terima kasih, datang lagi ya.');
  });
});
