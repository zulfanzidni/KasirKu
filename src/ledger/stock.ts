import type { LedgerEvent, SaleLine, Settlement, StockState, Varian } from './types';

/**
 * Stock, derived from the log (ADR 0001). Nothing stores a stock number: a
 * sale takes away what it sold, a correction adds a delta, and the sum is the
 * answer.
 *
 * There are two buckets and they are never added together (GLOSSARY: Stok):
 *  - **dimiliki** (owned) — what the shop's own money bought, or what it owes
 *    for (tempo).
 *  - **titip** (consignment) — the supplier's goods on the shop's shelf. They
 *    are not the shop's until a unit sells.
 *
 * A sale draws owned stock first, then titip. That is why one fold has to
 * read the whole log in order: whether a sold unit was the shop's or the
 * supplier's depends on what was on the shelf at that moment.
 *
 * The owned answer is a discriminated result, never a bare number, because
 * "nobody has counted this" and "this is zero" are different facts and must
 * never be confused by a screen, a warning or a future sync.
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
  | {
      kind: 'sale';
      at: string;
      /** The physical count moved by this much: always −qty. */
      delta: number;
      /** The part of the sale that came out of the shop's own stock. */
      ownedDelta: number;
      /** The part of the sale that came out of consignment stock. */
      titip: number;
      saleId: string;
    }
  | { kind: 'adjusted'; at: string; delta: number; reason: string; eventId: string }
  | {
      kind: 'opening';
      at: string;
      delta: number;
      eventId: string;
    }
  | {
      kind: 'received';
      at: string;
      delta: number;
      /** `titip` goods are the supplier's, so they never move the owned count. */
      settlement: Settlement;
      supplierId?: string;
      eventId: string;
    }
  | {
      kind: 'returned';
      at: string;
      /** Unsold titip units going back; never money. */
      delta: number;
      supplierId: string;
      eventId: string;
    };

/** The part of a movement that changes owned stock; titip contributes nothing. */
export function ownedDelta(movement: StockMovement): number {
  switch (movement.kind) {
    case 'sale':
      return movement.ownedDelta;
    case 'adjusted':
      return movement.delta;
    case 'opening':
      return movement.delta;
    case 'received':
      return movement.settlement === 'titip' ? 0 : movement.delta;
    case 'returned':
      return 0;
  }
}

/** Whether a movement belongs to the shop's own stock (GLOSSARY: dimiliki). */
export function isOwned(movement: StockMovement): boolean {
  return ownedDelta(movement) !== 0;
}

/** One delivery of titip goods, still partly on the shelf. */
export interface TitipLot {
  varianId: string;
  supplierId?: string;
  qty: number;
  /** The supplier's price per unit; absent on old ticket-05 events. */
  hargaBeli: number | null;
  at: string;
  eventId: string;
}

/** Everything the log says about one varian's two buckets. */
export interface VarianStock {
  /** Owned count; null until anything has moved the shop's own stock. */
  owned: number | null;
  /** Titip units still on the shelf. Never added to `owned`. */
  titip: number;
  movements: StockMovement[];
}

/**
 * The whole stock picture at one moment. `tempo` and `titipSale` are gross
 * debts created by deliveries and by sales of consignment units; `paid` is
 * what left the drawer. None of them is a stored balance.
 */
export interface StockFold {
  varian: Map<string, VarianStock>;
  /** Gross payable from tempo deliveries, per supplier. */
  tempo: Map<string, number>;
  /** Gross payable from titip units that sold, per supplier. */
  titipSale: Map<string, number>;
  /** Money paid to suppliers, per supplier. */
  paid: Map<string, number>;
  /** Titip lots still on the shelf, oldest first. */
  lots: TitipLot[];
}

