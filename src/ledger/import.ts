import { parseQty, parseRupiah } from '@/design';
import type { JualBy, Satuan, Shop } from './types';

/**
 * Reading the owner's spreadsheet into a plan, without writing anything.
 *
 * This is the pure half of the import: it says what would be created and which
 * rows are wrong, in the shop's own words and naming the row the owner can see
 * in their spreadsheet. The commit is a separate step (`Ledger.importCatalog`),
 * so a preview can be shown, corrected and only then accepted.
 *
 * Columns, in order: kategori, produk, varian, satuan, harga, kode, stok awal.
 * A header row is optional. Rows are separated by tab (a paste from a
 * spreadsheet) or semicolon (a saved CSV); a comma is not a separator because
 * Indonesian writes 12,5 with one.
 */

/** The units a varian may be counted in (GLOSSARY: Satuan). */
export const SATUAN_IMPOR: readonly Satuan[] = ['pcs', 'bungkus', 'kg', 'liter', 'sak'];

/** One row the owner must fix before anything can be imported. */
export interface ImportRowError {
  /** The line number in the pasted text, counting the header. */
  baris: number;
  /** The whole sentence, already naming the row. */
  pesan: string;
}

export interface ImportKategori {
  nama: string;
}

export interface ImportProduk {
  /** The kategori's name; resolved to an id at commit time. */
  kategori: string;
  nama: string;
}

export interface ImportVarian {
  /** The produk's name; resolved to an id at commit time. */
  produk: string;
  nama: string;
  kode: string | null;
  satuan: Satuan;
  jualBy: JualBy;
  harga: number;
  /** The opening count from the sheet, or null when the row left it blank. */
  stokAwal: number | null;
}

/** What the preview shows, and what the commit writes. */
export interface ImportPlan {
  /** Only the categories that do not exist yet. */
  kategori: ImportKategori[];
  /** Only the products that do not exist yet. */
  produk: ImportProduk[];
  /** Every row's varian, in the order the rows appear. */
  varian: ImportVarian[];
  errors: ImportRowError[];
}

/** What a committed import created. */
export interface ImportCommit {
  kategori: number;
  produk: number;
  varian: number;
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

const key = (value: string) => value.trim().toLowerCase();

/**
 * Read the pasted text against the shop as it is now. Existing categories and
 * products are reused by name, so importing into a shop that already has
 * "Sembako" does not create a second one; a varian that already exists is a
 * row error rather than a silent duplicate.
 */
export function planImport(text: string, shop: Shop): ImportPlan {
  const plan: ImportPlan = { kategori: [], produk: [], varian: [], errors: [] };

  const kategoriAda = new Set(
    shop.kategori.filter((entry) => !entry.archived).map((entry) => key(entry.nama)),
  );
  const produkAda = new Map(
    shop.produk.filter((entry) => !entry.archived).map((entry) => [key(entry.nama), entry]),
  );
  const varianAda = new Set(
    shop.varian
      .filter((entry) => !entry.archived)
      .map((entry) => `${entry.produkId}|${key(entry.nama)}`),
  );
  const kategoriBaru = new Set<string>();
  const produkBaru = new Set<string>();
  const varianBaru = new Set<string>();

  const lines = text.split(/\r?\n/);
  let first = true;

  for (let index = 0; index < lines.length; index += 1) {
    const baris = index + 1;
    const line = lines[index];
    if (line.trim() === '') continue;

    const separator = line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
    if (separator === null) {
      plan.errors.push({ baris, pesan: `Baris ${baris}: kolom harus dipisah tab atau titik koma.` });
      first = false;
      continue;
    }

    const cells = line.split(separator).map((cell) => cell.trim());
    // A header is recognised only as the first non-empty line, so a category
    // that happens to be called "Kategori" further down is still data.
    if (first && key(cells[0] ?? '') === 'kategori') {
      first = false;
      continue;
    }
    first = false;

    const [kategoriRaw = '', produkRaw = '', varianRaw = '', satuanRaw = '', hargaRaw = '', kodeRaw = '', stokRaw = ''] =
      cells;
    const salah = (pesan: string) => plan.errors.push({ baris, pesan: `Baris ${baris}: ${pesan}` });

    if (!kategoriRaw) {
      salah('kategori wajib diisi.');
      continue;
    }
    if (!produkRaw) {
      salah('produk wajib diisi.');
      continue;
    }
    if (!varianRaw) {
      salah('nama varian wajib diisi.');
      continue;
    }
    if (!SATUAN_IMPOR.includes(satuanRaw as Satuan)) {
      salah('satuan wajib diisi (pcs, bungkus, kg, liter, sak).');
      continue;
    }
    const harga = parseRupiah(hargaRaw);
    if (harga === null) {
      salah('harga harus angka rupiah bulat.');
      continue;
    }
    let stokAwal: number | null = null;
    if (stokRaw !== '') {
      const qty = parseQty(stokRaw);
      if (qty === null || Math.abs(qty * 4 - Math.round(qty * 4)) > 1e-9) {
        salah('stok awal harus angka kelipatan 1/4.');
        continue;
      }
      stokAwal = qty;
    }

    const produkKey = key(produkRaw);
    const varianKey = `${produkKey}|${key(varianRaw)}`;
    const existingProduk = produkAda.get(produkKey);

    if (existingProduk && varianAda.has(`${existingProduk.id}|${key(varianRaw)}`)) {
      salah(`varian ${varianRaw} sudah ada di produk ${produkRaw}.`);
      continue;
    }
    if (varianBaru.has(varianKey)) {
      salah(`varian ${varianRaw} muncul lebih dari sekali.`);
      continue;
    }

    if (!existingProduk && !produkBaru.has(produkKey)) {
      const kategoriKey = key(kategoriRaw);
      if (!kategoriAda.has(kategoriKey) && !kategoriBaru.has(kategoriKey)) {
        plan.kategori.push({ nama: kategoriRaw });
        kategoriBaru.add(kategoriKey);
      }
      plan.produk.push({ kategori: kategoriRaw, nama: produkRaw });
      produkBaru.add(produkKey);
    }

    plan.varian.push({
      produk: produkRaw,
      nama: varianRaw,
      kode: kodeRaw || null,
      satuan: satuanRaw as Satuan,
      // The sheet has no column for it, and a varian sold by weight is the
      // exception; the owner can change it later like any other field.
      jualBy: 'unit',
      harga,
      stokAwal,
    });
    varianBaru.add(varianKey);
  }

  return plan;
}
