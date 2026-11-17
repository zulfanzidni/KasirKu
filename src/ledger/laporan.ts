import { liveSales } from './queries';
import { normaliseQty } from './stock';
import type { Sale, Satuan, Shop } from './types';

/**
 * Laporan — what the shop sold, folded from the log over a window the owner
 * chose (spec §Analytics, ADR 0001).
 *
 * Nothing here is stored: the report is a view over the sales the log already
 * holds. A voided sale is skipped, so a correction cannot inflate a period.
 *
 * The report always states its basis. A "today" that has not synced, or that
 * still has local events waiting to go out, is not the whole shop's day — the
 * screen must say so rather than let a low figure read as truth.
 */

/** The periods the owner can ask for. */
export type LaporanPreset = 'hari' | 'minggu' | 'bulan' | 'kustom';

/** How the owner narrowed the report. Presets and the two narrowings combine. */
export interface LaporanFilter {
  preset: LaporanPreset;
  /** For `kustom` only: inclusive local day keys, `YYYY-MM-DD`. */
  dari?: string;
  sampai?: string;
  /** A kategori, and the kategori below it, or null for all. */
  kategoriId: string | null;
  /** One varian, or null for all. */
  varianId: string | null;
}

/** The window the report covers, as inclusive local day keys. */
export interface LaporanRentang {
  preset: LaporanPreset;
  dari: string;
  sampai: string;
}

/** What the sync could not guarantee: the basis every figure rests on. */
export interface LaporanSync {
  lastSyncAt: string | null;
  unsentCount: number;
}

/** The two figures a period is compared on. */
export interface LaporanRingkasan {
  penjualan: number;
  transaksi: number;
}

/** One bucket of the sales-over-time view. */
export interface LaporanTitik {
  /** The local day key, or the Monday that starts the week. */
  kunci: string;
  penjualan: number;
  transaksi: number;
}

/** A week bucket, with the Sunday it ends on. */
export interface LaporanMinggu extends LaporanTitik {
  sampai: string;
}

/** One row of a ranking: a produk, a kategori, or a varian. */
export interface LaporanBaris {
  id: string;
  nama: string;
  /** The value of the goods, before any cart discount. */
  penjualan: number;
  /** Only on unit rankings: how many of the varian's own satuan sold. */
  qty?: number;
}

/**
 * A ranking, or the honest admission that the log cannot support one yet.
 * `kurang` is first-class, the way `tidakTahu` is for low stock: a three-day
 * "best seller" is not a fact, and the report must not present it as one.
 */
export type LaporanKurang = { kind: 'kurang'; sebab: 'belum-ada' | 'riwayat-sedikit'; hari: number };
export type LaporanPeringkat = { kind: 'cukup'; rows: LaporanBaris[] } | LaporanKurang;

/** One satuan's own league table. Units are never pooled across these. */
export interface LaporanSatuan {
  satuan: Satuan;
  rows: LaporanBaris[];
}

export type LaporanSatuanHasil = { kind: 'cukup'; groups: LaporanSatuan[] } | LaporanKurang;

/** How many days of selling the shop needs before a ranking is a claim it can make. */
export const MIN_HARI_LAPORAN = 7;

export interface Laporan {
  rentang: LaporanRentang;
  /** The same-length window immediately before, for the comparison. */
  rentangSebelumnya: LaporanRentang;
  /** The value of the goods sold in the window, before any cart discount. */
  penjualan: number;
  /** Sales in the window with at least one matching line. */
  transaksi: number;
  /** The same two figures for the previous window. */
  sebelumnya: LaporanRingkasan;
  /** Every day in the window, quiet days included. */
  perHari: LaporanTitik[];
  /** The same sales grouped into Monday-to-Sunday weeks. */
  perMinggu: LaporanMinggu[];
  /** Best products by revenue: the one league table where units do not matter. */
  produk: LaporanPeringkat;
  /** Unit rankings, each satuan on its own: kg is never ranked against bungkus. */
  satuan: LaporanSatuanHasil;
  /** Totals per kategori. A kategori total is not a product total. */
  kategori: LaporanBaris[];
  /** The filters as the report writes them, so a figure is never read out of context. */
  tampilanFilter: {
    rentang: string;
    kategori: string;
    barang: string;
  };
  dasar: {
    /** The day boundary the window is counted on. */
    hari: string;
    /** When this phone last exchanged with the other phones; null if never. */
    lastSyncAt: string | null;
    /** This phone's events the shared place has not acknowledged. */
    unsentCount: number;
  };
}

/** The report the owner lands on: this month, everything in it. */
export function defaultFilter(): LaporanFilter {
  return { preset: 'bulan', kategoriId: null, varianId: null };
}

