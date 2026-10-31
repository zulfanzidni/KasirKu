/**
 * The shape of the record. Every other module reads these definitions, so a
 * change here is a change to the whole app.
 *
 * Read docs/adr/0001-event-log-as-source-of-truth.md and spec §8 before editing.
 * Nothing in this file performs I/O: the history folds below are pure, which is
 * what lets the same fold run on two phones and agree.
 */

/** A unit a varian is counted in. Fixed at creation (GLOSSARY: Satuan). */
export type Satuan = 'pcs' | 'bungkus' | 'kg' | 'liter' | 'sak';

/**
 * How a varian is tapped.
 *  - `unit`   — whole units only (Indomie, Telur pcs)
 *  - `weight` — fractional kilos, chosen in steps of 1/4 (Tepung, Gula)
 */
export type JualBy = 'unit' | 'weight';

// ---------------------------------------------------------------------------
// Event envelope (spec §8 "Event envelope")
// ---------------------------------------------------------------------------

export interface Event<TType extends string, TPayload> {
  /** UUID generated on the device. Makes re-sending idempotent. */
  id: string;
  deviceId: string;
  /** Monotonic per device. Detects gaps and resumes pulls. */
  seq: number;
  /** Device-local time the event happened, ISO 8601. Never overwritten by sync. */
  createdAt: string;
  type: TType;
  payload: TPayload;
}

// ---------------------------------------------------------------------------
// Master data payloads — per-field resolution, every field stamped
// ---------------------------------------------------------------------------

interface ProdukFields {
  kategoriId: string;
  nama: string;
}

interface VarianFields {
  produkId: string;
  nama: string;
  kode: string | null;
  satuan: Satuan;
  jualBy: JualBy;
  harga: number;
}

/** A field value with the device-local moment it changed. */
export interface Stamped<T> {
  value: T;
  /** Device-local time of this field's change, ISO 8601. */
  at: string;
}

/**
 * Master data carries three kinds of event:
 *  - `created` holds every field
 *  - `updated` holds only the fields that changed, each stamped separately,
 *    so two phones editing different fields of one record both survive
 *  - `archived` hides the record without erasing it
 */
export type KategoriCreated = Event<'kategori.created', { nama: string; parentId: string | null }>;

export type ProdukCreated = Event<'produk.created', ProdukFields>;
export type ProdukUpdated = Event<
  'produk.updated',
  { produkId: string } & Partial<Record<keyof ProdukFields, Stamped<unknown>>>
>;

export type VarianCreated = Event<'varian.created', VarianFields>;
/**
 * `satuan` is deliberately absent: GLOSSARY says the satuan is fixed at
 * creation, and a payload that cannot express the change is safer than a rule
 * that has to remember to enforce it.
 */
export type VarianUpdated = Event<
  'varian.updated',
  { varianId: string } & Partial<Record<'nama' | 'kode' | 'jualBy' | 'harga', Stamped<unknown>>>
>;

export type VarianArchived = Event<'varian.archived', { varianId: string; archived: boolean }>;

export type MasterEvent =
  | KategoriCreated
  | ProdukCreated
  | ProdukUpdated
  | VarianCreated
  | VarianUpdated
  | VarianArchived;

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

/**
 * One sold line. Name, satuan and price are snapshotted so a later rename or
 * price change cannot rewrite a sale already made (spec §8).
 */
export interface SaleLine {
  varianId: string;
  nama: string;
  satuan: Satuan;
  qty: number;
  harga: number;
  jumlah: number;
}

export type SaleCompleted = Event<'sale.completed', { lines: SaleLine[]; total: number }>;

export type LedgerEvent = MasterEvent | SaleCompleted;

// ---------------------------------------------------------------------------
// Derived state — never stored, always folded
// ---------------------------------------------------------------------------

export interface Kategori {
  id: string;
  nama: string;
  parentId: string | null;
  archived: boolean;
}

export interface Produk {
  id: string;
  kategoriId: string;
  nama: string;
  archived: boolean;
}

export interface Varian {
  id: string;
  produkId: string;
  nama: string;
  kode: string | null;
  satuan: Satuan;
  jualBy: JualBy;
  harga: number;
  archived: boolean;
}

export interface Sale {
  id: string;
  createdAt: string;
  lines: SaleLine[];
  total: number;
}

/** The shop as the events say it is. */
export interface Shop {
  kategori: Kategori[];
  produk: Produk[];
  varian: Varian[];
  sales: Sale[];
}
