import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import { KasirScreen } from '@/screens/Kasir';
import { app, resetPhone, wrap , storeView } from './testPhone';
import { createLedger } from '@/ledger/ledger';
import type { Shop } from '@/ledger/types';

/**
 * Creating the product list in the app, the way the owner does on day one:
 * a kategori, a produk inside it, then a varian with its satuan.
 */
beforeEach(() => {
  resetPhone();
});

function phoneShop(): Promise<Shop> {
  return createLedger(
    {
      nextIdentity: () => store.nextIdentity(),
      append: (events) => store.append(events),
      readAll: () => store.readAll(),
      lastSeq: () => store.lastSeq(),
      replaceAll: (events, lastSeq) => store.replaceAll(events, lastSeq),
    },
    'gawai-uji',
  ).shop();
}

async function open() {
  render(wrap(<StokScreen />));
  for (let i = 0; i < 100 && !app?.ready; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  return app;
}

describe('Stok — making the product list', () => {
  it('creates a kategori, a produk and a varian with a satuan chosen at creation', async () => {
    await open();

    fireEvent.press(screen.getByTestId('tambah-barang'));
    fireEvent.changeText(screen.getByTestId('kategori-nama'), 'Tepung');
    fireEvent.press(screen.getByTestId('simpan-kategori'));
    await act(async () => {});

    expect(screen.getByText('Tepung')).toBeTruthy();
    const kategoriId = (await phoneShop()).kategori[0].id;

    fireEvent.press(screen.getByTestId(`tambah-produk-${kategoriId}`));
    fireEvent.changeText(screen.getByTestId('produk-nama'), 'Tepung terigu');
    fireEvent.press(screen.getByTestId('simpan-produk'));
    await act(async () => {});

    expect(screen.getByText('Tepung terigu')).toBeTruthy();
    const produkId = (await phoneShop()).produk[0].id;

    fireEvent.press(screen.getByTestId(`tambah-varian-${produkId}`));
    fireEvent.changeText(screen.getByTestId('varian-nama'), 'Tepung terigu 1 kg');
    fireEvent.changeText(screen.getByTestId('varian-kode'), 'TLG-1');
    fireEvent.press(screen.getByTestId('satuan-kg'));
    fireEvent.press(screen.getByTestId('jual-weight'));
    fireEvent.changeText(screen.getByTestId('varian-harga'), '13.500');
    fireEvent.press(screen.getByTestId('simpan-varian'));
    await act(async () => {});

    const shop = await phoneShop();
    expect(shop.kategori.map((entry) => entry.nama)).toEqual(['Tepung']);
    expect(shop.produk.map((entry) => entry.nama)).toEqual(['Tepung terigu']);
    expect(shop.varian).toEqual([
      expect.objectContaining({
        nama: 'Tepung terigu 1 kg',
        kode: 'TLG-1',
        satuan: 'kg',
        jualBy: 'weight',
        harga: 13500,
      }),
    ]);
    expect(screen.getByText('Tepung terigu 1 kg')).toBeTruthy();
  });

  it('offers no form that could change a varian’s satuan after creation', async () => {
    await open();

    // The only action on an existing varian is the add button for a sibling;
    // there is no edit surface at all in this ticket.
    expect(screen.queryByTestId('ubah-varian')).toBeNull();
  });
});

describe('the till after setup', () => {
  it('sells what was created in Stok', async () => {
    await open();
    fireEvent.press(screen.getByTestId('tambah-barang'));
    fireEvent.changeText(screen.getByTestId('kategori-nama'), 'Makanan');
    fireEvent.press(screen.getByTestId('simpan-kategori'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId(`tambah-produk-${(await phoneShop()).kategori[0].id}`));
    fireEvent.changeText(screen.getByTestId('produk-nama'), 'Indomie goreng');
    fireEvent.press(screen.getByTestId('simpan-produk'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId(`tambah-varian-${(await phoneShop()).produk[0].id}`));
    fireEvent.changeText(screen.getByTestId('varian-nama'), 'Indomie goreng');
    fireEvent.changeText(screen.getByTestId('varian-harga'), '3500');
    fireEvent.press(screen.getByTestId('simpan-varian'));
    await act(async () => {});

    screen.unmount();
    render(wrap(<KasirScreen />));
    for (let i = 0; i < 100 && !app?.ready; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }

    const varianId = (await phoneShop()).varian[0].id;
    fireEvent.press(screen.getByTestId(`grid-${varianId}`));

    expect(app.cart).toEqual([expect.objectContaining({ qty: 1, jumlah: 3500 })]);
  });
});

