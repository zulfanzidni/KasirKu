/**
 * The shape of the record. Every other module reads these definitions, so a
 * change here is a change to the whole app.
 *
 * Read docs/adr/0001-event-log-as-source-of-truth.md and spec §8 before editing.
 * Nothing in this file performs I/O: the history folds below are pure, which is
 * what lets the same fold run on two phones and agree.
 */

import type { Discount, PaymentMethod, SalePayment } from '../design/money';
import type { ReceiptData, ReceiptShop } from './receipt';

export type { PaymentMethod, SalePayment };

/**
 * What the payment step hands the ledger. The discount is passed as it was
 * typed (rupiah or percent) and settled against the lines' gross inside the
 * draft, so the saved figure is the one the receipt prints.
 */
export interface PaymentInput {
  discount: Discount;
  /** Cash the customer put down. */
  tendered: number;
  /** Pembulatan step; omitted means the shop's default of Rp 500. */
  cashStep?: number;
}

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
  { varianId: string } & Partial<Record<'nama' | 'kode' | 'jualBy' | 'harga' | 'minimum', Stamped<unknown>>>
>;

export type VarianArchived = Event<'varian.archived', { varianId: string; archived: boolean }>;

/** The shop's own words on a nota. `at` comes from the envelope's `created_at`,
 * so it resolves per field against edits from the other phone exactly like the
 * master data above: last write wins, not last arrival. */
export type SettingsUpdated = Event<'settings.updated', { receipt: ReceiptShop }>;

export type MasterEvent =
  | KategoriCreated
  | ProdukCreated
  | ProdukUpdated
  | VarianCreated
  | VarianUpdated
  | VarianArchived
  | SettingsUpdated;

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

export type SaleCompleted = Event<'sale.completed', SalePayload>;

/**
 * Everything a sale records besides its lines.
 *
 * `total` is the gross — the sum of the rounded line totals, rounded once at
 * the line — and is what the shop sold, before any discount. What the customer
 * actually handed over lives in `payment`, whose `net` is the printed receipt
 * total (gross − discount + pembulatan). `number` is the human-facing sale
 * number; the event `id` remains the only key.
 */
export interface SalePayload {
  /** Human-facing `YYYYMMDD-<device>-<seq>`. Never a key. */
  number?: string;
  lines: SaleLine[];
  total: number;
  payment?: SalePayment;
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/**
 * A correction to a varian's count, recorded as the **delta** from what the
 * app believed, never as the absolute number the owner typed (ADR 0001). Two
 * phones correcting the same shelf then add instead of overwriting, and the
 * owner's own words for why are kept beside it.
 */
export type StockAdjusted = Event<'stock.adjusted', { varianId: string; delta: number; reason: string }>;

/**
 * A varian's stock as the log answers it. A discriminated result rather than a
 * number or null, so "nobody has counted this yet" cannot be read as "zero":
 *  - `unknown` — nothing has ever moved the count; not out of stock.
 *  - `counted` — a number, possibly 0 or negative (the shelf disagrees).
 */
export type StockState = { kind: 'unknown' } | { kind: 'counted'; qty: number };

export type LedgerEvent = MasterEvent | SaleCompleted | StockAdjusted;

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
  /**
   * The owner's own rule: "tell me when this drops below N" (user story 41).
   * Absent or null until they set one; ticket 05 falls back to selling speed.
   */
  minimum?: number | null;
  archived: boolean;
}

export interface Sale {
  id: string;
  createdAt: string;
  lines: SaleLine[];
  total: number;
  /** `YYYYMMDD-<device>-<seq>`, derived from the log for sales written before numbering existed. */
  number: string;
  /** Absent only on a sale written before payment was recorded. */
  payment: SalePayment | null;
}

/** The shop as the events say it is. */
export interface Shop {
  kategori: Kategori[];
  produk: Produk[];
  varian: Varian[];
  sales: Sale[];
  /** The nota's header and footer (settings.updated). */
  receipt: ReceiptShop;
  /** When `receipt` was last written; null while it is still the default. */
  receiptAt: string | null;
}

// ---------------------------------------------------------------------------
// Receipt printing
// ---------------------------------------------------------------------------

/**
 * What the app can do with the phone that renders and shares paper. Both
 * methods are set by the app entry, which is the one place that imports
 * expo-print and expo-sharing; tests replace them to see what was printed.
 */
export interface Printer {
  /**
   * Renders the nota and returns a path to the file it wrote. It takes the
   * `ReceiptData`, not markup: a thermal slip later is another `print`, not a
   * change to the sale flow.
   */
  print(nota: ReceiptData): Promise<{ uri: string }>;
  /** Hands the file to Android's own share sheet, so the owner can pick WhatsApp or a files app. */
  share(uri: string, mimeType: string): Promise<void>;
  /** Whether this phone can share at all; a phone that cannot still prints. */
  canShare(): Promise<boolean>;
}
