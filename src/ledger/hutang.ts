import type { LedgerEvent } from './types';

/**
 * Hutang, derived from the log (ADR 0001). A customer's balance is never a
 * stored column: it is the sum of the sales that left money unpaid, minus the
 * payments they made, minus anything explicitly written off.
 *
 * A payment and a write-off are different events on purpose. Both reduce the
 * balance, but only a payment moves cash, so a collections figure that added
 * them together would be a lie. The history keeps them apart by `kind`.
 *
 * Pure: same events in, same balance out, on any phone.
 */

/** One thing that moved a customer's balance, in the order it happened. */
export type HutangEntry =
  | { kind: 'penjualan'; at: string; jumlah: number; saleId: string; nomor: string }
  | { kind: 'pembayaran'; at: string; jumlah: number; eventId: string }
  | { kind: 'hapusbuku'; at: string; jumlah: number; alasan: string; eventId: string };

/**
 * What the customer's balance is, as a discriminated result rather than a
 * signed number: an overpayment is a **credit**, not a negative hutang, and a
 * settled customer is neither.
 */
export type HutangState =
  | { kind: 'lunas' }
  | { kind: 'hutang'; jumlah: number }
  | { kind: 'kredit'; jumlah: number };

export interface HutangLedger {
  state: HutangState;
  /** Signed: positive means the customer owes, negative means they are in credit. */
  saldo: number;
  /** Every movement, oldest first, each with the balance after it. */
  entries: (HutangEntry & { setelah: number })[];
}

/** The balance and history of one customer, folded from the whole log. */
export function hutangOf(events: readonly LedgerEvent[], pelangganId: string): HutangLedger {
  const entries: (HutangEntry & { setelah: number })[] = [];
  let saldo = 0;

  for (const event of events) {
    switch (event.type) {
      case 'sale.completed': {
        if (event.payload.pelangganId !== pelangganId) break;
        const unpaid = event.payload.payment?.unpaid ?? 0;
        if (unpaid <= 0) break;
        saldo += unpaid;
        entries.push({
          kind: 'penjualan',
          at: event.createdAt,
          jumlah: unpaid,
          saleId: event.id,
          nomor: event.payload.number ?? '',
          setelah: saldo,
        });
        break;
      }

      case 'receivable.paid':
        if (event.payload.pelangganId !== pelangganId) break;
        saldo -= event.payload.jumlah;
        entries.push({
          kind: 'pembayaran',
          at: event.createdAt,
          jumlah: event.payload.jumlah,
          eventId: event.id,
          setelah: saldo,
        });
        break;

      case 'receivable.written_off':
        if (event.payload.pelangganId !== pelangganId) break;
        saldo -= event.payload.jumlah;
        entries.push({
          kind: 'hapusbuku',
          at: event.createdAt,
          jumlah: event.payload.jumlah,
          alasan: event.payload.alasan,
          eventId: event.id,
          setelah: saldo,
        });
        break;
    }
  }

  return { state: stateOf(saldo), saldo, entries };
}

/** A signed balance read the way the shop says it: hutang, lunas, or kredit. */
export function stateOf(saldo: number): HutangState {
  if (saldo > 0) return { kind: 'hutang', jumlah: saldo };
  if (saldo < 0) return { kind: 'kredit', jumlah: -saldo };
  return { kind: 'lunas' };
}