function add(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function snapshotOf(fold: StockFold, varianId: string): VarianStock {
  let snapshot = fold.varian.get(varianId);
  if (!snapshot) {
    snapshot = { owned: null, titip: 0, movements: [] };
    fold.varian.set(varianId, snapshot);
  }
  return snapshot;
}

/**
 * The one allocation rule: a sale pays out of owned stock first, then out of
 * the titip lots oldest-first, and anything still uncovered pushes owned
 * negative — the app and the shelf disagree, and that must stay visible
 * (user story 32).
 */
function sell(fold: StockFold, lotsByVarian: Map<string, TitipLot[]>, line: SaleLine, at: string, saleId: string): void {
  const snapshot = snapshotOf(fold, line.varianId);
  const qty = normaliseQty(line.qty);

  // Selling is itself a count of sorts: from here the shop's own stock is a
  // known number, possibly negative, rather than "never counted".
  if (snapshot.owned === null) snapshot.owned = 0;

  const ownedBefore = snapshot.owned;
  const fromOwned = Math.min(qty, Math.max(0, ownedBefore));
  let remaining = normaliseQty(qty - fromOwned);
  let fromTitip = 0;

  const lots = lotsByVarian.get(line.varianId) ?? [];
  let consumed = false;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.qty);
    if (take <= 0) continue;
    lot.qty = normaliseQty(lot.qty - take);
    snapshot.titip = normaliseQty(snapshot.titip - take);
    fromTitip = normaliseQty(fromTitip + take);
    remaining = normaliseQty(remaining - take);
    consumed = true;
    // Selling a titip unit is what creates the debt (user story 50), at the
    // price the supplier and the shop agreed for that delivery.
    if (lot.supplierId && lot.hargaBeli !== null) {
      add(fold.titipSale, lot.supplierId, Math.round(take * lot.hargaBeli));
    }
  }
  if (consumed) lotsByVarian.set(line.varianId, lots.filter((lot) => lot.qty > 0));

  // What neither bucket covered is a shortage of the shop's own goods.
  snapshot.owned = normaliseQty(ownedBefore - fromOwned - remaining);
  snapshot.movements.push({
    kind: 'sale',
    at,
    delta: -qty,
    ownedDelta: normaliseQty(-(fromOwned + remaining)),
    titip: fromTitip,
    saleId,
  });
}