/** A local `YYYY-MM-DD` day key, the same day boundary `dayStamp` uses for nota numbers. */
export function tanggalLokal(at: string | Date): string {
  const moment = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(moment.getTime())) return '0000-00-00';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}

function hariKeyPada(kunci: string): Date {
  const [year, month, day] = kunci.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** A day key moved by whole days, staying on the local calendar. */
export function geserHari(kunci: string, delta: number): string {
  const moment = hariKeyPada(kunci);
  moment.setDate(moment.getDate() + delta);
  return tanggalLokal(moment);
}

/**
 * The window a filter asks for. A preset is read off the owner's own clock:
 * "minggu ini" starts on Monday, because that is how the shop's week is spoken.
 */
export function rentangDari(filter: LaporanFilter, now: Date = new Date()): LaporanRentang {
  const hariIni = tanggalLokal(now);

  if (filter.preset === 'kustom') {
    const dari = filter.dari ?? hariIni;
    const sampai = filter.sampai ?? hariIni;
    return dari <= sampai ? { preset: 'kustom', dari, sampai } : { preset: 'kustom', dari: sampai, sampai: dari };
  }
  if (filter.preset === 'hari') {
    return { preset: 'hari', dari: hariIni, sampai: hariIni };
  }
  if (filter.preset === 'minggu') {
    // getDay() is Sunday-first; the shop's week starts on Monday.
    const offset = (now.getDay() + 6) % 7;
    return { preset: 'minggu', dari: geserHari(hariIni, -offset), sampai: hariIni };
  }
  return { preset: 'bulan', dari: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, sampai: hariIni };
}

function dalamRentang(sale: Sale, rentang: LaporanRentang): boolean {
  const hari = tanggalLokal(sale.createdAt);
  return hari >= rentang.dari && hari <= rentang.sampai;
}

/** A day key as a day number, so a window's length is exact across months. */
function hariKeNomor(kunci: string): number {
  const [year, month, day] = kunci.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * The equivalent previous period: the same number of local days, immediately
 * before the window. "This week vs last week" is then a comparison of equal
 * spans, and the report names the dates it used.
 */
export function rentangSebelumnya(rentang: LaporanRentang): LaporanRentang {
  const panjang = hariKeNomor(rentang.sampai) - hariKeNomor(rentang.dari) + 1;
  const sampai = geserHari(rentang.dari, -1);
  return { preset: rentang.preset, dari: geserHari(sampai, -(panjang - 1)), sampai };
}

/** A day key as the shop writes a date: 17/11/2026. */
export function tanggalPendek(kunci: string): string {
  const [year, month, day] = kunci.split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
}

/** What the report calls the window it used. */
export function labelRentang(rentang: LaporanRentang): string {
  const label =
    rentang.dari === rentang.sampai
      ? tanggalPendek(rentang.dari)
      : `${tanggalPendek(rentang.dari)}–${tanggalPendek(rentang.sampai)}`;
  switch (rentang.preset) {
    case 'hari':
      return `Hari ini, ${label}`;
    case 'minggu':
      return `Minggu ini, ${label}`;
    case 'bulan':
      return `Bulan ini, ${label}`;
    case 'kustom':
      return label;
  }
}

/** The Monday a local day key belongs to. */
function seninDari(kunci: string): string {
  const moment = hariKeyPada(kunci);
  const offset = (moment.getDay() + 6) % 7;
  return geserHari(kunci, -offset);
}

/** Every day in the window, with what it sold. A quiet day is a zero, not a gap. */
function titikHarian(matches: readonly { hari: string; penjualan: number }[], rentang: LaporanRentang): LaporanTitik[] {
  const rows = new Map<string, LaporanTitik>();
  let hari = rentang.dari;
  // A guard, not a limit: a window of years is still a window, but a bad key
  // must never spin forever.
  for (let guard = 0; hari <= rentang.sampai && guard < 5000; guard += 1) {
    rows.set(hari, { kunci: hari, penjualan: 0, transaksi: 0 });
    hari = geserHari(hari, 1);
  }
  for (const match of matches) {
    const row = rows.get(match.hari);
    if (!row) continue;
    row.penjualan += match.penjualan;
    row.transaksi += 1;
  }
  return [...rows.values()];
}

/** The day buckets folded into the shop's Monday-to-Sunday weeks. */
function titikMingguan(harian: readonly LaporanTitik[]): LaporanMinggu[] {
  const rows = new Map<string, LaporanMinggu>();
  for (const titik of harian) {
    const senin = seninDari(titik.kunci);
    let row = rows.get(senin);
    if (!row) {
      row = { kunci: senin, sampai: geserHari(senin, 6), penjualan: 0, transaksi: 0 };
      rows.set(senin, row);
    }
    row.penjualan += titik.penjualan;
    row.transaksi += titik.transaksi;
  }
  return [...rows.values()];
}

/** One sold line, with the master data it resolves to. */
interface BarisTerjual {
  hari: string;
  saleId: string;
  line: Sale['lines'][number];
  varian: Shop['varian'][number] | undefined;
  produk: Shop['produk'][number] | undefined;
}

/** The distinct local days on which the shop has ever sold, up to the window's end. */
function hariPenjualan(shop: Shop, sampai: string): number {
  const days = new Set<string>();
  for (const sale of liveSales(shop)) {
    const hari = tanggalLokal(sale.createdAt);
    if (hari <= sampai) days.add(hari);
  }
  return days.size;
}

/**
 * A kategori and every kategori below it. Filtering by "Sembako" must include
 * the products filed under "Tepung", or the owner's own grouping would lie.
 */
function kategoriDenganTurunan(shop: Shop, kategoriId: string): Set<string> {
  const ids = new Set([kategoriId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of shop.kategori) {
      if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.id)) {
        ids.add(entry.id);
        changed = true;
      }
    }
  }
  return ids;
}

