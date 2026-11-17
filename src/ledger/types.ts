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
  /**
   * Who owes the rest when the cash falls short. Required for any sale with
   * an unpaid remainder: money owed must have an owner (user story 20).
   */
  pelangganId?: string;
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
export type KategoriUpdated = Event<
  'kategori.updated',
  { kategoriId: string } & Partial<Record<'nama' | 'parentId', Stamped<unknown>>>
>;
export type KategoriArchived = Event<'kategori.archived', { kategoriId: string; archived: boolean }>;

export type ProdukCreated = Event<'produk.created', ProdukFields>;
export type ProdukUpdated = Event<
  'produk.updated',
  { produkId: string } & Partial<Record<keyof ProdukFields, Stamped<unknown>>>
>;
export type ProdukArchived = Event<'produk.archived', { produkId: string; archived: boolean }>;

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

/**
 * A supplier the shop buys from. Master data like the three levels above:
 * created, edited per field, archived rather than deleted, because old
 * delivery notes and old payables must still resolve the name.
 */
export type SupplierCreated = Event<'supplier.created', { nama: string; telepon: string | null }>;
export type SupplierUpdated = Event<
  'supplier.updated',
  { supplierId: string } & Partial<Record<'nama' | 'telepon', Stamped<unknown>>>
>;
export type SupplierArchived = Event<'supplier.archived', { supplierId: string; archived: boolean }>;

/** The shop's own words on a nota. `at` comes from the envelope's `created_at`,
 * so it resolves per field against edits from the other phone exactly like the
 * master data above: last write wins, not last arrival. */
export type SettingsUpdated = Event<'settings.updated', { receipt: ReceiptShop }>;

// ---------------------------------------------------------------------------
// Pelanggan and hutang
// ---------------------------------------------------------------------------

/**
 * A customer is master data with one job: giving hutang an owner (GLOSSARY).
 * Archiving hides them; the ledger refuses it while they still owe.
 */
export type PelangganCreated = Event<'pelanggan.created', { nama: string; telepon: string | null }>;
export type PelangganArchived = Event<'pelanggan.archived', { pelangganId: string; archived: boolean }>;

/**
 * Money handed over against hutang. A payment is its own event, never a
 * write-off: it moves cash, and the collections total must see it.
 */
export type ReceivablePaid = Event<'receivable.paid', { pelangganId: string; jumlah: number }>;

/**
 * A debt forgiven. It clears the balance and collects no cash, so it is a
 * different event from a payment — the two can never be added together by a
 * reader who was not told which is which.
 */
export type ReceivableWrittenOff = Event<
  'receivable.written_off',
  { pelangganId: string; jumlah: number; alasan: string }
>;

export type MasterEvent =
  | KategoriCreated
  | KategoriUpdated
  | KategoriArchived
  | ProdukCreated
  | ProdukUpdated
  | ProdukArchived
  | VarianCreated
  | VarianUpdated
  | VarianArchived
  | SupplierCreated
  | SupplierUpdated
  | SupplierArchived
  | PelangganCreated
  | PelangganArchived
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
  /**
   * The customer who owns any unpaid remainder. The name is snapshotted here
   * so the nota and the hutang history read the same even after a rename.
   */
  pelangganId?: string;
  pelangganNama?: string;
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
 * The count the owner entered when the shop was set up. It is an event like
 * any other movement — auditable, and folded with the rest — never a silent
 * initial value and never a stored column (ADR 0001). A varian with no opening
 * event and no other movement stays `unknown`, which is not zero.
 */
export type StockOpening = Event<'stock.opening', { varianId: string; qty: number }>;

/**
 * How a delivery line is settled (GLOSSARY: Titip, Tempo, and cash).
 *  - `tunai` — paid on the spot; the goods are the shop's and no debt exists.
 *  - `tempo` — the goods are the shop's immediately and the shop owes them.
 *  - `titip` — the supplier's goods on the shop's shelf; the shop owes only
 *    for the units that actually sell.
 */
export type Settlement = 'tunai' | 'tempo' | 'titip';

/**
 * Goods arriving from a supplier. `settlement` says whose goods they are:
 * tunai and tempo are the shop's own the moment they arrive; titip is the
 * supplier's until it sells (GLOSSARY: Titip), so it never counts as owned.
 *
 * Ticket 08 records a delivery note as one event per line, all sharing
 * `notaId`, so a visit that mixes settlement models is still one record.
 * `hargaBeli` is the supplier's price per satuan: tempo uses it to create the
 * debt on arrival, and titip uses it to create the debt when a unit sells.
 * Older events (ticket 05) carry neither field; they move stock and create no
 * payable.
 */
