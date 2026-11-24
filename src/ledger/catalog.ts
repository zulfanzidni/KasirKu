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
   * Renames a kategori. Only the name is written, so its produk keep their own
   * names and their place (GLOSSARY: a kategori is a grouping, not a prefix).
   */
  updateKategori(kategoriId: string, input: { nama: string }): Promise<string>;
  /**
   * Renames a produk and/or moves it to another kategori. Only the fields
   * given are written, each stamped, so a rename on one phone and a move on
   * the other both survive. `kategoriId: null` leaves it uncategorised.
   */
  updateProduk(produkId: string, input: { nama?: string; kategoriId?: string | null }): Promise<string>;
  /** Hides a kategori from the working list; its produk stay, uncategorised. */
  archiveKategori(kategoriId: string): Promise<string>;
  /** Hides a produk and its varian from the till; history still reads it. */
  archiveProduk(produkId: string): Promise<string>;
  /** Hides a varian from the list and the till; its stock and history stay. */
  archiveVarian(varianId: string): Promise<string>;
  /** Brings an archived kategori back into the working list. */
  restoreKategori(kategoriId: string): Promise<string>;
  /** Brings an archived produk back; its live varian return with it. */
  restoreProduk(produkId: string): Promise<string>;
  /**
   * Brings an archived varian back. It is only sellable again once its produk
   * is live too, so restoring a varian never silently reopens a hidden produk.
   */
  restoreVarian(varianId: string): Promise<string>;
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

    async updateKategori(kategoriId, input) {
      const nama = input.nama.trim();
      if (!nama) throw new CatalogError('Nama kategori wajib diisi.');
      return append('kategori.updated', {
        kategoriId,
        nama: { value: nama, at: new Date().toISOString() },
      });
    },

    async updateProduk(produkId, input) {
      const payload: Record<string, unknown> = { produkId };
      const at = new Date().toISOString();
      if (input.nama !== undefined) {
        const nama = input.nama.trim();
        if (!nama) throw new CatalogError('Nama produk wajib diisi.');
        payload.nama = { value: nama, at };
      }
      if (input.kategoriId !== undefined) {
        payload.kategoriId = { value: input.kategoriId, at };
      }
      if (Object.keys(payload).length === 1) throw new CatalogError('Tidak ada perubahan.');
      return append('produk.updated', payload);
    },

    async archiveKategori(kategoriId) {
      return append('kategori.archived', { kategoriId, archived: true });
    },

    async archiveProduk(produkId) {
      return append('produk.archived', { produkId, archived: true });
    },

    async archiveVarian(varianId) {
      return append('varian.archived', { varianId, archived: true });
    },

    async restoreKategori(kategoriId) {
      return append('kategori.archived', { kategoriId, archived: false });
    },

    async restoreProduk(produkId) {
      return append('produk.archived', { produkId, archived: false });
    },

    async restoreVarian(varianId) {
      return append('varian.archived', { varianId, archived: false });
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
