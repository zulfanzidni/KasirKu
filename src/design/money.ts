/**
 * Rupiah formatting and the money arithmetic the whole app depends on.
 *
 * Rules this file exists to enforce (DESIGN.md, spec §Selling):
 *  - money is integer rupiah, always
 *  - a line total is round(price × qty), rounded ONCE, at the line
 *  - cash rounding happens after discount, and is its own visible line
 *  - kembalian is never negative; a shortfall is hutang
 */

/** Format an integer rupiah amount the way the shop writes it: 61.500 */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const negative = amount < 0;
  const digits = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return negative ? `−${digits}` : digits;
}

/** Format with the Rp prefix, for headings and receipts. */
export function formatRupiahFull(amount: number): string {
  return `Rp ${formatRupiah(amount)}`;
}

/**
 * Round a cash amount to the nearest step (default Rp 500).
 * Ties round up, so the shop never shortchanges itself by a rupiah.
 */
export function roundToCashStep(amount: number, step = 500): number {
  if (step <= 0) return Math.round(amount);
  return Math.ceil(amount / step) * step;
}

/** The rounding adjustment itself, as a signed number for the receipt line. */
export function roundingAdjustment(amount: number, step = 500): number {
  return roundToCashStep(amount, step) - Math.round(amount);
}

/**
 * A discount expressed either as rupiah or as a percentage, clamped so a
 * discount can never exceed the gross total or go negative.
 */
export type Discount =
  | { kind: 'none' }
  | { kind: 'rupiah'; value: number }
  | { kind: 'percent'; value: number };

export function discountAmount(gross: number, discount: Discount): number {
  if (discount.kind === 'none') return 0;
  const raw =
    discount.kind === 'rupiah'
      ? discount.value
      : Math.round((gross * discount.value) / 100);
  return Math.max(0, Math.min(Math.round(raw), gross));
}

/** A cart line. Quantity may be fractional for weight items. */
export interface CartLineLike {
  unitPrice: number;
  qty: number;
}

/** One line's total, rounded once. Every device must compute this identically. */
export function lineTotal(line: CartLineLike): number {
  return Math.round(line.unitPrice * line.qty);
}

export function cartSubtotal(lines: readonly CartLineLike[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

/**
 * The full money picture for a cart. Every screen and the receipt render from
 * this, so the arithmetic can only be written once.
 */
export interface OrderTotals {
  /** Sum of line totals. */
  subtotal: number;
  discount: number;
  /** After discount, before cash rounding. */
  net: number;
  /** Cash rounding adjustment; zero when tendered is exact or rounding is off. */
  rounding: number;
  /** What the customer actually owes in cash. */
  due: number;
  tendered: number;
  /** Cash handed back. Never negative. */
  kembalian: number;
  /** Unpaid remainder added to the customer's hutang. Never negative. */
  hutang: number;
}

export function computeTotals(input: {
  lines: readonly CartLineLike[];
  discount?: Discount;
  tendered?: number;
  cashStep?: number;
  applyRounding?: boolean;
}): OrderTotals {
  const subtotal = cartSubtotal(input.lines);
  const discount = discountAmount(subtotal, input.discount ?? { kind: 'none' });
  const net = subtotal - discount;
  const rounding = input.applyRounding === false ? 0 : roundingAdjustment(net, input.cashStep ?? 500);
  const due = net + rounding;
  const tendered = Math.max(0, Math.round(input.tendered ?? 0));

  return {
    subtotal,
    discount,
    net,
    rounding,
    due,
    tendered,
    kembalian: Math.max(0, tendered - due),
    hutang: Math.max(0, due - tendered),
  };
}

/**
 * Parse a rupiah string a human typed. Accepts "13.500", "13500", "Rp 13.500",
 * and ignores spaces. Returns null when it is not a number, so the field can
 * say so rather than silently reading zero.
 */
export function parseRupiah(input: string): number | null {
  const cleaned = input.replace(/rp/gi, '').replace(/[\s.]/g, '').replace(/,/g, '');
  if (cleaned === '') return null;
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

/**
 * Parse a fractional quantity typed for a weight item: "1,5", "0,25", "1.5",
 * "2". Returns null when it is not a number.
 */
export function parseQty(input: string): number | null {
  const cleaned = input.trim().replace(',', '.');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Format a quantity without trailing zeros: 2 → "2", 0.25 → "0,25". */
export function formatQty(qty: number): string {
  return qty.toString().replace('.', ',');
}