export type StockReceived = Event<
  'stock.received',
  {
    varianId: string;
    qty: number;
    settlement: Settlement;
    supplierId?: string;
    notaId?: string;
    hargaBeli?: number;
  }
>;

/**
 * Unsold titip goods going back to the supplier. The goods leave consignment
 * stock and no money moves: there was never a payable until a unit sold.
 */
export type StockConsignmentReturned = Event<
  'stock.consignment_returned',
  { supplierId: string; varianId: string; qty: number; notaId?: string }
>;

/** Money paid to a supplier, reducing what the shop owes. It carries no
 * allocation: a payment settles the running total, and the remainder carries. */
export type PayablePaid = Event<'payable.paid', { supplierId: string; amount: number }>;

// ---------------------------------------------------------------------------
// Cash drawer (spec §Cash)
// ---------------------------------------------------------------------------

/**
 * What a count compared against (spec §Cash, "Baseline when no float is
 * declared"):
 *  - `float` — an explicitly declared opening amount
 *  - `count` — the previous physical count, when no float has been declared
 *    since it
 *  - `nol`   — neither exists; the drawer is followed from zero
 *
 * It is stored on the count so the owner can read, months later, which number a
 * difference was measured from.
 */
export type CashBaselineKind = 'float' | 'count' | 'nol';

/** The amount declared to be in the drawer at the start of a period. */
export type CashOpeningFloat = Event<'cash.opening_float', { jumlah: number }>;

/**
 * Money paid out of the drawer that is not a supplier payment: listrik,
 * transport, a personal purchase. The reason is required — an unexplained
 * outflow is what makes an owner stop trusting the count.
 */
export type CashExpense = Event<'cash.expense', { jumlah: number; keterangan: string }>;

/** Money taken out, including banking the takings. */
export type CashWithdrawn = Event<'cash.withdrawn', { jumlah: number; keterangan: string | null }>;

/** Money put into the drawer from outside. */
export type CashDeposited = Event<'cash.deposited', { jumlah: number; keterangan: string | null }>;

/**
 * A physical count: what the owner saw, what the log expected at that moment,
 * and the difference. The baseline is recorded with the count so the figure is
 * never an orphan. A count is a measurement, not a movement: it changes no
 * money, it only says what the drawer held.
 */
export type CashCounted = Event<
  'cash.counted',
  {
    counted: number;
    expected: number;
    /** `counted − expected`: positive means the drawer held more than expected. */
    difference: number;
    baseline: CashBaselineKind;
    /** What the drawer held at the baseline; 0 for `nol`. */
    baselineJumlah: number;
    /** When the baseline event happened; null for `nol`. */
    baselineAt: string | null;
    catatan: string | null;
  }
>;

/**
 * A varian's stock as the log answers it. A discriminated result rather than a
 * number or null, so "nobody has counted this yet" cannot be read as "zero":
 *  - `unknown` — nothing has ever moved the count; not out of stock.
 *  - `counted` — a number, possibly 0 or negative (the shelf disagrees).
 */
export type StockState = { kind: 'unknown' } | { kind: 'counted'; qty: number };

export type LedgerEvent =
  | MasterEvent
  | SaleCompleted
  | StockAdjusted
  | StockReceived
  | StockOpening
  | StockConsignmentReturned
  | PayablePaid
  | ReceivablePaid
  | ReceivableWrittenOff
  | CashOpeningFloat
  | CashExpense
  | CashWithdrawn
  | CashDeposited
  | CashCounted;

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
  /** Null once its kategori is archived: the produk stays, uncategorised. */
  kategoriId: string | null;
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

/** A supplier the shop buys from. Archived, never deleted, so old notes read. */
export interface Supplier {
  id: string;
  nama: string;
  telepon: string | null;
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
  /** The customer who owns the unpaid remainder, if one was chosen. */
  pelangganId: string | null;
  /** The customer's name as it read when the sale was written. */
  pelangganNama: string | null;
}

/** A customer, as the log resolves them. */
export interface Pelanggan {
  id: string;
  nama: string;
  telepon: string | null;
  archived: boolean;
}

/** The shop as the events say it is. */
export interface Shop {
  kategori: Kategori[];
  produk: Produk[];
  varian: Varian[];
  supplier: Supplier[];
  pelanggan: Pelanggan[];
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
