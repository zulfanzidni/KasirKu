/**
 * The nota on paper.
 *
 * `receiptHtml` turns the one `ReceiptData` structure into the document
 * `expo-print` writes to PDF. It is pure, so the paper can be checked without a
 * phone, and a thermal renderer added later reads the same structure without
 * touching the sale flow (spec §Receipts).
 *
 * Flat colours and IBM Plex only: the PDF is rendered off-screen, so it cannot
 * borrow the app's loaded fonts and must not rely on anything it downloads.
 */

import { formatRupiah } from '../design/money';
import type { ReceiptData } from './receipt';

export function receiptHtml(nota: ReceiptData): string {
  const lines = nota.lines
    .map(
      (line) => `<tr class="line">
        <td class="nama">${escapeHtml(line.label)} <span class="qty">${escapeHtml(line.qty)}</span></td>
        <td class="uang">${formatRupiah(line.amount)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<style>${STYLE}</style>
</head>
<body>
  <header class="toko">
    <h1>${escapeHtml(nota.header.nama)}</h1>
    ${nota.header.keterangan ? `<p class="keterangan">${escapeHtml(nota.header.keterangan)}</p>` : ''}
  </header>

  <p class="meta"><span>No. ${escapeHtml(nota.number)}</span><span>${escapeHtml(nota.tanggal)} · ${escapeHtml(nota.jam)}</span></p>

  <table class="items">${lines}</table>

  <table class="jumlah">
    <tr><td>Total barang</td><td class="uang">${formatRupiah(nota.gross)}</td></tr>
    <tr><td>Diskon</td><td class="uang">${nota.discount > 0 ? `−${formatRupiah(nota.discount)}` : '—'}</td></tr>
    <tr><td>Pembulatan</td><td class="uang">${signed(nota.rounding)}</td></tr>
  </table>

  <div class="total">
    <span class="total-label">Total</span>
    <span class="total-uang">${formatRupiah(nota.total)}</span>
  </div>

  <table class="jumlah">
    <tr><td>Tunai</td><td class="uang">${formatRupiah(nota.tendered)}</td></tr>
    <tr><td>Kembalian</td><td class="uang">${formatRupiah(nota.kembalian)}</td></tr>
  </table>

  <footer class="kaki">${escapeHtml(nota.footer)}</footer>
</body>
</html>`;
}

/** `+200`, `−200`, or the dash when the cash step came out exact. */
function signed(amount: number): string {
  if (amount === 0) return '—';
  return `${amount > 0 ? '+' : '−'}${formatRupiah(Math.abs(amount))}`;
}

/** Escapes what the owner typed, so a shop name with an ampersand still prints. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE = `
  @page { margin: 12mm; }
  body {
    font-family: 'IBM Plex Sans', Helvetica, Arial, sans-serif;
    font-variant-numeric: tabular-nums;
    color: #2F2A24;
    font-size: 12pt;
    line-height: 1.45;
    margin: 0;
  }
  h1 {
    font-family: 'Kalam', 'Segoe Script', cursive;
    color: #1F3A6E;
    font-size: 22pt;
    margin: 0;
    text-align: center;
  }
  .toko { text-align: center; }
  .keterangan { color: #8A7F6D; margin: 2mm 0 0; white-space: pre-line; }
  .meta {
    display: flex;
    justify-content: space-between;
    color: #8A7F6D;
    font-size: 10pt;
    border-top: 1.5pt solid #1F3A6E;
    border-bottom: 1.5pt solid #1F3A6E;
    padding: 2mm 0;
    margin: 4mm 0 0;
  }
  table { width: 100%; border-collapse: collapse; }
  .line td { padding: 1.6mm 0; border-bottom: 0.5pt solid #DED5C4; }
  .nama { color: #2F2A24; }
  .qty { color: #8A7F6D; margin-left: 1.5mm; }
  .uang { text-align: right; white-space: nowrap; }
  .jumlah td { padding: 1.2mm 0; }
  .jumlah { margin-top: 3mm; }
  .total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 3pt double #1F3A6E;
    border-bottom: 1.5pt solid #1F3A6E;
    padding: 2mm 0;
    margin-top: 4mm;
  }
  .total-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10pt; font-weight: 600; color: #1F3A6E; }
  .total-uang { font-family: 'Kalam', cursive; font-size: 24pt; font-weight: 700; color: #1F3A6E; }
  .kaki {
    text-align: center;
    color: #8A7F6D;
    margin-top: 10mm;
    white-space: pre-line;
  }
`;
