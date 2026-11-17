import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KasirScreen } from '@/screens/Kasir';
import { PemasokScreen } from '@/screens/Pemasok';
import { StokScreen } from '@/screens/Stok';
import type { Satuan, Shop } from '@/ledger/types';
import { app, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Pemasok, driven the way the owner drives it: record a supplier, write the
 * note for one visit with its tunai, tempo and titip lines, sell at the till,
 * send unsold titip back, and pay part of what is owed.
 *
 * Every assertion is what the screen shows, in the shop's own words.
 */

let mounted = false;

beforeEach(() => {
  resetPhone();
  mounted = false;
});

async function openPemasok() {
  if (mounted) screen.unmount();
  mounted = true;
  render(wrap(<PemasokScreen />));
  return waitReady(act);
}

async function openStok() {
  if (mounted) screen.unmount();
  mounted = true;
  render(wrap(<StokScreen />));
  return waitReady(act);
}

async function phoneShop(): Promise<Shop> {
  return phoneLedger().shop();
}

/** A varian in the log, before the screen opens. Master data is not under test here. */
async function seedVarian(nama: string, satuan: Satuan = 'pcs', harga = 10_000) {
  const ledger = phoneLedger();
  const kategoriId = await ledger.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await ledger.append('produk.created', { kategoriId, nama });
  return ledger.append('varian.created', {
    produkId,
    nama,
    kode: null,
    satuan,
    jualBy: satuan === 'kg' ? 'weight' : 'unit',
    harga,
  });
}

async function addSupplier(nama: string) {
  fireEvent.press(screen.getByTestId('tambah-pemasok'));
  fireEvent.changeText(screen.getByTestId('pemasok-nama'), nama);
  fireEvent.press(screen.getByTestId('simpan-pemasok'));
  await act(async () => {});
  return (await phoneShop()).supplier.find((entry) => entry.nama === nama)!.id;
}

interface NotaLine {
  varianId: string;
  settlement: 'tunai' | 'tempo' | 'titip';
  qty: string;
  harga?: string;
}

/** One visit: open the note, add every line, save it. */
async function recordNota(supplierId: string, lines: NotaLine[]) {
  fireEvent.press(screen.getByTestId(`nota-${supplierId}`));
  await act(async () => {});
  for (const line of lines) {
    fireEvent.press(screen.getByTestId(`nota-varian-${line.varianId}`));
    fireEvent.press(screen.getByTestId(`nota-${line.settlement}`));
    fireEvent.changeText(screen.getByTestId('nota-jumlah'), line.qty);
    fireEvent.changeText(screen.getByTestId('nota-harga'), line.harga ?? '');
    fireEvent.press(screen.getByTestId('nota-tambah-baris'));
    await act(async () => {});
  }
  fireEvent.press(screen.getByTestId('simpan-nota'));
  await act(async () => {});
}

/** Sells lines at the till, through the till's own screen. */
async function sellAtTill(lines: { varianId: string; qty: number }[]) {
  if (mounted) screen.unmount();
  mounted = true;
  render(wrap(<KasirScreen />));
  await waitReady(act);
  for (const line of lines) fireEvent.press(screen.getByTestId(`grid-${line.varianId}`));
  await act(async () => app.saveSale({ discount: { kind: 'none' }, tendered: 1_000_000 }, lines));
  screen.unmount();
  mounted = false;
}

/** The number a stock badge shows, before its state in words. */
function stockReading(varianId: string): string {
  return flatten(screen.getByTestId(`stok-angka-${varianId}`).props.children).replace(
    /(Belum dihitung|Hitung ulang|Habis|Rendah)$/,
    '',
  );
}

function flatten(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'props' in (value as { props?: unknown })) {
    return flatten((value as { props: { children?: unknown } }).props.children);
  }
  return '';
}

describe('Pemasok — mencatat pemasok', () => {
  it('menampilkan pemasok baru dengan utang kosong dan rinciannya', async () => {
    await openPemasok();
    const supplierId = await addSupplier('CV Sumber Rejeki');

    expect(screen.getByText('CV Sumber Rejeki')).toBeTruthy();
    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Tidak ada utang');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 0 · Titip terjual Rp 0 · Dibayar Rp 0',
    );
  });
});

describe('Pemasok — satu nota, tiga cara bayar', () => {
  it('mencatat tunai, tempo dan titip dalam satu kunjungan, dan hanya tempo yang berutang', async () => {
    const tunai = await seedVarian('Tunai');
    const tempo = await seedVarian('Tempo');
    const titip = await seedVarian('Titip');
    await openPemasok();
    const supplierId = await addSupplier('CV Sumber Rejeki');

    await recordNota(supplierId, [
      { varianId: tunai, settlement: 'tunai', qty: '10', harga: '1.000' },
      { varianId: tempo, settlement: 'tempo', qty: '5', harga: '2.000' },
      { varianId: titip, settlement: 'titip', qty: '8', harga: '3.000' },
    ]);

    // The supplier screen: only the tempo line is owed, and the composition
    // says exactly where the number came from.
    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Utang Rp 10.000');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 10.000 · Titip terjual Rp 0 · Dibayar Rp 0',
    );
    expect(screen.getByTestId(`titip-pemasok-${supplierId}`)).toHaveTextContent('Titip di rak: 8 pcs');

    // The shelf: tunai and tempo are owned, titip is a separate bucket.
    await openStok();
    expect(stockReading(tunai)).toBe('10');
    expect(stockReading(tempo)).toBe('5');
    expect(stockReading(titip)).toBe('—');
    expect(screen.getByTestId(`titip-${titip}`)).toHaveTextContent('Titip 8 pcs · bukan milik toko');
  });
});

