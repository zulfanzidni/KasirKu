import { normaliseQty, stockOf, type StockRow } from './stock';
import type { LedgerEvent, Shop, StockState, Varian } from './types';

/**
 * Judging a varian low (GLOSSARY: Rendah, spec §Low stock).
 *
 * The owner's minimum decides when they set one. Without a minimum, the app
 * looks at how fast the varian sold over a short window — but only once the
 * shop has sold it for long enough to say anything. Too little history is its
 * own answer, never a confident zero.
 *
 * Only **dimiliki** (owned) stock is judged. Titip stock belongs to the
 * supplier, so it cannot be what tells the owner not to order.
 */

/** The short window selling speed is read over. */
export const LOW_WINDOW_DAYS = 7;

/** A varian must have been selling at least this long before speed is trusted. */
export const MIN_HISTORY_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which rule flagged a varian. A warning always carries this, so the owner can
 * trust why it appeared instead of learning to ignore warnings.
 */
export type LowRule =
  | { kind: 'minimum'; minimum: number }
  | { kind: 'kecepatan'; sold: number; hari: number }
  | { kind: 'habis' }
  | { kind: 'selisih' };

/**
 * The three answers the check can give. `tidakTahu` is first-class: it is
 * neither "low" nor "fine", and a screen must say so rather than guess.
 */
export type LowCheck =
  | { kind: 'rendah'; rule: LowRule }
  | { kind: 'aman'; rule: LowRule }
  | { kind: 'tidakTahu'; sebab: 'belum-dihitung' | 'riwayat-terlalu-sedikit' };

/** A varian with its count and the check that judged it. */
export interface LowRow extends StockRow {
  check: LowCheck;
}

/** How many of this varian sold inside the window, and whether there is enough history to trust it. */
interface SalesHistory {
  sold: number;
  enough: boolean;
}

function salesHistory(events: readonly LedgerEvent[], varianId: string, now: Date): SalesHistory {
  const since = now.getTime() - LOW_WINDOW_DAYS * DAY_MS;
  let firstSaleAt: number | null = null;
  let sold = 0;

  for (const event of events) {
    if (event.type !== 'sale.completed') continue;
    const at = Date.parse(event.createdAt);
    for (const line of event.payload.lines) {
      if (line.varianId !== varianId) continue;
      if (firstSaleAt === null || at < firstSaleAt) firstSaleAt = at;
      if (at >= since) sold += line.qty;
    }
  }

  return {
    sold: normaliseQty(sold),
    // One sale yesterday says what sold yesterday, not what the shop needs on
    // the shelf. The first sale must be old enough for a window to mean anything.
    enough: firstSaleAt !== null && now.getTime() - firstSaleAt >= MIN_HISTORY_DAYS * DAY_MS,
  };
}

/**
 * Judge one varian, naming the rule that decided it.
 *
 * Order matters: the owner's minimum always wins; an out-of-stock shelf is low
 * whatever the history; then selling speed applies, or admits it cannot.
 */
export function checkLow(
  varian: Varian,
  stock: StockState,
  events: readonly LedgerEvent[],
  now: Date = new Date(),
): LowCheck {
  if (stock.kind !== 'counted') return { kind: 'tidakTahu', sebab: 'belum-dihitung' };

  const qty = stock.qty;

  if (varian.minimum != null) {
    const rule: LowRule = { kind: 'minimum', minimum: varian.minimum };
    return qty < varian.minimum ? { kind: 'rendah', rule } : { kind: 'aman', rule };
  }

  if (qty < 0) return { kind: 'rendah', rule: { kind: 'selisih' } };
  // An empty shelf needs action even on a varian too new to have a speed.
  if (qty === 0) return { kind: 'rendah', rule: { kind: 'habis' } };

  const history = salesHistory(events, varian.id, now);
  if (!history.enough) return { kind: 'tidakTahu', sebab: 'riwayat-terlalu-sedikit' };

  const rule: LowRule = { kind: 'kecepatan', sold: history.sold, hari: LOW_WINDOW_DAYS };
  // Stock covers less than one window of sales: it will run out before the
  // owner next looks. No quantity is suggested — the fact is shown, not a guess.
  return qty < history.sold ? { kind: 'rendah', rule } : { kind: 'aman', rule };
}

/** Every live varian, with its count and the check beside it. */
export function lowRows(
  events: readonly LedgerEvent[],
  varian: readonly Varian[],
  now: Date = new Date(),
): LowRow[] {
  return varian
    .filter((entry) => !entry.archived)
    .map((entry) => {
      const stock = stockOf(events, entry.id).stock;
      return { varian: entry, stock, check: checkLow(entry, stock, events, now) };
    });
}

/**
 * The bulk varian a packet is repacked from, with its stock and what that
 * stock implies: sacks on the shelf mean repack, no sacks mean reorder. The
 * app shows the fact and the word; it never suggests a quantity.
 */
export interface BulkContext {
  varian: Varian;
  stock: StockState;
  choice: 'repack' | 'reorder' | 'tidakTahu';
}

/**
 * The sack sibling of a packet, if the product has one. A bulk varian has no
 * bulk context of its own — it is judged on its own count, separately from its
 * packets.
 */
export function bulkOf(
  shop: Shop,
  varian: Varian,
  stockOfVarian: (varianId: string) => StockState,
): BulkContext | null {
  if (varian.satuan === 'sak') return null;
  const bulk = shop.varian.find(
    (entry) => entry.produkId === varian.produkId && !entry.archived && entry.satuan === 'sak',
  );
  if (!bulk) return null;

  const stock = stockOfVarian(bulk.id);
  const choice =
    stock.kind !== 'counted' ? 'tidakTahu' : stock.qty > 0 ? 'repack' : 'reorder';
  return { varian: bulk, stock, choice };
}
