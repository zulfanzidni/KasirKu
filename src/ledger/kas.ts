import { formatRupiah } from '../design/money';
import { dayStamp } from './saleNumber';
import type { CashBaselineKind, CashCounted, LedgerEvent } from './types';

/**
 * The cash drawer, derived from the log (spec §Cash, ADR 0001).
 *
 * Expected cash is never a stored running balance. It is the last thing that
 * said "the drawer held this much" — a declared opening float, or a previous
 * physical count — plus every movement after it:
 *
 *   expected = baseline
 *            + cash taken on sales
 *            + receivable.paid
 *            + cash.deposited
 *            − payable.paid
 *            − cash.expense
 *            − cash.withdrawn
 *            − cash handed back on a voided sale
 *
 * A count is a measurement, not a movement: it records what the owner saw, what
 * the log expected, and the difference, and it becomes the baseline for the
 * next count. The baseline is always named on screen, because a difference the
 * owner cannot explain is a difference they will learn to ignore.
 */

/** The amount the drawer held at the moment the comparison starts. */
export interface CashBaseline {
  kind: 'float' | 'count';
  jumlah: number;
  at: string;
  eventId: string;
}

export type CashMovementKind =
  | 'penjualan'
  | 'pembatalan'
  | 'hutang'
  | 'setor'
  | 'pemasok'
  | 'pengeluaran'
  | 'tarik';

/** One event that moved money in or out of the drawer. */
export interface CashMovementEntry {
  kind: CashMovementKind;
  at: string;
  /** Signed: what it did to the drawer. */
  jumlah: number;
  label: string;
  eventId: string;
}

/** The drawer as the log answers it, with the pieces that make up `expected`. */
export interface CashDrawer {
  /** Null only before any float or count has ever been recorded. */
  baseline: CashBaseline | null;
  expected: number;
  /** Cash taken on sales since the baseline. */
  penjualan: number;
  /** Cash handed back on voided sales, as a positive magnitude. */
  pembatalan: number;
  /** Hutang paid in cash since the baseline. */
  hutang: number;
  /** Money put in from outside. */
  setor: number;
  /** Money paid to suppliers, as a positive magnitude. */
  pemasok: number;
  /** Money paid out for anything else, as a positive magnitude. */
  pengeluaran: number;
  /** Money taken out, including banking the takings, as a positive magnitude. */
  tarik: number;
  /** Every movement after the baseline, oldest first. */
  movements: CashMovementEntry[];
}