/** Fold the whole log into both stock buckets and the supplier debt it implies. */
export function foldStock(events: readonly LedgerEvent[]): StockFold {
  const fold: StockFold = {
    varian: new Map(),
    tempo: new Map(),
    titipSale: new Map(),
    paid: new Map(),
    lots: [],
  };
  const lotsByVarian = new Map<string, TitipLot[]>();

  for (const event of events) {
    switch (event.type) {
      case 'sale.completed':
        for (const line of event.payload.lines as readonly SaleLine[]) {
          sell(fold, lotsByVarian, line, event.createdAt, event.id);
        }
        break;

      case 'stock.adjusted': {
        const snapshot = snapshotOf(fold, event.payload.varianId);
        const delta = normaliseQty(event.payload.delta);
        snapshot.owned = normaliseQty((snapshot.owned ?? 0) + delta);
        snapshot.movements.push({
          kind: 'adjusted',
          at: event.createdAt,
          delta,
          reason: event.payload.reason,
          eventId: event.id,
        });
        break;
      }

      case 'stock.opening': {
        const snapshot = snapshotOf(fold, event.payload.varianId);
        const qty = normaliseQty(event.payload.qty);
        snapshot.owned = normaliseQty((snapshot.owned ?? 0) + qty);
        snapshot.movements.push({
          kind: 'opening',
          at: event.createdAt,
          delta: qty,
          eventId: event.id,
        });
        break;
      }

      case 'stock.received': {
        const { varianId, settlement, supplierId } = event.payload;
        const qty = normaliseQty(event.payload.qty);
        const snapshot = snapshotOf(fold, varianId);

        if (settlement === 'titip') {
          snapshot.titip = normaliseQty(snapshot.titip + qty);
          const lots = lotsByVarian.get(varianId) ?? [];
          lots.push({
            varianId,
            supplierId,
            qty,
            hargaBeli: event.payload.hargaBeli ?? null,
            at: event.createdAt,
            eventId: event.id,
          });
          lotsByVarian.set(varianId, lots);
        } else {
          snapshot.owned = normaliseQty((snapshot.owned ?? 0) + qty);
          // Tempo creates the debt when the goods arrive (GLOSSARY: Tempo).
          // Tunai creates none: it was paid at the door.
          if (settlement === 'tempo' && supplierId && event.payload.hargaBeli != null) {
            add(fold.tempo, supplierId, Math.round(qty * event.payload.hargaBeli));
          }
        }

        snapshot.movements.push({
          kind: 'received',
          at: event.createdAt,
          delta: qty,
          settlement,
          supplierId,
          eventId: event.id,
        });
        break;
      }

      case 'stock.consignment_returned': {
        const { supplierId, varianId } = event.payload;
        const snapshot = snapshotOf(fold, varianId);
        const lots = lotsByVarian.get(varianId) ?? [];
        let remaining = normaliseQty(event.payload.qty);
        let removed = 0;

        // The unsold units are the ones still in the lots; take them
        // oldest-first, the same order a sale would have taken them.
        for (const lot of lots) {
          if (remaining <= 0) break;
          if (lot.supplierId !== supplierId) continue;
          const take = Math.min(remaining, lot.qty);
          if (take <= 0) continue;
          lot.qty = normaliseQty(lot.qty - take);
          remaining = normaliseQty(remaining - take);
          removed = normaliseQty(removed + take);
        }
        snapshot.titip = normaliseQty(snapshot.titip - removed);
        lotsByVarian.set(varianId, lots.filter((lot) => lot.qty > 0));
        snapshot.movements.push({
          kind: 'returned',
          at: event.createdAt,
          delta: -removed,
          supplierId,
          eventId: event.id,
        });
        break;
      }

      case 'payable.paid':
        add(fold.paid, event.payload.supplierId, Math.round(event.payload.amount));
        break;
    }
  }

  for (const lots of lotsByVarian.values()) {
    for (const lot of lots) if (lot.qty > 0) fold.lots.push(lot);
  }

  return fold;
}

/** Everything the log says about one varian's count. */
export interface StockLedgerEntry {
  /** `unknown` while nothing has ever moved the owned count. */
  stock: StockState;
  movements: StockMovement[];
}

/** Every movement of one varian, oldest first: the history the owner can read back. */
export function movementsOf(events: readonly LedgerEvent[], varianId: string): StockMovement[] {
  return foldStock(events).varian.get(varianId)?.movements ?? [];
}

/**
 * The owned count for one varian, folded from the whole log. `unknown` is
 * returned only when nothing has ever moved owned stock — a varian counted at
 * 0 and then sold one reads −1, not unknown.
 */
export function stockOf(events: readonly LedgerEvent[], varianId: string): StockLedgerEntry {
  const snapshot = foldStock(events).varian.get(varianId);
  const movements = snapshot?.movements ?? [];
  if (!snapshot || snapshot.owned === null) return { stock: { kind: 'unknown' }, movements };
  return { stock: { kind: 'counted', qty: normaliseQty(snapshot.owned) }, movements };
}

/** Titip units still on the shelf for one varian. Never added to owned stock. */
export function titipStockOf(events: readonly LedgerEvent[], varianId: string): number {
  return normaliseQty(foldStock(events).varian.get(varianId)?.titip ?? 0);
}

/** A varian with its derived count, as a list reads it. */
export interface StockRow {
  varian: Varian;
  stock: StockState;
}

/** Every live varian with its own count. Never pooled by produk or kategori. */
export function stockRows(events: readonly LedgerEvent[], varian: readonly Varian[]): StockRow[] {
  const fold = foldStock(events);
  return varian
    .filter((entry) => !entry.archived)
    .map((entry) => {
      const owned = fold.varian.get(entry.id)?.owned;
      return {
        varian: entry,
        stock: owned == null ? { kind: 'unknown' } : { kind: 'counted', qty: normaliseQty(owned) },
      };
    });
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
