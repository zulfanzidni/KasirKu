import { checkLow, lowRows, type LowCheck, type LowRow } from './lowStock';
import { dayStamp } from './saleNumber';
import { ownedDelta, stockOf, stockRows as rowsOf, titipStockOf, type StockMovement, type StockRow } from './stock';
import {
  supplierPayable as payableOf,
  supplierPayables as payablesOf,
  titipStock as titipOf,
  type SupplierPayable,
  type TitipStock,
} from './suppliers';
import type { LedgerEvent, Shop, StockState, Varian } from './types';

/**
 * What the cashier can see and tap. Everything here is an answer read off the
 * event log; nothing is a second place to write state.
 */

// ---------------------------------------------------------------------------
// Stock — the queries side of the seam (spec §Testing Decisions)
// ---------------------------------------------------------------------------

/**
 * The source the stock questions read. Every ledger answers it, so a screen
 * can be tested against the real log without inventing a second store.
 */
export interface StockSource {
  shop(): Promise<Shop>;
  events(): Promise<LedgerEvent[]>;
}

/** One varian's count. `unknown` when nobody has ever counted it. */
export async function stockOnHand(source: StockSource, varianId: string): Promise<StockState> {
  return stockOf(await source.events(), varianId).stock;
}

/** Titip units on the shelf for one varian. Never added to owned stock. */
export async function titipOnHand(source: StockSource, varianId: string): Promise<number> {
  return titipStockOf(await source.events(), varianId);
}

/** What one supplier is owed, and the composition of that total. */
export async function supplierPayable(source: StockSource, supplierId: string): Promise<Omit<SupplierPayable, 'supplier'>> {
  return payableOf(await source.events(), supplierId);
}

/** Every live supplier with the running total owed and what it is made of. */
export async function supplierPayables(source: StockSource): Promise<SupplierPayable[]> {
  const [shop, events] = await Promise.all([source.shop(), source.events()]);
  return payablesOf(events, shop.supplier);
}

/** Titip stock still on the shelf, per supplier and varian. */
export async function titipStock(source: StockSource, supplierId?: string): Promise<TitipStock[]> {
  return titipOf(await source.events(), supplierId);
}

/** Every live varian with its own count, sorted the way the Stok screen lists them. */
export async function stockByVariant(source: StockSource): Promise<StockRow[]> {
  const [shop, events] = await Promise.all([source.shop(), source.events()]);
  return sortStock(rowsOf(events, shop.varian));
}

/**
 * The variants the log says are low, each with the rule that flagged it.
 *
 * Only `counted` rows are judged. An unknown count is neither low nor fine —
 * it is a question, and firing a warning at every item of a new shop would
 * teach the owner to ignore warnings (spec §Low stock, user story 30).
 * The minimum decides when set; otherwise selling speed does, or the rule
 * admits the history is too thin to say.
 */
export async function lowStock(source: StockSource, now: Date = new Date()): Promise<LowRow[]> {
  const [shop, events] = await Promise.all([source.shop(), source.events()]);
  return lowRows(events, shop.varian, now).filter((row) => row.check.kind === 'rendah');
}

/**
 * One row judged by the minimum/out rule alone. Kept for callers that have no
 * log in hand; a screen with the events should use `checkLow`, which also
 * knows selling speed and its own "too little history" answer.
 */
export function isLow(row: StockRow): boolean {
  if (row.stock.kind !== 'counted') return false;
  if (row.stock.qty < 0) return true;
  if (row.stock.qty === 0) return true;
  const { minimum } = row.varian;
  return minimum != null && row.stock.qty < minimum;
}

/** Everything that moved one varian's count, oldest first, with a running total. */
export async function stockHistory(
  source: StockSource,
  varianId: string,
): Promise<(StockMovement & { after: number })[]> {
  const { movements } = stockOf(await source.events(), varianId);
  let after = 0;
  return movements.map((movement) => {
    // Titip goods are not the shop's, so they never enter the owned running total.
    after += ownedDelta(movement);
    return { ...movement, after };
  });
}

/**
 * The order the Stok list reads in, chosen so the thing that needs action is
 * never below the fold:
 *  1. negative — the app and the shelf disagree; red, first (user story 32)
 *  2. low      — out (0) or below its minimum
 *  3. unknown  — never counted; a question, not a warning
 *  4. the rest — counted and fine
 * Ties read by name, in Indonesian collation, as `gridVarian` does.
 */