/** The drawer at this moment, folded from the whole log. */
export function cashDrawer(events: readonly LedgerEvent[]): CashDrawer {
  let baseline: CashBaseline | null = null;
  let start = 0;

  // The last baseline event wins: a count becomes the next baseline, and an
  // explicit float supersedes a count that came before it (spec §Cash).
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.type === 'cash.opening_float') {
      baseline = { kind: 'float', jumlah: event.payload.jumlah, at: event.createdAt, eventId: event.id };
      start = index + 1;
    } else if (event.type === 'cash.counted') {
      baseline = { kind: 'count', jumlah: event.payload.counted, at: event.createdAt, eventId: event.id };
      start = index + 1;
    }
  }

  const drawer: CashDrawer = {
    baseline,
    expected: baseline?.jumlah ?? 0,
    penjualan: 0,
    pembatalan: 0,
    hutang: 0,
    setor: 0,
    pemasok: 0,
    pengeluaran: 0,
    tarik: 0,
    movements: [],
  };

  // A void cancels the sale it names. The cash it handed back is its own
  // figure on the screen, never a silent reduction of "penjualan": the owner
  // needs to see both the sale and the refund.
  const saleCashAt = new Map<string, number>();
  const saleAt = new Map<string, number>();
  const voidAt = new Map<string, number>();
  events.forEach((event, index) => {
    if (event.type === 'sale.completed') {
      const payment = event.payload.payment;
      const net = payment?.net ?? event.payload.total;
      const unpaid = payment?.unpaid ?? 0;
      saleCashAt.set(event.id, net - unpaid);
      saleAt.set(event.id, index);
    } else if (event.type === 'sale.voided') {
      const current = voidAt.get(event.payload.saleId);
      if (current === undefined || index < current) voidAt.set(event.payload.saleId, index);
    }
  });

  for (let index = start; index < events.length; index += 1) {
    const event = events[index];

    // A void that arrived before its sale means the sale never stood at this
    // point in the log; folding its cash would count money that never came.
    if (event.type === 'sale.completed') {
      const cancelledAt = voidAt.get(event.id);
      if (cancelledAt !== undefined && cancelledAt < index) continue;
    }

    if (event.type === 'sale.voided') {
      const soldAt = saleAt.get(event.payload.saleId);
      if (soldAt === undefined || soldAt > index) continue;
      // Only the first void hands the cash back; a second one would refund it
      // twice.
      if (voidAt.get(event.payload.saleId) !== index) continue;
      const cash = saleCashAt.get(event.payload.saleId) ?? 0;
      if (cash === 0) continue;
      drawer.movements.push({
        kind: 'pembatalan',
        at: event.createdAt,
        jumlah: -cash,
        label: 'Penjualan dibatalkan',
        eventId: event.id,
      });
      drawer.pembatalan += cash;
      continue;
    }

    const movement = movementOf(event);
    if (!movement) continue;
    drawer.movements.push(movement);
    switch (movement.kind) {
      case 'penjualan':
        drawer.penjualan += movement.jumlah;
        break;
      case 'pembatalan':
        drawer.pembatalan += -movement.jumlah;
        break;
      case 'hutang':
        drawer.hutang += movement.jumlah;
        break;
      case 'setor':
        drawer.setor += movement.jumlah;
        break;
      case 'pemasok':
        drawer.pemasok += -movement.jumlah;
        break;
      case 'pengeluaran':
        drawer.pengeluaran += -movement.jumlah;
        break;
      case 'tarik':
        drawer.tarik += -movement.jumlah;
        break;
    }
  }

  drawer.expected =
    (baseline?.jumlah ?? 0) +
    drawer.penjualan +
    drawer.hutang +
    drawer.setor -
    drawer.pemasok -
    drawer.pengeluaran -
    drawer.tarik -
    drawer.pembatalan;

  return drawer;
}

/** What one event did to the drawer, or null when it moved no cash. */
function movementOf(event: LedgerEvent): CashMovementEntry | null {
  switch (event.type) {
    case 'sale.completed': {
      // The drawer keeps the net, not the tendered: kembalian went back to the
      // customer, and an unpaid remainder never arrived.
      const payment = event.payload.payment;
      const net = payment?.net ?? event.payload.total;
      const unpaid = payment?.unpaid ?? 0;
      const cash = net - unpaid;
      if (cash === 0) return null;
      return { kind: 'penjualan', at: event.createdAt, jumlah: cash, label: 'Penjualan tunai', eventId: event.id };
    }

    case 'receivable.paid':
      return {
        kind: 'hutang',
        at: event.createdAt,
        jumlah: event.payload.jumlah,
        label: 'Pembayaran hutang',
        eventId: event.id,
      };

    case 'cash.deposited':
      return {
        kind: 'setor',
        at: event.createdAt,
        jumlah: event.payload.jumlah,
        label: event.payload.keterangan ?? 'Setor uang',
        eventId: event.id,
      };

    case 'payable.paid':
      return {
        kind: 'pemasok',
        at: event.createdAt,
        jumlah: -event.payload.amount,
        label: 'Bayar pemasok',
        eventId: event.id,
      };

    case 'cash.expense':
      return {
        kind: 'pengeluaran',
        at: event.createdAt,
        jumlah: -event.payload.jumlah,
        label: event.payload.keterangan,
        eventId: event.id,
      };

    case 'cash.withdrawn':
      return {
        kind: 'tarik',
        at: event.createdAt,
        jumlah: -event.payload.jumlah,
        label: event.payload.keterangan ?? 'Tarik uang',
        eventId: event.id,
      };

    default:
      return null;
  }
}

/** The baseline in the shop's words, always naming the amount it used. */
export function baselineLabel(baseline: CashBaseline | null): string {
  if (!baseline) return 'Patokan: belum ada — dihitung dari nol';
  if (baseline.kind === 'float') return `Patokan: kas awal Rp ${formatRupiah(baseline.jumlah)}`;
  return `Patokan: hitung terakhir Rp ${formatRupiah(baseline.jumlah)}`;
}

