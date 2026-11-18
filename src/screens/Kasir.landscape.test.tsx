import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { KasirScreen } from '@/screens/Kasir';
import type { Catalog } from '@/ledger/catalog';
import { app, resetPhone, waitReady, wrap } from './testPhone';

/**
 * The same till, in the other shape. Landscape is where the nota stops being a
 * sheet along the bottom and becomes a panel beside the grid; these tests hold
 * that cut in place, and the editor that replaces the steppers there.
 */

function setWindow(width: number, height: number) {
  Dimensions.set({
    window: { width, height, scale: 2, fontScale: 1 },
    screen: { width, height, scale: 2, fontScale: 1 },
  });
}

beforeEach(() => {
  resetPhone();
  setWindow(411, 891);
});

afterAll(() => setWindow(411, 891));

async function start() {
  setWindow(891, 411);
  render(wrap(<KasirScreen />));
  return waitReady(act);
}

async function seedIndomie(catalog: Catalog) {
  const kategoriId = await act(async () => catalog.createKategori({ nama: 'Makanan' }));
  const produkId = await act(async () => catalog.createProduk({ kategoriId, nama: 'Indomie goreng' }));
  return act(async () =>
    catalog.createVarian({
      produkId,
      nama: 'Indomie goreng',
      kode: 'IDM',
      satuan: 'bungkus',
      jualBy: 'unit',
      harga: 3500,
    }),
  );
}

describe('Kasir - landscape', () => {
  it('puts the nota beside the grid instead of folding it along the bottom', async () => {
    const { catalog } = await start();
    const varianId = await seedIndomie(catalog!);

    expect(screen.getByTestId('nota-panel')).toBeTruthy();
    expect(screen.queryByLabelText('Buka nota')).toBeNull();

    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    expect(screen.getByTestId(`panel-${varianId}`)).toBeTruthy();
    expect(screen.queryByTestId(`nota-${varianId}`)).toBeNull();
  });

  it('edits a line through the editor sheet, since the panel has no room for steppers', async () => {
    const { catalog } = await start();
    const varianId = await seedIndomie(catalog!);
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    fireEvent.press(screen.getByTestId(`panel-${varianId}`));

    expect(screen.getByTestId('atur-jumlah')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Tambah Indomie goreng'));

    expect(app.cart[0]).toMatchObject({ qty: 2, jumlah: 7000 });
  });

  it('takes a line off the nota from the editor, and closes the editor with it', async () => {
    const { catalog } = await start();
    const varianId = await seedIndomie(catalog!);
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));
    fireEvent.press(screen.getByTestId(`panel-${varianId}`));

    fireEvent.press(screen.getByTestId('hapus-baris'));

    expect(app.cart).toEqual([]);
    expect(screen.queryByTestId('atur-jumlah')).toBeNull();
    expect(screen.getByText('Belum ada barang di nota.')).toBeTruthy();
  });
});
