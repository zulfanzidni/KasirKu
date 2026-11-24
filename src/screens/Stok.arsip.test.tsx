import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StokScreen } from '@/screens/Stok';
import { KasirScreen } from '@/screens/Kasir';
import { app, phoneLedger, resetPhone, wrap } from './testPhone';
import type { Shop } from '@/ledger/types';

/**
 * Archiving and restoring, the way the owner does it: long-press a varian to
 * take it out of the list, then open the Arsip card to bring it back.
 *
 * Every assertion is either what the screen shows or what the phone's own log
 * holds afterwards. Archiving is a flag, never a delete, so the stock and the
 * old sales must survive it.
 */

let rendered = false;

beforeEach(() => {
  resetPhone();
  rendered = false;
});

async function open() {
  if (rendered) screen.unmount();
  rendered = true;
  render(wrap(<StokScreen />));
  for (let i = 0; i < 100 && !app?.ready && !app?.error; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  await act(async () => {});
  if (app.error) throw new Error('Catatan gagal dibuka: ' + app.error);
  return app;
}

async function openKasir() {
  if (rendered) screen.unmount();
  rendered = true;
  render(wrap(<KasirScreen />));
  for (let i = 0; i < 100 && !app?.ready && !app?.error; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  await act(async () => {});
  if (app.error) throw new Error('Catatan gagal dibuka: ' + app.error);
  return app;
}

async function phoneShop(): Promise<Shop> {
  return phoneLedger().shop();
}

async function seedKategori(nama: string) {
  fireEvent.press(screen.getByTestId('tambah-barang'));
  fireEvent.changeText(screen.getByTestId('kategori-nama'), nama);
  fireEvent.press(screen.getByTestId('simpan-kategori'));
  await act(async () => {});
  return (await phoneShop()).kategori.find((entry) => entry.nama === nama)!.id;
}

async function seedProduk(kategoriId: string, nama: string) {
  fireEvent.press(screen.getByTestId(`tambah-produk-${kategoriId}`));
  fireEvent.changeText(screen.getByTestId('produk-nama'), nama);
  fireEvent.press(screen.getByTestId('simpan-produk'));
  await act(async () => {});
  return (await phoneShop()).produk.find((entry) => entry.nama === nama)!.id;
}

async function seedVarian(produkId: string, nama: string, harga = '1.000') {
  fireEvent.press(screen.getByTestId(`tambah-varian-${produkId}`));
  fireEvent.changeText(screen.getByTestId('varian-nama'), nama);
  fireEvent.changeText(screen.getByTestId('varian-harga'), harga);
  fireEvent.press(screen.getByTestId('simpan-varian'));
  await act(async () => {});
  return (await phoneShop()).varian.find((entry) => entry.nama === nama)!.id;
}

async function count(varianId: string, counted: string, reason: string) {
  fireEvent.press(screen.getByTestId(`hitung-${varianId}`));
  fireEvent.changeText(screen.getByTestId('hitung-jumlah'), counted);
  fireEvent.changeText(screen.getByTestId('hitung-alasan'), reason);
  fireEvent.press(screen.getByTestId('simpan-hitung'));
  await act(async () => {});
}

/** The row's long press: the menu is a long press, so the test holds it. */
function longPress(testID: string) {
  fireEvent(screen.getByTestId(testID), 'longPress');
}

async function archiveKategori(kategoriId: string) {
  fireEvent.press(screen.getByTestId(`ubah-kategori-${kategoriId}`));
  fireEvent.press(screen.getByTestId('arsipkan-kategori'));
  await act(async () => {});
}

async function archiveProduk(produkId: string) {
  fireEvent.press(screen.getByTestId(`ubah-produk-${produkId}`));
  fireEvent.press(screen.getByTestId('arsipkan-produk'));
  await act(async () => {});
}

async function openArsip() {
  fireEvent.press(screen.getByTestId('buka-arsip'));
  await act(async () => {});
}

describe('Stok — archiving a varian', () => {
  it('asks first when stock is left, then takes it out of the list and the till', async () => {
    await open();
    const kategoriId = await seedKategori('Sembako');
    const produkId = await seedProduk(kategoriId, 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');
    await count(varianId, '5', 'Hitung rak');

    longPress(`stok-baris-${varianId}`);
    await act(async () => {});

    expect(screen.getByTestId('menu-varian')).toBeTruthy();
    // The sheet shows what is on the shelf before anything is written.
    expect(screen.getByText(/Stok 5 pcs/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('arsipkan-varian'));
    await act(async () => {});

    // It asked, and said what would be left behind.
    expect(screen.getByTestId('konfirmasi-arsip-varian')).toBeTruthy();
    expect(screen.getByText(/Stok tercatat 5 pcs/)).toBeTruthy();
    expect((await phoneShop()).varian[0].archived).toBe(false);

    fireEvent.press(screen.getByTestId('konfirmasi-arsip-varian'));
    await act(async () => {});

    expect(screen.queryByTestId(`stok-baris-${varianId}`)).toBeNull();
    expect((await phoneShop()).varian[0].archived).toBe(true);
    // The count survives: archiving is a flag, not a delete.
    expect(app.stockOf(varianId)).toEqual({ kind: 'counted', qty: 5 });

    await openKasir();
    expect(screen.queryByTestId(`grid-${varianId}`)).toBeNull();
  });

  it('archives an empty varian without a second question', async () => {
    await open();
    const kategoriId = await seedKategori('Sembako');
    const produkId = await seedProduk(kategoriId, 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');
    await count(varianId, '0', 'Rak kosong');

    longPress(`stok-baris-${varianId}`);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('arsipkan-varian'));
    await act(async () => {});

    expect(screen.queryByTestId('konfirmasi-arsip-varian')).toBeNull();
    expect(screen.queryByTestId(`stok-baris-${varianId}`)).toBeNull();
    expect((await phoneShop()).varian[0].archived).toBe(true);
  });
});

describe('Stok — the archive', () => {
  it('shows what was archived and restores a varian so it sells again', async () => {
    await open();
    const kategoriId = await seedKategori('Sembako');
    const produkId = await seedProduk(kategoriId, 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');
    await count(varianId, '0', 'Rak kosong');

    longPress(`stok-baris-${varianId}`);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('arsipkan-varian'));
    await act(async () => {});

    // The archive card is the way back, and it says what it holds.
    expect(screen.getByTestId('buka-arsip')).toHaveTextContent(/1 varian/);
    await openArsip();
    expect(screen.getByTestId('arsip')).toBeTruthy();
    expect(screen.getByTestId(`arsip-varian-${varianId}`)).toBeTruthy();

    fireEvent.press(screen.getByTestId(`pulihkan-varian-${varianId}`));
    await act(async () => {});

    expect(screen.getByTestId(`stok-baris-${varianId}`)).toBeTruthy();
    expect((await phoneShop()).varian[0].archived).toBe(false);

    await openKasir();
    expect(screen.getByTestId(`grid-${varianId}`)).toBeTruthy();
  });

  it('brings a produk back with the varian that was hidden with it', async () => {
    await open();
    const kategoriId = await seedKategori('Sembako');
    const produkId = await seedProduk(kategoriId, 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');

    await archiveProduk(produkId);
    expect(screen.queryByTestId(`stok-baris-${varianId}`)).toBeNull();
    // The varian itself was never archived; the produk hid it.
    expect((await phoneShop()).varian[0].archived).toBe(false);

    await openArsip();
    expect(screen.getByTestId(`arsip-produk-${produkId}`)).toHaveTextContent(/1 varian ikut tersembunyi/);

    fireEvent.press(screen.getByTestId(`pulihkan-produk-${produkId}`));
    await act(async () => {});

    expect(screen.getByTestId(`stok-baris-${varianId}`)).toBeTruthy();
    expect((await phoneShop()).produk[0].archived).toBe(false);
  });

  it('keeps a varian archived until its own produk comes back', async () => {
    await open();
    const kategoriId = await seedKategori('Sembako');
    const produkId = await seedProduk(kategoriId, 'Indomie goreng');
    const varianId = await seedVarian(produkId, 'Indomie goreng');
    await count(varianId, '0', 'Rak kosong');

    // Archive the varian, then its produk.
    longPress(`stok-baris-${varianId}`);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('arsipkan-varian'));
    await act(async () => {});
    await archiveProduk(produkId);

    await openArsip();
    // A varian under an archived produk says why it cannot come back yet.
    expect(screen.getByTestId(`arsip-varian-terkunci-${varianId}`)).toBeTruthy();

    // Restoring the varian alone cannot make it sellable while the produk hides it.
    fireEvent.press(screen.getByTestId(`pulihkan-varian-${varianId}`));
    await act(async () => {});

    expect((await phoneShop()).varian[0].archived).toBe(false);
    expect(screen.queryByTestId(`stok-baris-${varianId}`)).toBeNull();

    // The produk is the gate; once it is back, the varian is too.
    fireEvent.press(screen.getByTestId(`pulihkan-produk-${produkId}`));
    await act(async () => {});

    expect(screen.getByTestId(`stok-baris-${varianId}`)).toBeTruthy();
  });

  it('restores a kategori and its produk come back under it', async () => {
    await open();
    const kategoriId = await seedKategori('Tepung');
    await seedProduk(kategoriId, 'Tepung terigu');

    await archiveKategori(kategoriId);
    // While the kategori is archived the produk reads as uncategorised.
    expect(screen.queryByText('Tepung')).toBeNull();
    expect(screen.getByText('Tanpa kategori')).toBeTruthy();
    expect(screen.getByText('Tepung terigu')).toBeTruthy();

    await openArsip();
    fireEvent.press(screen.getByTestId(`pulihkan-kategori-${kategoriId}`));
    await act(async () => {});

    expect(screen.getByText('Tepung')).toBeTruthy();
    expect(screen.queryByText('Tanpa kategori')).toBeNull();
    expect(screen.getByText('Tepung terigu')).toBeTruthy();
    expect((await phoneShop()).produk[0].kategoriId).toBe(kategoriId);
  });
});