/**
 * A ranking, or the reason it cannot be made. Revenue is comparable across
 * units, so products are ranked by it; the count of selling days is what says
 * whether the shop has lived long enough for the ranking to mean anything.
 */
function peringkatProduk(baris: readonly BarisTerjual[], hari: number): LaporanPeringkat {
  if (baris.length === 0) return { kind: 'kurang', sebab: 'belum-ada', hari };
  if (hari < MIN_HARI_LAPORAN) return { kind: 'kurang', sebab: 'riwayat-sedikit', hari };

  const rows = new Map<string, LaporanBaris>();
  for (const entry of baris) {
    const id = entry.produk?.id ?? entry.varian?.id ?? entry.line.varianId;
    const nama = entry.produk?.nama ?? entry.varian?.nama ?? entry.line.nama;
    const row = rows.get(id) ?? { id, nama, penjualan: 0 };
    row.penjualan += entry.line.jumlah;
    rows.set(id, row);
  }

  return {
    kind: 'cukup',
    rows: [...rows.values()].sort(
      (left, right) => right.penjualan - left.penjualan || left.nama.localeCompare(right.nama, 'id'),
    ),
  };
}

/**
 * Unit rankings, one table per satuan. A kilogram and a bungkus are different
 * physical things; adding them would produce a number that means nothing, so
 * the split is structural rather than a formatting choice.
 */
function peringkatSatuan(baris: readonly BarisTerjual[], hari: number): LaporanSatuanHasil {
  if (baris.length === 0) return { kind: 'kurang', sebab: 'belum-ada', hari };
  if (hari < MIN_HARI_LAPORAN) return { kind: 'kurang', sebab: 'riwayat-sedikit', hari };

  const groups = new Map<Satuan, Map<string, LaporanBaris>>();
  for (const entry of baris) {
    const satuan = entry.line.satuan;
    let rows = groups.get(satuan);
    if (!rows) {
      rows = new Map<string, LaporanBaris>();
      groups.set(satuan, rows);
    }
    const id = entry.varian?.id ?? entry.line.varianId;
    const nama = entry.varian?.nama ?? entry.line.nama;
    const row = rows.get(id) ?? { id, nama, penjualan: 0, qty: 0 };
    row.penjualan += entry.line.jumlah;
    row.qty = normaliseQty((row.qty ?? 0) + entry.line.qty);
    rows.set(id, row);
  }

  return {
    kind: 'cukup',
    groups: [...groups.entries()]
      .map(([satuan, rows]) => ({
        satuan,
        rows: [...rows.values()].sort(
          (left, right) =>
            (right.qty ?? 0) - (left.qty ?? 0) ||
            right.penjualan - left.penjualan ||
            left.nama.localeCompare(right.nama, 'id'),
        ),
      }))
      .sort((left, right) => totalOf(right.rows) - totalOf(left.rows) || left.satuan.localeCompare(right.satuan)),
  };
}

function totalOf(rows: readonly LaporanBaris[]): number {
  return rows.reduce((sum, row) => sum + row.penjualan, 0);
}

/**
 * Totals per kategori. A kategori is a grouping, so its total is the sum of
 * every product under it — a different number from any one product's total,
 * and the report shows both rather than letting one stand in for the other.
 */
