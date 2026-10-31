/**
 * The nota, as data. One structure that every renderer reads — the PDF the
 * customer gets today, a thermal slip later — so the sale flow never learns
 * how paper is drawn (spec §Receipts).
 *
 * Everything here is derived from the sale that was written, never from the
 * cart: the figures on the paper are the figures in the log. Text is laid out
 * here (`×3`, `−1.200`) so the PDF, the screen preview and a future renderer
 * cannot each phrase the same number differently.
 *
 * Pure: no clock, no I/O, no printing.
 */

import { formatQty, formatRupiah } from '../design/money';
import { receiptHtml } from './receiptHtml';
import type { Printer, Sale } from './types';

/** Who the nota is from, in the owner's own words (settings.updated). */
export interface ReceiptHeader {
  /** The shop's name, set in pen at the top. */
  nama: string;
  /** Address or phone, printed beneath the name. Free text, possibly several lines. */
  keterangan: string;
}

export interface ReceiptShop {
  header: ReceiptHeader;
  /** The closing line: thanks, opening hours, a phone number. */
  footer: string;
}

/** What the receipt shows when the owner has set nothing yet. */
export const DEFAULT_RECEIPT: ReceiptShop = {
  header: {
    nama: 'KasirKu',
    keterangan: 'Atur nama toko di Pengaturan, Lainnya.',
  },
  footer: 'Terima kasih sudah berbelanja.',
};

export interface ReceiptLine {
  /** The varian's name as it was sold. */
  label: string;
  /** `×3` or `×0,25 kg` — a quantity mark, not money. */
  qty: string;
  /** The line's own rupiah, rounded once at the line. */
  amount: number;
}

export interface ReceiptData {
  /** `YYYYMMDD-<device>-<seq>`; the sale's UUID stays the key. */
  number: string;
  /** The sale happened at this moment (device-local ISO 8601). */
  at: string;
  /** Day, printed for a person: `31/10/2026`. */
  tanggal: string;
  /** Time, printed for a person: `14.05`. */
  jam: string;
  header: ReceiptHeader;
  footer: string;
  /** One line per sale line; two variants of a product are two lines. */
  lines: ReceiptLine[];
  /** Sum of the line amounts, before anything else. */
  gross: number;
  /** Discount in rupiah, already clamped to the gross. 0 when none. */
  discount: number;
  /** Signed pembulatan: +250 rounded up, −250 rounded down, 0 when exact. */
  rounding: number;
  /** Gross − discount + pembulatan. The figure under the double rule. */
  total: number;
  tendered: number;
  kembalian: number;
}

/**
 * Builds the nota from a printed sale. A sale written before payments were
 * recorded reads as its gross paid exactly, rather than as a blank receipt.
 */
export function receiptOf(sale: Sale, shop: ReceiptShop = DEFAULT_RECEIPT): ReceiptData {
  const gross = sale.lines.reduce((sum, line) => sum + line.jumlah, 0);
  const payment = sale.payment;
  const discount = payment?.discount ?? 0;
  const rounding = payment?.rounding ?? 0;
  const total = payment?.net ?? gross;
  const tendered = payment?.tendered ?? total;
  const at = new Date(sale.createdAt);

  return {
    number: sale.number,
    at: sale.createdAt,
    tanggal: formatTanggal(at),
    jam: formatJam(at),
    header: shop.header,
    footer: shop.footer,
    lines: sale.lines.map((line) => ({
      label: line.nama,
      qty: `×${formatQty(line.qty)}${line.satuan === 'pcs' ? '' : ` ${line.satuan}`}`,
      amount: line.jumlah,
    })),
    gross,
    discount,
    rounding,
    total,
    tendered,
    kembalian: payment?.kembalian ?? 0,
  };
}

/**
 * Writes the sale's nota to a PDF and hands it to the phone's share sheet —
 * which is also where "save to phone" lives on Android.
 *
 * The file is written even when the phone cannot share, so a phone without
 * sharing has still printed the nota; `shared` says which happened rather than
 * pretending the customer got a file they did not.
 */
export async function shareReceipt(
  printer: Printer,
  sale: Sale,
  shop: ReceiptShop = DEFAULT_RECEIPT,
): Promise<{ uri: string; shared: boolean }> {
  const { uri } = await printer.printToFile(receiptHtml(receiptOf(sale, shop)));
  if (!(await printer.canShare())) return { uri, shared: false };
  await printer.share(uri, 'application/pdf');
  return { uri, shared: true };
}

/** The discount as the paper shows it: already signed, or the dash for none. */export function discountLine(nota: ReceiptData): string {
  return nota.discount > 0 ? `−${formatRupiah(nota.discount)}` : '—';
}

/** The pembulatan line, signed: `+250`, `−250`, or the dash when the step came out exact. */
export function roundingLine(nota: ReceiptData): string {
  if (nota.rounding === 0) return '—';
  const sign = nota.rounding > 0 ? '+' : '−';
  return `${sign}${formatRupiah(Math.abs(nota.rounding))}`;
}

/** `31/10/2026` — the way the shop writes a date. Local day, as the phone knows it. */
function formatTanggal(at: Date): string {
  if (Number.isNaN(at.getTime())) return '';
  const day = String(at.getDate()).padStart(2, '0');
  const month = String(at.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${at.getFullYear()}`;
}

/** `14.05` — 24-hour, a dot between as Indonesian writes it, no seconds. */
function formatJam(at: Date): string {
  if (Number.isNaN(at.getTime())) return '';
  return `${String(at.getHours()).padStart(2, '0')}.${String(at.getMinutes()).padStart(2, '0')}`;
}