describe('Pemasok — menjual titip', () => {
  it('menghabiskan barang milik sendiri dulu, lalu utang lahir dari unit titip yang terjual', async () => {
    const tepung = await seedVarian('Tepung terigu 1 kg', 'kg');
    await openPemasok();
    const supplierId = await addSupplier('Pemasok Titip');
    await recordNota(supplierId, [
      { varianId: tepung, settlement: 'tunai', qty: '2', harga: '3.000' },
      { varianId: tepung, settlement: 'titip', qty: '5', harga: '3.000' },
    ]);

    // Three sold: the two owned units go first, then one titip unit.
    await sellAtTill([{ varianId: tepung, qty: 3 }]);

    await openStok();
    expect(stockReading(tepung)).toBe('0');
    expect(screen.getByTestId(`titip-${tepung}`)).toHaveTextContent('Titip 4 kg · bukan milik toko');

    await openPemasok();
    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Utang Rp 3.000');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 0 · Titip terjual Rp 3.000 · Dibayar Rp 0',
    );

    // Four more: all titip, so the debt grows by 4 × 3.000.
    await sellAtTill([{ varianId: tepung, qty: 4 }]);
    await openPemasok();
    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Utang Rp 15.000');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 0 · Titip terjual Rp 15.000 · Dibayar Rp 0',
    );
  });
});

describe('Pemasok — mengembalikan titip', () => {
  it('mengurangi titip di rak tanpa mengubah uang', async () => {
    const tepung = await seedVarian('Tepung terigu 1 kg', 'kg');
    await openPemasok();
    const supplierId = await addSupplier('Pemasok Titip');
    await recordNota(supplierId, [
      { varianId: tepung, settlement: 'titip', qty: '10', harga: '5.000' },
    ]);

    fireEvent.press(screen.getByTestId(`kembali-${supplierId}`));
    await act(async () => {});
    fireEvent.press(screen.getByTestId(`kembali-varian-${tepung}`));
    fireEvent.changeText(screen.getByTestId('kembali-jumlah'), '4');
    fireEvent.press(screen.getByTestId('simpan-kembali'));
    await act(async () => {});

    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Tidak ada utang');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 0 · Titip terjual Rp 0 · Dibayar Rp 0',
    );
    expect(screen.getByTestId(`titip-pemasok-${supplierId}`)).toHaveTextContent('Titip di rak: 6 kg');

    await openStok();
    expect(stockReading(tepung)).toBe('—');
    expect(screen.getByTestId(`titip-${tepung}`)).toHaveTextContent('Titip 6 kg · bukan milik toko');
  });
});

describe('Pemasok — membayar sebagian', () => {
  it('mengurangi total dan membiarkan sisanya berlanjut', async () => {
    const tepung = await seedVarian('Tepung terigu 1 kg', 'kg');
    await openPemasok();
    const supplierId = await addSupplier('Pemasok Campur');
    await recordNota(supplierId, [
      { varianId: tepung, settlement: 'tempo', qty: '10', harga: '10.000' },
      { varianId: tepung, settlement: 'titip', qty: '4', harga: '10.000' },
    ]);
    // Sell all ten owned units and the four titip units: 100.000 + 40.000.
    await sellAtTill([{ varianId: tepung, qty: 14 }]);

    await openPemasok();
    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Utang Rp 140.000');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 100.000 · Titip terjual Rp 40.000 · Dibayar Rp 0',
    );

    fireEvent.press(screen.getByTestId(`bayar-${supplierId}`));
    await act(async () => {});
    expect(screen.getByTestId('bayar-total')).toHaveTextContent('Sisa utang Rp 140.000');
    fireEvent.changeText(screen.getByTestId('bayar-jumlah'), '50.000');
    fireEvent.press(screen.getByTestId('simpan-bayar'));
    await act(async () => {});

    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Utang Rp 90.000');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 100.000 · Titip terjual Rp 40.000 · Dibayar Rp 50.000',
    );

    fireEvent.press(screen.getByTestId(`bayar-${supplierId}`));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('bayar-jumlah'), '90.000');
    fireEvent.press(screen.getByTestId('simpan-bayar'));
    await act(async () => {});

    expect(screen.getByTestId(`utang-${supplierId}`)).toHaveTextContent('Tidak ada utang');
    expect(screen.getByTestId(`rincian-${supplierId}`)).toHaveTextContent(
      'Tempo Rp 100.000 · Titip terjual Rp 40.000 · Dibayar Rp 140.000',
    );
  });
});