function totalKategori(baris: readonly BarisTerjual[], shop: Shop): LaporanBaris[] {
  const namaKategori = new Map(shop.kategori.map((entry) => [entry.id, entry.nama]));
  const rows = new Map<string, LaporanBaris>();

  for (const entry of baris) {
    const kategoriId = entry.produk?.kategoriId ?? null;
    const id = kategoriId ?? 'tanpa-kategori';
    const nama = (kategoriId ? namaKategori.get(kategoriId) : null) ?? 'Tanpa kategori';
    const row = rows.get(id) ?? { id, nama, penjualan: 0 };
    row.penjualan += entry.line.jumlah;
    rows.set(id, row);
  }

  return [...rows.values()].sort(
    (left, right) => right.penjualan - left.penjualan || left.nama.localeCompare(right.nama, 'id'),
  );
}

/**
 * Build the report the owner reads. Pure over the folded shop: the same sales
 * always produce the same figures, on either phone.
 */
export function buildLaporan(input: {
  shop: Shop;
  filter: LaporanFilter;
  sync: LaporanSync;
  now?: Date;
}): Laporan {
  const now = input.now ?? new Date();
  const rentang = rentangDari(input.filter, now);
  const lalu = rentangSebelumnya(rentang);
  const shop = input.shop;
  const kategori = input.filter.kategoriId
    ? shop.kategori.find((entry) => entry.id === input.filter.kategoriId)
    : null;
  const barang = input.filter.varianId ? shop.varian.find((entry) => entry.id === input.filter.varianId) : null;

  const varianOf = new Map(shop.varian.map((entry) => [entry.id, entry]));
  const produkOf = new Map(shop.produk.map((entry) => [entry.id, entry]));
  const kategoriIds = input.filter.kategoriId ? kategoriDenganTurunan(shop, input.filter.kategoriId) : null;

  /** Both narrowings hold at once: a barang outside the chosen kategori is not in the report. */
  const cocok = (entry: BarisTerjual): boolean => {
    if (input.filter.varianId && entry.line.varianId !== input.filter.varianId) return false;
    if (kategoriIds) {
      const kategoriId = entry.produk?.kategoriId;
      if (!kategoriId || !kategoriIds.has(kategoriId)) return false;
    }
    return true;
  };

  const kini = kumpulkan(shop, rentang, cocok, varianOf, produkOf);
  const sebelumnya = kumpulkan(shop, lalu, cocok, varianOf, produkOf);
  const perHari = titikHarian(kini.matches, rentang);
  const hari = hariPenjualan(shop, rentang.sampai);

  return {
    rentang,
    rentangSebelumnya: lalu,
    penjualan: kini.penjualan,
    transaksi: kini.transaksi,
    sebelumnya: { penjualan: sebelumnya.penjualan, transaksi: sebelumnya.transaksi },
    perHari,
    perMinggu: titikMingguan(perHari),
    produk: peringkatProduk(kini.baris, hari),
    satuan: peringkatSatuan(kini.baris, hari),
    kategori: totalKategori(kini.baris, shop),
    tampilanFilter: {
      rentang: labelRentang(rentang),
      kategori: kategori?.nama ?? 'Semua kategori',
      barang: barang?.nama ?? 'Semua barang',
    },
    dasar: {
      hari: 'Hari lokal 00.00–23.59',
      lastSyncAt: input.sync.lastSyncAt,
      unsentCount: input.sync.unsentCount,
    },
  };
}

/** The matching lines and their totals for one window. */
function kumpulkan(
  shop: Shop,
  rentang: LaporanRentang,
  cocok: (entry: BarisTerjual) => boolean,
  varianOf: ReadonlyMap<string, Shop['varian'][number]>,
  produkOf: ReadonlyMap<string, Shop['produk'][number]>,
): { penjualan: number; transaksi: number; baris: BarisTerjual[]; matches: { hari: string; penjualan: number }[] } {
  let penjualan = 0;
  const baris: BarisTerjual[] = [];
  const matches: { hari: string; penjualan: number }[] = [];

  for (const sale of liveSales(shop)) {
    if (!dalamRentang(sale, rentang)) continue;
    const hari = tanggalLokal(sale.createdAt);
    let nilai = 0;
    let cocokBaris = 0;
    for (const line of sale.lines) {
      const varian = varianOf.get(line.varianId);
      const produk = varian ? produkOf.get(varian.produkId) : undefined;
      const entry: BarisTerjual = { hari, saleId: sale.id, line, varian, produk };
      if (!cocok(entry)) continue;
      baris.push(entry);
      nilai += line.jumlah;
      cocokBaris += 1;
    }
    // A sale with no matching line is not a transaction in this report.
    if (cocokBaris === 0) continue;
    matches.push({ hari, penjualan: nilai });
    penjualan += nilai;
  }

  return { penjualan, transaksi: matches.length, baris, matches };
}
