import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LaporanScreen } from '@/screens/Laporan';
import type { StoredEvent } from '@/ledger/store';
import type { JualBy, Satuan } from '@/ledger/types';
import { app, mockPhone, phoneLedger, resetPhone, waitReady, wrap } from './testPhone';

/**
 * Laporan, driven the way the owner drives it: pick a period, narrow it to a
 * kategori or one barang, and read what the shop sold. Every assertion is what
 * the report shows, in the shop's own words; the sales are seeded into the real
 * log, so the fold under test is the one that runs on the phone.
 *
 * The dates are relative to today, because the report is about the local day
 * boundary (GLOSSARY: the shop's day, not UTC).
 */

jest.setTimeout(30_000);

beforeEach(() => {
  resetPhone();
});

const sekarang = new Date();

/** A local moment a number of days from today, at noon so no test straddles midnight. */
function hariKe(delta: number, jam = 12): Date {
  return new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() + delta, jam, 0, 0);
}

function kunci(d: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Barang {
  kategoriId: string;
  produkId: string;
  varianId: string;
  nama: string;
  satuan: Satuan;
  harga: number;
}

async function seedKategori(nama: string, parentId: string | null = null): Promise<string> {
  return phoneLedger().append('kategori.created', { nama, parentId });
}

async function seedProduk(kategoriId: string, nama: string): Promise<string> {
  return phoneLedger().append('produk.created', { kategoriId, nama });
}

async function seedVarian(
  produkId: string,
  input: { nama: string; satuan: Satuan; harga: number; jualBy?: JualBy },
): Promise<Barang> {
  const varianId = await phoneLedger().append('varian.created', {
    produkId,
    nama: input.nama,
    kode: null,
    satuan: input.satuan,
    jualBy: input.jualBy ?? (input.satuan === 'kg' || input.satuan === 'liter' ? 'weight' : 'unit'),
    harga: input.harga,
  });
  return { kategoriId: '', produkId, varianId, nama: input.nama, satuan: input.satuan, harga: input.harga };
}

/** One line as the till writes it: price and unit snapshotted on the sale. */
interface Baris {
  barang: Barang;
  qty: number;
}

/** A sale appended at an exact moment, so a test can live in two periods at once. */
async function seedSale(at: Date, lines: Baris[], options: { dibatalkan?: boolean } = {}): Promise<string> {
  const { id, seq } = await mockPhone.store.nextIdentity();
  const payload = {
    number: `20260101-UJI-${String(seq).padStart(3, '0')}`,
    lines: lines.map(({ barang, qty }) => ({
      varianId: barang.varianId,
      nama: barang.nama,
      satuan: barang.satuan,
      qty,
      harga: barang.harga,
      jumlah: Math.round(barang.harga * qty),
    })),
    total: lines.reduce((sum, { barang, qty }) => sum + Math.round(barang.harga * qty), 0),
  };
  await mockPhone.store.append([
    {
      id,
      deviceId: 'gawai-uji',
      seq,
      createdAt: at.toISOString(),
      type: 'sale.completed',
      payload: { ...payload, payment: paymentOf(payload.total) },
    } as StoredEvent,
  ]);

  if (options.dibatalkan) {
    const voidId = await mockPhone.store.nextIdentity();
    await mockPhone.store.append([
      {
        id: voidId.id,
        deviceId: 'gawai-uji',
        seq: voidId.seq,
        createdAt: new Date(at.getTime() + 60 * 60 * 1000).toISOString(),
        type: 'sale.voided',
        payload: { saleId: id, alasan: 'Salah input' },
      } as StoredEvent,
    ]);
  }

  return id;
}

function paymentOf(total: number) {
  return {
    method: 'tunai' as const,
    discount: 0,
    cashStep: 500,
    rounding: 0,
    net: total,
    tendered: total,
    kembalian: 0,
    unpaid: 0,
  };
}

async function openLaporan() {
  // The phone's own name, so the events seeded above are the ones it still has
  // to send: the report's "belum terkirim" count is about this phone's notes.
  mockPhone.kv.set('device_id', 'gawai-uji');
  render(wrap(<LaporanScreen />));
  return waitReady(act);
}

/** Tepung terigu 1 kg, Harga 10.000, sold by weight. */
async function tepung(): Promise<Barang> {
  const kategoriId = await seedKategori('Sembako');
  return barangDi(kategoriId, 'Tepung terigu', 'Tepung terigu 1 kg', 'kg', 10_000);
}

/** A produk with one varian, under a kategori the test already made. */
async function barangDi(
  kategoriId: string,
  produk: string,
  nama: string,
  satuan: Satuan,
  harga: number,
): Promise<Barang> {
  const produkId = await seedProduk(kategoriId, produk);
  const barang = await seedVarian(produkId, { nama, satuan, harga });
  return { ...barang, kategoriId };
}

describe('Laporan — penjualan dan dasar laporannya', () => {
  it('shows what the period sold, and states the basis of the figure', async () => {
    const barang = await tepung();
    await seedSale(hariKe(0), [{ barang, qty: 1 }]);

    await openLaporan();

    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/1 transaksi/);
    expect(screen.getByTestId('laporan-dasar-hari')).toHaveTextContent(/Hari lokal/);
    expect(screen.getByTestId('laporan-dasar-sinkron')).toHaveTextContent(/Belum pernah sinkron/);
    expect(screen.getByTestId('laporan-dasar-belum-terkirim')).toHaveTextContent(/catatan belum terkirim/);
  });

  it('shows the filters it applied, and a preset narrows the period', async () => {
    const barang = await tepung();
    await seedSale(hariKe(0), [{ barang, qty: 1 }]);
    // Forty days ago is never in this month, whatever today is.
    await seedSale(hariKe(-40), [{ barang, qty: 2 }]);

    await openLaporan();

    // The report opens on this month, and says so on its face.
    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Bulan ini/);
    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Semua kategori/);
    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Semua barang/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 10\.000/);

    fireEvent.press(screen.getByTestId('filter-hari'));
    await act(async () => {});

    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Hari ini/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/1 transaksi/);
  });

  it('this week leaves out a sale from ten days ago', async () => {
    const barang = await tepung();
    await seedSale(hariKe(0), [{ barang, qty: 1 }]);
    await seedSale(hariKe(-10), [{ barang, qty: 3 }]);

    await openLaporan();
    fireEvent.press(screen.getByTestId('filter-minggu'));
    await act(async () => {});

    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Minggu ini/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/1 transaksi/);
  });

  it('shows sales over time by day and by week', async () => {
    const barang = await tepung();
    const dari = kunci(hariKe(-16));
    const sampai = kunci(hariKe(-1));
    // A week apart, so the two sales can never share a week bucket.
    await seedSale(hariKe(-15), [{ barang, qty: 1 }]); // 10.000
    await seedSale(hariKe(-8), [{ barang, qty: 2 }]); // 20.000

    await openLaporan();
    fireEvent.press(screen.getByTestId('filter-kustom'));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('kustom-dari'), dari);
    fireEvent.changeText(screen.getByTestId('kustom-sampai'), sampai);
    fireEvent.press(screen.getByTestId('terapkan-kustom'));
    await act(async () => {});

    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 30\.000/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/2 transaksi/);

    // By day, including the quiet days: the gap is a fact, not a missing row.
    expect(screen.getByTestId(`laporan-hari-${kunci(hariKe(-15))}`)).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId(`laporan-hari-${kunci(hariKe(-8))}`)).toHaveTextContent(/Rp 20\.000/);
    expect(screen.getByTestId(`laporan-hari-${kunci(hariKe(-5))}`)).toHaveTextContent(/Rp 0/);

    // By week, each week its own sum.
    fireEvent.press(screen.getByTestId('tampilan-minggu'));
    await act(async () => {});

    expect(screen.getByTestId(`laporan-minggu-${seninDari(kunci(hariKe(-15)))}`)).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId(`laporan-minggu-${seninDari(kunci(hariKe(-8)))}`)).toHaveTextContent(/Rp 20\.000/);
  });

  it('ranks best products by revenue, so a kg and a bungkus can be compared', async () => {
    const kategoriId = await seedKategori('Sembako');
    const tepungBarang = await barangDi(kategoriId, 'Tepung terigu', 'Tepung terigu 1 kg', 'kg', 10_000);
    const indomie = await barangDi(kategoriId, 'Indomie goreng', 'Indomie goreng', 'bungkus', 3_000);
    const kopi = await barangDi(kategoriId, 'Kopi', 'Kopi sachet', 'pcs', 1_000);

    // Seven days of selling, so the shop has enough history to rank at all.
    for (let hari = -6; hari <= -1; hari += 1) {
      await seedSale(hariKe(hari), [{ barang: kopi, qty: 1 }]);
    }
    // Today: 2 kg of tepung (20.000) and 10 bungkus of Indomie (30.000).
    await seedSale(hariKe(0), [
      { barang: tepungBarang, qty: 2 },
      { barang: indomie, qty: 10 },
    ]);

    await openLaporan();

    // Revenue is the league table: the bungkus out-earns the kg, and the
    // ranking says so without ever adding their units together.
    expect(screen.getByTestId(`laporan-produk-${indomie.produkId}`)).toHaveTextContent(/1\. Indomie goreng/);
    expect(screen.getByTestId(`laporan-produk-${indomie.produkId}`)).toHaveTextContent(/Rp 30\.000/);
    expect(screen.getByTestId(`laporan-produk-${tepungBarang.produkId}`)).toHaveTextContent(/2\. Tepung terigu/);
    expect(screen.getByTestId(`laporan-produk-${tepungBarang.produkId}`)).toHaveTextContent(/Rp 20\.000/);
    expect(screen.getByTestId(`laporan-produk-${kopi.produkId}`)).toHaveTextContent(/3\. Kopi/);
  });

  it('splits unit rankings by satuan, so kg is never ranked against bungkus', async () => {
    const kategoriId = await seedKategori('Sembako');
    const tepungBarang = await barangDi(kategoriId, 'Tepung terigu', 'Tepung terigu 1 kg', 'kg', 10_000);
    const indomie = await barangDi(kategoriId, 'Indomie goreng', 'Indomie goreng', 'bungkus', 3_000);

    for (let hari = -6; hari <= -1; hari += 1) {
      await seedSale(hariKe(hari), [{ barang: tepungBarang, qty: 1 }]);
    }
    await seedSale(hariKe(0), [
      { barang: tepungBarang, qty: 2 },
      { barang: indomie, qty: 10 },
    ]);

    await openLaporan();

    // Each satuan has its own league table, with its own unit on every row.
    expect(screen.getByTestId('laporan-satuan-kg')).toHaveTextContent(/Peringkat per kg/);
    expect(screen.getByTestId(`laporan-satuan-kg-${tepungBarang.varianId}`)).toHaveTextContent(/8 kg/);
    expect(screen.getByTestId(`laporan-satuan-kg-${tepungBarang.varianId}`)).toHaveTextContent(/Rp 80\.000/);

    expect(screen.getByTestId('laporan-satuan-bungkus')).toHaveTextContent(/Peringkat per bungkus/);
    expect(screen.getByTestId(`laporan-satuan-bungkus-${indomie.varianId}`)).toHaveTextContent(/10 bungkus/);

    // The kg table never contains the bungkus item, and the other way round.
    expect(screen.queryByTestId(`laporan-satuan-kg-${indomie.varianId}`)).toBeNull();
    expect(screen.queryByTestId(`laporan-satuan-bungkus-${tepungBarang.varianId}`)).toBeNull();
  });

  it('reports a category total and a product total as different numbers', async () => {
    const kategoriTepung = await seedKategori('Tepung');
    const terigu = await barangDi(kategoriTepung, 'Tepung terigu', 'Tepung terigu 1 kg', 'kg', 10_000);
    const sagu = await barangDi(kategoriTepung, 'Tepung sagu', 'Tepung sagu 1 kg', 'kg', 5_000);

    // Enough history for the product ranking to be shown at all.
    const kategoriLain = await seedKategori('Minuman');
    const kopi = await barangDi(kategoriLain, 'Kopi', 'Kopi sachet', 'pcs', 1_000);
    for (let hari = -6; hari <= -1; hari += 1) {
      await seedSale(hariKe(hari), [{ barang: kopi, qty: 1 }]);
    }
    await seedSale(hariKe(0), [
      { barang: terigu, qty: 1 },
      { barang: sagu, qty: 1 },
    ]);

    await openLaporan();

    // The kategori is the sum of its products: 10.000 + 5.000.
    expect(screen.getByTestId(`laporan-kategori-${kategoriTepung}`)).toHaveTextContent(/Tepung/);
    expect(screen.getByTestId(`laporan-kategori-${kategoriTepung}`)).toHaveTextContent(/Rp 15\.000/);

    // Each product keeps its own, smaller number.
    expect(screen.getByTestId(`laporan-produk-${terigu.produkId}`)).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId(`laporan-produk-${sagu.produkId}`)).toHaveTextContent(/Rp 5\.000/);
  });

  it('filters by kategori and by one barang, and the two combine', async () => {
    const sembako = await seedKategori('Sembako');
    const terigu = await barangDi(sembako, 'Tepung terigu', 'Tepung terigu 1 kg', 'kg', 10_000);
    const gula = await barangDi(sembako, 'Gula pasir', 'Gula pasir 1 kg', 'kg', 15_000);
    const minuman = await seedKategori('Minuman');
    const kopi = await barangDi(minuman, 'Kopi', 'Kopi sachet', 'pcs', 2_000);

    await seedSale(hariKe(0), [
      { barang: terigu, qty: 1 }, // 10.000
      { barang: gula, qty: 1 }, // 15.000
      { barang: kopi, qty: 2 }, // 4.000
    ]);

    await openLaporan();
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 29\.000/);

    // One kategori: only its products count.
    fireEvent.press(screen.getByTestId(`filter-kategori-${sembako}`));
    await act(async () => {});
    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Sembako/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 25\.000/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/1 transaksi/);

    // One barang inside it: the two filters combine, not replace.
    fireEvent.press(screen.getByTestId('pilih-barang'));
    await act(async () => {});
    fireEvent.press(screen.getByTestId(`filter-barang-${gula.varianId}`));
    await act(async () => {});
    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Gula pasir 1 kg/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 15\.000/);

    // The same barang under another kategori matches nothing: both filters hold.
    fireEvent.press(screen.getByTestId(`filter-kategori-${minuman}`));
    await act(async () => {});
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 0/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/0 transaksi/);
  });

  it('compares the period against the equivalent previous period', async () => {
    const barang = await tepung();
    // A seven-day window, and the seven days before it.
    const dari = kunci(hariKe(-13));
    const sampai = kunci(hariKe(-7));
    await seedSale(hariKe(-10), [{ barang, qty: 2 }]); // 20.000 this period
    await seedSale(hariKe(-17), [{ barang, qty: 1 }]); // 10.000 the period before

    await openLaporan();
    fireEvent.press(screen.getByTestId('filter-kustom'));
    await act(async () => {});
    fireEvent.changeText(screen.getByTestId('kustom-dari'), dari);
    fireEvent.changeText(screen.getByTestId('kustom-sampai'), sampai);
    fireEvent.press(screen.getByTestId('terapkan-kustom'));
    await act(async () => {});

    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 20\.000/);
    // The previous window is the same length, immediately before this one.
    expect(screen.getByTestId('laporan-banding')).toHaveTextContent(
      new RegExp(`${tanggalPendekUji(kunci(hariKe(-20)))}–${tanggalPendekUji(kunci(hariKe(-14)))}`),
    );
    expect(screen.getByTestId('laporan-banding')).toHaveTextContent(/Rp 10\.000/);
    expect(screen.getByTestId('laporan-banding')).toHaveTextContent(/Naik Rp 10\.000/);
  });

  it('says the history is too thin rather than naming a confident best seller', async () => {
    const barang = await tepung();
    for (let hari = -2; hari <= 0; hari += 1) {
      await seedSale(hariKe(hari), [{ barang, qty: 1 }]);
    }

    await openLaporan();

    // The totals are facts and stay; the ranking is a claim, and it is refused.
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 30\.000/);
    expect(screen.getByTestId('laporan-produk-kurang')).toHaveTextContent(/Riwayat baru 3 hari penjualan/);
    expect(screen.getByTestId('laporan-produk-kurang')).toHaveTextContent(/7 hari/);
    expect(screen.queryByTestId(`laporan-produk-${barang.produkId}`)).toBeNull();
    expect(screen.getByTestId('laporan-satuan-kurang')).toBeTruthy();
  });

  it('says there is no sale in the window instead of ranking nothing', async () => {
    const barang = await tepung();
    await seedSale(hariKe(-40), [{ barang, qty: 1 }]);

    await openLaporan();
    fireEvent.press(screen.getByTestId('filter-hari'));
    await act(async () => {});

    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 0/);
    expect(screen.getByTestId('laporan-produk-kurang')).toHaveTextContent(/Belum ada penjualan/);
  });

  it('leaves a voided sale out of every figure', async () => {
    const kategoriId = await seedKategori('Sembako');
    const terigu = await barangDi(kategoriId, 'Tepung terigu', 'Tepung terigu 1 kg', 'kg', 10_000);
    const sagu = await barangDi(kategoriId, 'Tepung sagu', 'Tepung sagu 1 kg', 'kg', 20_000);
    const kopi = await barangDi(kategoriId, 'Kopi', 'Kopi sachet', 'pcs', 1_000);

    for (let hari = -6; hari <= -1; hari += 1) {
      await seedSale(hariKe(hari), [{ barang: kopi, qty: 1 }]);
    }
    await seedSale(hariKe(0), [{ barang: terigu, qty: 1 }]);
    await seedSale(hariKe(0), [{ barang: sagu, qty: 1 }], { dibatalkan: true });

    await openLaporan();

    // 6.000 of kopi over six days plus 10.000 of tepung today; the voided
    // 20.000 is not revenue, not a transaction, and not a ranked product.
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 16\.000/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/7 transaksi/);
    expect(screen.queryByTestId(`laporan-produk-${sagu.produkId}`)).toBeNull();
    expect(screen.getByTestId(`laporan-kategori-${kategoriId}`)).toHaveTextContent(/Rp 16\.000/);
  });

  it('shows the last sync and the unsent count after the phones exchange', async () => {
    const barang = await tepung();
    await seedSale(hariKe(0), [{ barang, qty: 1 }]);

    await openLaporan();
    expect(screen.getByTestId('laporan-dasar-sinkron')).toHaveTextContent(/Belum pernah sinkron/);
    expect(screen.getByTestId('laporan-dasar-belum-terkirim')).toHaveTextContent(/catatan belum terkirim/);

    await act(async () => {
      await app.syncNow();
    });

    expect(screen.getByTestId('laporan-dasar-sinkron')).toHaveTextContent(
      /Tersinkron terakhir \d{2}\/\d{2}\/\d{4} \d{2}\.\d{2}/,
    );
    expect(screen.getByTestId('laporan-dasar-belum-terkirim')).toHaveTextContent(/Semua catatan sudah terkirim/);
  });

  it('a parent kategori includes the kategori below it', async () => {
    const sembako = await seedKategori('Sembako');
    const tepungKategori = await seedKategori('Tepung', sembako);
    const terigu = await barangDi(tepungKategori, 'Tepung terigu', 'Tepung terigu 1 kg', 'kg', 10_000);
    const minuman = await seedKategori('Minuman');
    const kopi = await barangDi(minuman, 'Kopi', 'Kopi sachet', 'pcs', 2_000);

    await seedSale(hariKe(0), [
      { barang: terigu, qty: 1 },
      { barang: kopi, qty: 1 },
    ]);

    await openLaporan();
    fireEvent.press(screen.getByTestId(`filter-kategori-${sembako}`));
    await act(async () => {});

    // Sembako → Tepung: the parent's report includes the child's product.
    expect(screen.getByTestId('laporan-filter')).toHaveTextContent(/Sembako/);
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/Rp 10\.000/);
  });
});

/** A day key as the report writes it: 17/11/2026. */
function tanggalPendekUji(kunciHari: string): string {
  const [year, month, day] = kunciHari.split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
}

/** The Monday a local day key belongs to, as `YYYY-MM-DD`. */
function seninDari(kunciHari: string): string {
  const [year, month, day] = kunciHari.split('-').map(Number);
  const moment = new Date(year, month - 1, day);
  const offset = (moment.getDay() + 6) % 7;
  moment.setDate(moment.getDate() - offset);
  return kunci(moment);
}
