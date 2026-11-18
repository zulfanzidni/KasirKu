import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import type { Catalog } from '@/ledger/catalog';
import type { Shop } from '@/ledger/types';
import {
  app,
  mockPhone,
  PHONE_PORTRAIT,
  phoneLedger,
  resetPhone,
  setWindow,
  waitReady,
  wrap,
} from './testPhone';

/**
 * Stok in the other shape: the list stays on the left and the selected varian's
 * own stock, its movements and its actions sit beside it. Portrait keeps the
 * plain list, where a tap still opens the count form.
 */

let mounted = false;

beforeEach(() => {
  resetPhone();
  mounted = false;
  setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
});

afterAll(() => setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height));

async function open(width = 891, height = 411) {
  if (mounted) screen.unmount();
  mounted = true;
  setWindow(width, height);
  render(wrap(<StokScreen />));
  return waitReady(act);
}

async function phoneShop(): Promise<Shop> {
  return phoneLedger().shop();
}

/** A kategori, one produk and one varian, written the way the forms would. */
async function seedBarang(catalog: Catalog, nama: string) {
  const kategoriId = await act(async () => catalog.createKategori({ nama: 'Sembako' }));
  const produkId = await act(async () => catalog.createProduk({ kategoriId, nama: 'Sembako' }));
  const varianId = await act(async () =>
    catalog.createVarian({
      produkId,
      nama,
      kode: nama,
      satuan: 'pcs',
      jualBy: 'unit',
      harga: 1000,
    }),
  );
  return { kategoriId, produkId, varianId };
}

/** Goods that are the supplier's, sitting on the same shelf. */
async function addTitip(varianId: string, qty: number) {
  const store = mockPhone.store;
  const { id, seq } = await store.nextIdentity();
  await store.append([
    {
      id,
      seq,
      deviceId: 'gawai-uji',
      createdAt: new Date().toISOString(),
      type: 'stock.received',
      payload: { varianId, qty, settlement: 'titip' },
    } as never,
  ]);
}

/** The owner counting the shelf through the pane's own action. */
async function countFromPane(counted: string, reason: string) {
  fireEvent.press(screen.getByTestId('pane-hitung'));
  fireEvent.changeText(screen.getByTestId('hitung-jumlah'), counted);
  fireEvent.changeText(screen.getByTestId('hitung-alasan'), reason);
  fireEvent.press(screen.getByTestId('simpan-hitung'));
  await act(async () => {});
}

describe('Stok - landscape', () => {
  it('keeps the list on the left and says Pilih barang in the empty pane', async () => {
    const state = await open();
    const { varianId } = await seedBarang(state.catalog!, 'Indomie goreng');

    expect(screen.getByTestId('stok-pane')).toBeTruthy();
    expect(screen.getByText('Pilih barang')).toBeTruthy();
    expect(screen.getByTestId(`stok-baris-${varianId}`)).toBeTruthy();
  });

  it('shows the selected varian’s two buckets in the pane, beside the list', async () => {
    const state = await open();
    const { varianId } = await seedBarang(state.catalog!, 'Indomie goreng');
    await act(async () => app.adjustStock({ varianId, counted: 10, reason: 'Hitung rak' }));

    screen.unmount();
    mounted = false;
    await addTitip(varianId, 4);
    await open();

    fireEvent.press(screen.getByTestId(`stok-baris-${varianId}`));

    expect(screen.getByTestId('pane-stok')).toHaveTextContent('10');
    expect(screen.getByTestId('pane-titip')).toHaveTextContent('4 pcs');
    // The list did not go anywhere.
    expect(screen.getByTestId(`stok-baris-${varianId}`)).toBeTruthy();
    expect(screen.queryByText('Pilih barang')).toBeNull();
  });

  it('counts the selected varian from the pane and the reading changes in place', async () => {
    const state = await open();
    const { varianId } = await seedBarang(state.catalog!, 'Indomie goreng');

    fireEvent.press(screen.getByTestId(`stok-baris-${varianId}`));
    await countFromPane('10', 'Hitung gudang');

    expect(screen.getByTestId('pane-stok')).toHaveTextContent('10');
    expect(screen.getByTestId(`stok-baris-${varianId}`)).toBeTruthy();

    await countFromPane('8', 'Ada yang pecah');

    expect(screen.getByTestId('pane-stok')).toHaveTextContent('8');
    // Recent movements are in the pane, as deltas with their reason.
    expect(screen.getByText('Ada yang pecah')).toBeTruthy();
    expect(screen.getByText('−2')).toBeTruthy();
    expect(screen.getByTestId(`stok-baris-${varianId}`)).toBeTruthy();
    expect((await phoneShop()).varian.find((entry) => entry.id === varianId)?.nama).toBe('Indomie goreng');
  });

  it('says so when the selected varian leaves the list instead of showing a stale item', async () => {
    const state = await open();
    const { produkId, varianId } = await seedBarang(state.catalog!, 'Indomie goreng');

    fireEvent.press(screen.getByTestId(`stok-baris-${varianId}`));
    expect(screen.getByTestId('pane-stok')).toBeTruthy();

    // Archiving the produk takes the varian out of the list; the selection is
    // not silently re-pointed at some other row, nor shown as if still there.
    fireEvent.press(screen.getByTestId(`ubah-produk-${produkId}`));
    fireEvent.press(screen.getByTestId('arsipkan-produk'));
    await act(async () => {});

    expect(screen.queryByTestId(`stok-baris-${varianId}`)).toBeNull();
    expect(screen.queryByTestId('pane-stok')).toBeNull();
    expect(screen.getByTestId('pane-hilang')).toHaveTextContent('Barang ini tidak ada di daftar.');
  });

  it('keeps portrait as the plain list, where a tap opens the count form', async () => {
    const state = await open(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
    const { varianId } = await seedBarang(state.catalog!, 'Indomie goreng');

    expect(screen.queryByTestId('stok-pane')).toBeNull();
    expect(screen.queryByText('Pilih barang')).toBeNull();

    fireEvent.press(screen.getByTestId(`stok-baris-${varianId}`));

    expect(screen.getByTestId('form-hitung')).toBeTruthy();
    expect(screen.getByTestId('hitung-jumlah')).toBeTruthy();
  });
});
