import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PelangganScreen } from '@/screens/Pelanggan';
import type { Catalog } from '@/ledger/catalog';
import { app, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Pelanggan, driven the way the owner drives it: add a customer, open them,
 * record a payment, write a debt off, try to archive someone who still owes.
 *
 * The debt is seeded through the app's own seam (a sale with 10.500 unpaid),
 * then every action below is taken on the screen and read back from it.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

async function start() {
  render(wrap(<PelangganScreen />));
  return waitReady(act);
}

async function seedDebt(nama = 'Bu Ani') {
  const { catalog } = await start();
  const seed = catalog!;
  const kategoriId = await act(async () => seed.createKategori({ nama: 'Sembako' }));
  const produkId = await act(async () => seed.createProduk({ kategoriId, nama: 'Beras' }));
  const varianId = await act(async () =>
    seed.createVarian({
      produkId,
      nama: 'Beras sania 1 kg',
      kode: null,
      satuan: 'kg',
      jualBy: 'weight',
      harga: 15000,
    }),
  );
  const pelangganId = await act(async () => app.tambahPelanggan({ nama }));
  // 2 × 15.000 = 30.000; 20.000 handed over leaves 10.000 unpaid.
  await act(async () =>
    app.saveSale({ discount: { kind: 'none' }, tendered: 20000, pelangganId }, [{ varianId, qty: 2 }]),
  );
  return { pelangganId, varianId };
}

async function openCustomer(pelangganId: string) {
  fireEvent.press(screen.getByTestId(`pelanggan-baris-${pelangganId}`));
  await act(async () => {});
}

describe('Pelanggan — hutang, payments and write-offs', () => {
  it('adds a customer and lists what they owe', async () => {
    await seedDebt();

    expect(screen.getByText('Bu Ani')).toBeTruthy();
    expect(screen.getByText('Hutang 10.000')).toBeTruthy();
  });

  it('records a payment, reducing the balance and joining the history', async () => {
    const { pelangganId } = await seedDebt();
    await openCustomer(pelangganId);

    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Hutang 10.000');

    fireEvent.press(screen.getByTestId('catat-pembayaran'));
    await act(async () => {});
    fireEvent(screen.getByTestId('bayar-hutang-jumlah'), 'changeText', '4.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran-hutang'));
    await act(async () => {});

    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Hutang 6.000');
    expect(screen.getByText('Pembayaran')).toBeTruthy();
    expect(screen.getByText('−4.000')).toBeTruthy();
  });

  it('writes the rest off as its own entry, clearing the balance without collecting cash', async () => {
    const { pelangganId } = await seedDebt();
    await openCustomer(pelangganId);

    fireEvent.press(screen.getByTestId('hapus-buku'));
    await act(async () => {});
    fireEvent(screen.getByTestId('hapusbuku-alasan'), 'changeText', 'Tidak jadi ditagih');
    fireEvent.press(screen.getByTestId('simpan-hapusbuku'));
    await act(async () => {});

    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Lunas');
    expect(screen.getByText(/Hapus buku · Tidak jadi ditagih/)).toBeTruthy();
    // The write-off is not a payment: no cash arrived.
    expect(app.todayTotals().tunai).toBe(20000);
  });

  it('shows an overpayment as a credit', async () => {
    const { pelangganId } = await seedDebt();
    await openCustomer(pelangganId);

    fireEvent.press(screen.getByTestId('catat-pembayaran'));
    await act(async () => {});
    fireEvent(screen.getByTestId('bayar-hutang-jumlah'), 'changeText', '15.000');
    fireEvent.press(screen.getByTestId('simpan-pembayaran-hutang'));
    await act(async () => {});

    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Kredit 5.000');
  });

  it('refuses to archive a customer who still owes, and allows it once settled', async () => {
    const { pelangganId } = await seedDebt();
    await openCustomer(pelangganId);

    fireEvent.press(screen.getByTestId('arsipkan-pelanggan'));
    await act(async () => {});

    expect(screen.getByTestId('pelanggan-galat')).toHaveTextContent(/masih punya hutang/i);
    expect(screen.getByTestId('pelanggan-status')).toHaveTextContent('Hutang 10.000');

    fireEvent.press(screen.getByTestId('hapus-buku'));
    await act(async () => {});
    fireEvent(screen.getByTestId('hapusbuku-alasan'), 'changeText', 'Sudah lunas');
    fireEvent.press(screen.getByTestId('simpan-hapusbuku'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId('arsipkan-pelanggan'));
    await act(async () => {});

    expect(screen.queryByTestId(`pelanggan-baris-${pelangganId}`)).toBeNull();
  });
});