export function sortStock(rows: StockRow[], checks?: ReadonlyMap<string, LowCheck>): StockRow[] {
  return [...rows].sort((a, b) => {
    const rank = rankOf(a, checks) - rankOf(b, checks);
    if (rank !== 0) return rank;
    return a.varian.nama.localeCompare(b.varian.nama, 'id');
  });
}

function rankOf(row: StockRow, checks?: ReadonlyMap<string, LowCheck>): number {
  if (row.stock.kind === 'unknown') return 2;
  if (row.stock.qty < 0) return 0;
  const judged = checks?.get(row.varian.id);
  if (judged ? judged.kind === 'rendah' : isLow(row)) return 1;
  return 3;
}

export function gridVarian(shop: Shop): Varian[] {
  return shop.varian
    .filter((varian) => !varian.archived)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

/**
 * The variants the till may sell: not archived themselves, and not under an
 * archived produk. Archiving a produk hides its sizes from the grid while the
 * log keeps them, so old receipts and old stock figures still resolve.
 */
export function sellableVarian(shop: Shop): Varian[] {
  const archivedProduk = new Set(shop.produk.filter((entry) => entry.archived).map((entry) => entry.id));
  return shop.varian.filter((entry) => !entry.archived && !archivedProduk.has(entry.produkId));
}

/**
 * Search by name, ignoring case and accents the way a person types. An empty
 * query is not a filter: the whole grid stays.
 */
export function searchVarian(varian: readonly Varian[], query: string): Varian[] {
  const needle = query.trim().toLowerCase().replace(/,/g, '.');
  if (!needle) return [...varian];
  return varian.filter((entry) => entry.nama.toLowerCase().includes(needle));
}

/** Every product that has at least one live variant, for creation forms. */
export function produkWithVarian(shop: Shop) {
  return shop.produk.filter(
    (produk) =>
      !produk.archived &&
      shop.varian.some((varian) => varian.produkId === produk.id && !varian.archived),
  );
}

/** Every event as stored, oldest first: the history the owner can look back on. */
export function saleHistory(shop: Shop) {
  return [...shop.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// Today — what was sold, what cash came in, and what was given away
// ---------------------------------------------------------------------------

/**
 * What today did, in the two figures the owner must never conflate:
 *  - `penjualan` — the full value sold, hutang included. A sale is a sale
 *    whether or not the money has arrived.
 *  - `tunai` — cash that actually came in: what was handed over at the till
 *    plus hutang payments. A write-off adds nothing, because no money moved.
 *  - `hutang` — the part of today's sales that became debt.
 *  - `diskon` — what the owner gave away today, as its own figure. It is
 *    already absent from `penjualan` (the receipt total is after discount), so
 *    the two are shown side by side rather than added.
 *
 * `penjualan` is the receipt total (after discount and pembulatan), not the
 * gross: it is what the customer was charged. The two figures are not meant to
 * reconcile, and no screen may imply they should.
 */
export interface TodayTotals {
  penjualan: number;
  tunai: number;
  hutang: number;
  diskon: number;
}

export function todayTotals(events: readonly LedgerEvent[], now: Date = new Date()): TodayTotals {
  const today = dayStamp(now.toISOString());
  const totals: TodayTotals = { penjualan: 0, tunai: 0, hutang: 0, diskon: 0 };

  for (const event of events) {
    if (dayStamp(event.createdAt) !== today) continue;
    switch (event.type) {
      case 'sale.completed': {
        const payment = event.payload.payment;
        const net = payment?.net ?? event.payload.total;
        const unpaid = payment?.unpaid ?? 0;
        totals.penjualan += net;
        totals.tunai += net - unpaid;
        totals.hutang += unpaid;
        totals.diskon += payment?.discount ?? 0;
        break;
      }
      case 'receivable.paid':
        totals.tunai += event.payload.jumlah;
        break;
      case 'receivable.written_off':
        // No cash moved, so nothing is added to `tunai`.
        break;
    }
  }

  return totals;
}

export type { LedgerEvent, Shop, Varian };
