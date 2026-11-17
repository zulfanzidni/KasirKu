import { stockOf, stockRows as rowsOf, type StockMovement, type StockRow } from './stock';
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

/** Every live varian with its own count, sorted the way the Stok screen lists them. */
export async function stockByVariant(source: StockSource): Promise<StockRow[]> {
  const [shop, events] = await Promise.all([source.shop(), source.events()]);
  return sortStock(rowsOf(events, shop.varian));
}

/**
 * The variants the log says are low: counted, and either out (0) or below the
 * owner's own minimum for that varian.
 *
 * Only `counted` rows are judged. An unknown count is neither low nor fine —
 * it is a question, and firing a warning at every item of a new shop would
 * teach the owner to ignore warnings (spec §Low stock, user story 30). Ticket
 * 05 adds the selling-speed rule here for variants with no minimum.
 */
export async function lowStock(source: StockSource): Promise<StockRow[]> {
  return (await stockByVariant(source)).filter((row) => isLow(row));
}

/**
 * One row judged by the low rule. Never counted is never low (a question, not
 * a warning). Out of stock is low whatever the minimum — a zero shelf needs
 * action. Above zero, only the owner's own rule decides: the app does not
 * invent one.
 */
export function isLow(row: StockRow): boolean {
  if (row.stock.kind !== 'counted') return false;
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
    after += movement.delta;
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
export function sortStock(rows: StockRow[]): StockRow[] {
  return [...rows].sort((a, b) => {
    const rank = rankOf(a) - rankOf(b);
    if (rank !== 0) return rank;
    return a.varian.nama.localeCompare(b.varian.nama, 'id');
  });
}

function rankOf(row: StockRow): number {
  if (row.stock.kind === 'unknown') return 2;
  if (row.stock.qty < 0) return 0;
  if (isLow(row)) return 1;
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

export type { LedgerEvent, Shop, Varian };
