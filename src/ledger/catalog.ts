import type { JualBy, Satuan } from './types';

/**
 * Creating the three levels of master data: kategori → produk → varian
 * (GLOSSARY, ADR 0002).
 *
 * A varian's satuan is chosen here — a required argument, not an optional
 * field — and cannot be changed afterwards: no ledger event carries a new
 * satuan, so the type system enforces what the glossary asks for.
 */

export interface KategoriInput {
  nama: string;
}

export interface ProdukInput {
  kategoriId: string;
  nama: string;
}

export interface VarianInput {
  produkId: string;
  nama: string;
  kode: string | null;
  satuan: Satuan;
  jualBy: JualBy;
  harga: number;
}

export interface Catalog {
  /** Returns the created record's id. */
  createKategori(input: KategoriInput): Promise<string>;
  createProduk(input: ProdukInput): Promise<string>;
  createVarian(input: VarianInput): Promise<string>;
  /**
   * The owner's low-stock rule for one varian: "tell me below N" (user story
   * 41). Writes one stamped field, so an edit on the other phone to a different
   * field of the same varian survives. Returns the event's id.
   */
  setMinimum(varianId: string, minimum: number | null): Promise<string>;
}

/** An event ready to be appended. The ledger supplies the envelope. */
export interface EventDraft {
  type: string;
  payload: unknown;
}

/**
 * Validation lives here rather than in the form, so a screen cannot create a
 * nameless category or a varian with a fractional rupiah price by forgetting
 * a check.
 */
export function createCatalog(append: (type: string, payload: unknown) => Promise<string>): Catalog {
  return {
    async createKategori(input) {
      const nama = input.nama.trim();
      if (!nama) throw new CatalogError('Nama kategori wajib diisi.');
      return append('kategori.created', { nama, parentId: null });
    },

    async createProduk(input) {
      const nama = input.nama.trim();
      if (!nama) throw new CatalogError('Nama produk wajib diisi.');
      return append('produk.created', { kategoriId: input.kategoriId, nama });
    },

    async createVarian(input) {
      const nama = input.nama.trim();
      if (!nama) throw new CatalogError('Nama varian wajib diisi.');
      if (!input.satuan) throw new CatalogError('Satuan wajib dipilih.');
      if (!Number.isInteger(input.harga) || input.harga < 0) {
        throw new CatalogError('Harga harus angka rupiah bulat.');
      }
      return append('varian.created', {
        produkId: input.produkId,
        nama,
        kode: input.kode?.trim() || null,
        satuan: input.satuan,
        jualBy: input.jualBy,
        harga: input.harga,
      });
    },

    async setMinimum(varianId, minimum) {
      if (minimum !== null) {
        if (!Number.isFinite(minimum) || minimum < 0) throw new CatalogError('Minimum stok harus angka 0 atau lebih.');
        if (Math.abs(minimum * 4 - Math.round(minimum * 4)) > 1e-9) {
          throw new CatalogError('Minimum stok harus kelipatan 1/4.');
        }
      }
      return append('varian.updated', {
        varianId,
        minimum: { value: minimum, at: new Date().toISOString() },
      });
    },
  };
}

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}
