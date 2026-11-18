import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { LaporanScreen } from '@/screens/Laporan';
import type { StoredEvent } from '@/ledger/store';
import type { Satuan } from '@/ledger/types';
import { mockPhone, phoneLedger, PHONE_PORTRAIT, resetPhone, setWindow, waitReady, wrap } from './testPhone';

/**
 * Laporan in the other shape. Landscape is where the day's figures and the
 * ranking stop being one long scroll and become two columns; these tests hold
 * that cut in place, and that the chips still drive both columns from the one
 * filter state.
 *
 * The assertions are about what is on screen and which column it is in, never
 * about widths or style values: a column may be wider tomorrow without the
 * report changing.
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
  setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
});

afterAll(() => setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height));

const sekarang = new Date();

/** A local moment a number of days from today, at noon so no test straddles midnight. */
function hariKe(delta: number): Date {
  return new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() + delta, 12, 0, 0);
}

interface Barang {
  kategoriId: string;
  produkId: string;
  varianId: string;
  nama: string;
  satuan: Satuan;
  harga: number;
}

async function seedBarang(nama: string, satuan: Satuan, harga: number): Promise<Barang> {
  const kategoriId = await phoneLedger().append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await phoneLedger().append('produk.created', { kategoriId, nama });
  const varianId = await phoneLedger().append('varian.created', {
    produkId,
    nama,
    kode: null,
    satuan,
    jualBy: satuan === 'kg' || satuan === 'liter' ? 'weight' : 'unit',
    harga,
  });
  return { kategoriId, produkId, varianId, nama, satuan, harga };
}

/** A sale appended at an exact moment, as the till writes it. */
async function seedSale(at: Date, barang: Barang, qty: number): Promise<void> {
  const { id, seq } = await mockPhone.store.nextIdentity();
  const jumlah = Math.round(barang.harga * qty);
  await mockPhone.store.append([
    {
      id,
      deviceId: 'gawai-uji',
      seq,
      createdAt: at.toISOString(),
      type: 'sale.completed',
      payload: {
        number: `20260101-UJI-${String(seq).padStart(3, '0')}`,
        lines: [
          {
            varianId: barang.varianId,
            nama: barang.nama,
            satuan: barang.satuan,
            qty,
            harga: barang.harga,
            jumlah,
          },
        ],
        total: jumlah,
        payment: {
          method: 'tunai',
          discount: 0,
          cashStep: 500,
          rounding: 0,
          net: jumlah,
          tendered: jumlah,
          kembalian: 0,
          unpaid: 0,
        },
      },
    } as StoredEvent,
  ]);
}

/** Seven days of selling, so the ranking is a claim the report is willing to make. */
async function seedSeminggu(barang: Barang): Promise<void> {
  for (let hari = -6; hari <= 0; hari += 1) {
    await seedSale(hariKe(hari), barang, 1);
  }
}

async function openLaporan(width: number, height: number) {
  mockPhone.kv.set('device_id', 'gawai-uji');
  setWindow(width, height);
  render(wrap(<LaporanScreen />));
  return waitReady(act);
}

describe('Laporan - landscape', () => {
  it('puts the figures in the first column and the ranking beside them', async () => {
    const kopi = await seedBarang('Kopi sachet', 'pcs', 1_000);
    await seedSeminggu(kopi);

    await openLaporan(891, 411);

    const kiri = within(screen.getByTestId('laporan-kolom-kiri'));
    const kanan = within(screen.getByTestId('laporan-kolom-kanan'));

    // The headline figures come first in reading order: the left column.
    expect(kiri.getByTestId('laporan-total')).toHaveTextContent(/Rp 7\.000/);
    expect(kiri.getByTestId('laporan-total')).toHaveTextContent(/7 transaksi/);
    expect(kiri.getByTestId('laporan-banding')).toBeTruthy();
    expect(kiri.getByTestId('laporan-dasar-hari')).toBeTruthy();

    // The ranking is the other column, not a second copy of the figures.
    expect(kanan.getByTestId(`laporan-produk-${kopi.produkId}`)).toHaveTextContent(/1\. Kopi sachet/);
    expect(kanan.getByTestId('laporan-satuan-pcs')).toHaveTextContent(/Peringkat per pcs/);
    expect(kanan.getByTestId(`laporan-kategori-${kopi.kategoriId}`)).toHaveTextContent(/Rp 7\.000/);

    // Each section lives in exactly one column.
    expect(kiri.queryByTestId(`laporan-produk-${kopi.produkId}`)).toBeNull();
    expect(kanan.queryByTestId('laporan-total')).toBeNull();
  });

  it('drives both columns from the same range chips', async () => {
    const kopi = await seedBarang('Kopi sachet', 'pcs', 1_000);
    await seedSeminggu(kopi);

    await openLaporan(891, 411);

    // Narrowing to today changes the figures on the left...
    fireEvent.press(screen.getByTestId('filter-hari'));
    await act(async () => {});

    const kiri = within(screen.getByTestId('laporan-kolom-kiri'));
    const kanan = within(screen.getByTestId('laporan-kolom-kanan'));

    expect(kiri.getByTestId('laporan-total')).toHaveTextContent(/Rp 1\.000/);
    expect(kiri.getByTestId('laporan-total')).toHaveTextContent(/1 transaksi/);

    // ...and the ranking on the right, which now sums only today's sale.
    expect(kanan.getByTestId(`laporan-produk-${kopi.produkId}`)).toHaveTextContent(/Rp 1\.000/);

    // Widening again brings the whole week back, from the same state.
    fireEvent.press(screen.getByTestId('filter-bulan'));
    await act(async () => {});

    expect(kiri.getByTestId('laporan-total')).toHaveTextContent(/Rp 7\.000/);
    expect(kanan.getByTestId(`laporan-produk-${kopi.produkId}`)).toHaveTextContent(/Rp 7\.000/);
  });

  it('keeps portrait as one column, with no column containers', async () => {
    const kopi = await seedBarang('Kopi sachet', 'pcs', 1_000);
    await seedSeminggu(kopi);

    await openLaporan(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);

    expect(screen.queryByTestId('laporan-kolom-kiri')).toBeNull();
    expect(screen.queryByTestId('laporan-kolom-kanan')).toBeNull();

    // The same sections are still there, in the portrait stack.
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 7\.000/);
    expect(screen.getByTestId(`laporan-produk-${kopi.produkId}`)).toHaveTextContent(/1\. Kopi sachet/);
  });
});