/** The baseline kind alone, for a history row that already shows the amount. */
export function baselineKindLabel(kind: CashBaselineKind): string {
  if (kind === 'float') return 'Patokan kas awal';
  if (kind === 'count') return 'Patokan hitung terakhir';
  return 'Patokan nol';
}

/** A difference in words: more, less, or exactly as expected. */
export function selisihLabel(difference: number): string {
  if (difference === 0) return 'Selisih pas';
  if (difference > 0) return `Selisih lebih Rp ${formatRupiah(difference)}`;
  return `Selisih kurang Rp ${formatRupiah(-difference)}`;
}

/** One recorded count, as the reconciliation history reads it. */
export interface CashCount {
  eventId: string;
  at: string;
  /** `YYYYMMDD`, the device-local day the count happened. */
  day: string;
  counted: number;
  expected: number;
  difference: number;
  baseline: CashBaselineKind;
  catatan: string | null;
}

/** Every count, newest first: the days the owner checked the drawer. */
export function cashCounts(events: readonly LedgerEvent[]): CashCount[] {
  return events
    .filter((event): event is CashCounted => event.type === 'cash.counted')
    .map((event) => ({
      eventId: event.id,
      at: event.createdAt,
      day: dayStamp(event.createdAt),
      counted: event.payload.counted,
      expected: event.payload.expected,
      difference: event.payload.difference,
      baseline: event.payload.baseline,
      catatan: event.payload.catatan,
    }))
    .reverse();
}

// ---------------------------------------------------------------------------
// Commands — what the Kas screen hands the ledger
// ---------------------------------------------------------------------------

/** A refusal about the drawer: a bad amount, or an expense with no reason. */
export class CashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CashError';
  }
}

export interface CashMovementInput {
  kind: 'expense' | 'withdrawn' | 'deposited';
  jumlah: number;
  /** Required for an expense; optional for a withdrawal or a deposit. */
  keterangan?: string | null;
}

function checkRupiah(jumlah: number, label: string): number {
  if (!Number.isInteger(jumlah) || jumlah < 0) {
    throw new CashError(`${label} harus angka rupiah bulat.`);
  }
  return jumlah;
}

/** The event a cash movement writes, validated before anything is appended. */
export function cashMovement(input: CashMovementInput): {
  type: 'cash.expense' | 'cash.withdrawn' | 'cash.deposited';
  payload: { jumlah: number; keterangan: string | null };
} {
  const jumlah = checkRupiah(input.jumlah, 'Jumlah');
  if (jumlah === 0) throw new CashError('Jumlah harus lebih dari 0.');
  const keterangan = input.keterangan?.trim() || null;
  if (input.kind === 'expense' && !keterangan) {
    throw new CashError('Keterangan pengeluaran wajib diisi.');
  }
  if (input.kind === 'expense') {
    return { type: 'cash.expense', payload: { jumlah, keterangan: keterangan as string } };
  }
  if (input.kind === 'withdrawn') {
    return { type: 'cash.withdrawn', payload: { jumlah, keterangan } };
  }
  return { type: 'cash.deposited', payload: { jumlah, keterangan } };
}

/** The event declaring what the drawer holds now. Zero is a real declaration. */
export function openingFloat(input: { jumlah: number }): {
  type: 'cash.opening_float';
  payload: { jumlah: number };
} {
  return { type: 'cash.opening_float', payload: { jumlah: checkRupiah(input.jumlah, 'Kas awal') } };
}

/**
 * The count event, with the expected figure and the baseline frozen beside it.
 * The baseline is read from the log at this moment, so a later float cannot
 * rewrite what an earlier count was compared against.
 */
export function countPayload(
  events: readonly LedgerEvent[],
  input: { counted: number; catatan?: string | null },
): { type: 'cash.counted'; payload: CashCounted['payload'] } {
  const counted = checkRupiah(input.counted, 'Jumlah dihitung');
  const drawer = cashDrawer(events);
  return {
    type: 'cash.counted',
    payload: {
      counted,
      expected: drawer.expected,
      difference: counted - drawer.expected,
      baseline: drawer.baseline?.kind ?? 'nol',
      baselineJumlah: drawer.baseline?.jumlah ?? 0,
      baselineAt: drawer.baseline?.at ?? null,
      catatan: input.catatan?.trim() || null,
    },
  };
}
