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

  ${
    nota.voided
      ? `<div class="batal">
    <span class="batal-judul">NOTA DIBATALKAN</span>
    ${nota.voidReason ? `<span class="batal-alasan">${escapeHtml(nota.voidReason)}</span>` : ''}
  </div>`
      : ''
  }

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
    ${
      nota.hutang > 0
        ? `<tr class="hutang"><td>Hutang${nota.pelanggan ? ` ${escapeHtml(nota.pelanggan)}` : ''}</td><td class="uang">${formatRupiah(nota.hutang)}</td></tr>`
        : ''
    }
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
    color: #101418;
    font-size: 12pt;
    line-height: 1.45;
    margin: 0;
  }
  h1 {
    font-family: 'IBM Plex Sans', Helvetica, Arial, sans-serif;
    font-weight: 600;
    color: #101418;
    font-size: 20pt;
    margin: 0;
    text-align: center;
  }
  .toko { text-align: center; }
  .keterangan { color: #64645D; margin: 2mm 0 0; white-space: pre-line; }
  .meta {
    display: flex;
    justify-content: space-between;
    color: #64645D;
    font-size: 10pt;
    border-top: 1.5pt solid #101418;
    border-bottom: 1.5pt solid #101418;
    padding: 2mm 0;
    margin: 4mm 0 0;
  }
  .batal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1mm;
    margin: 4mm 0 0;
    padding: 2.5mm;
    border: 2pt solid #A8231F;
    color: #A8231F;
  }
  .batal-judul { font-weight: 700; letter-spacing: 0.16em; font-size: 13pt; }
  .batal-alasan { font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; }
  .line td { padding: 1.6mm 0; border-bottom: 0.5pt solid #E2E2DC; }
  .nama { color: #101418; }
  .qty { color: #64645D; margin-left: 1.5mm; }
  .uang { text-align: right; white-space: nowrap; }
  .jumlah td { padding: 1.2mm 0; }
  .jumlah { margin-top: 3mm; }
  .hutang td { color: #A8231F; font-weight: 600; }
  .total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 3pt double #101418;
    border-bottom: 1.5pt solid #101418;
    padding: 2mm 0;
    margin-top: 4mm;
  }
  .total-label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10pt; font-weight: 600; color: #101418; }
  .total-uang { font-family: 'IBM Plex Sans', Helvetica, Arial, sans-serif; font-size: 22pt; font-weight: 600; color: #101418; }
  .kaki {
    text-align: center;
    color: #64645D;
    margin-top: 10mm;
    white-space: pre-line;
  }
`;
