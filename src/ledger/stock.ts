import type { LedgerEvent, SaleLine, StockState, Varian } from './types';

/**
 * Stock, derived from the log (ADR 0001). Nothing stores a stock number: a
 * sale takes away what it sold, a correction adds a delta, and the sum is the
 * answer.
 *
 * The answer is a discriminated result, never a bare number, because
 * "nobody has counted this" and "this is zero" are different facts and must
 * never be confused by a screen, a warning or a future sync.
 *
 * Earlier tickets could only sell and count, so only two events move stock
 * here. Receiving, repacking and consignment return arrive in later tickets
 * (05, 06, 08) and add their own cases to `movementsOf`.
 */

/**
 * Quantity in steps of 1/4. Sums of such steps are exact in binary, but a log
 * that has crossed two phones can still pick up a floating tail; normalise so
 * 12.25 never reads as 12.250000000000002 on the screen.
 */
export function normaliseQty(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}

/** One thing that moved a varian's count, in the order it happened. */
export type StockMovement =
  | { kind: 'sale'; at: string; delta: number; saleId: string }
  | { kind: 'adjusted'; at: string; delta: number; reason: string; eventId: string };

/** Everything the log says about one varian's count. */
export interface StockLedgerEntry {
  /** `unknown` while nothing has ever moved the count. */
  stock: StockState;
  movements: StockMovement[];
}

/** Every movement of one varian, oldest first: the history the owner can read back. */
export function movementsOf(events: readonly LedgerEvent[], varianId: string): StockMovement[] {
  const movements: StockMovement[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'sale.completed':
        for (const line of event.payload.lines as readonly SaleLine[]) {
          if (line.varianId !== varianId) continue;
          movements.push({ kind: 'sale', at: event.createdAt, delta: -line.qty, saleId: event.id });
        }
        break;

      case 'stock.adjusted':
        if (event.payload.varianId !== varianId) break;
        movements.push({
          kind: 'adjusted',
          at: event.createdAt,
          delta: normaliseQty(event.payload.delta),
          reason: event.payload.reason,
          eventId: event.id,
        });
        break;
    }
  }
  return movements;
}

/**
 * The count for one varian, folded from the whole log. `unknown` is returned
 * only when nothing has ever moved it — a varian counted at 0 and then sold
 * one reads −1, not unknown.
 */
export function stockOf(events: readonly LedgerEvent[], varianId: string): StockLedgerEntry {
  const movements = movementsOf(events, varianId);
  if (movements.length === 0) return { stock: { kind: 'unknown' }, movements };
  const qty = normaliseQty(movements.reduce((sum, movement) => sum + movement.delta, 0));
  return { stock: { kind: 'counted', qty }, movements };
}

/** A varian with its derived count, as a list reads it. */
export interface StockRow {
  varian: Varian;
  stock: StockState;
}

/** Every live varian with its own count. Never pooled by produk or kategori. */
export function stockRows(events: readonly LedgerEvent[], varian: readonly Varian[]): StockRow[] {
  return varian
    .filter((entry) => !entry.archived)
    .map((entry) => ({ varian: entry, stock: stockOf(events, entry.id).stock }));
}

/**
 * The delta a correction writes, given what the app currently believes. The
 * correction is what the owner counted; the log only ever hears the
 * difference, so two corrections add up instead of overwriting each other.
 */
export function correctionDelta(believed: StockState, counted: number): number {
  const from = believed.kind === 'counted' ? believed.qty : 0;
  return normaliseQty(counted - from);
}
