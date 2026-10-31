import { createLedger } from './ledger';
import { MemoryStore } from './memoryStore';
import { receiptOf } from './receipt';
import { receiptHtml } from './receiptHtml';
import type { Sale } from './types';

/**
 * The paper a customer takes away. The PDF is drawn from `ReceiptData`, so
 * what these tests read is the document handed to expo-print: the same lines,
 * sums and number the shop shows on screen.
 */

describe('the PDF document', () => {
  it('puts the lines, the number, pembulatan and kembalian on the paper', async () => {
    const sale = await sellIndomie();

    const paper = receiptHtml(receiptOf(sale));

    expect(paper.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(paper).toContain(sale.number);
    expect(paper).toContain('Indomie goreng');
    expect(paper).toContain('×2');
    expect(paper).toContain('7.000');
    expect(paper).toContain('Pembulatan');
    expect(paper).toContain('Kembalian');
    expect(paper).toContain('Terima kasih sudah berbelanja.');
  });

  it('escapes what the owner typed, so a name with an ampersand still prints', async () => {
    const sale = await sellIndomie();

    const paper = receiptHtml(
      receiptOf(sale, { header: { nama: 'Toko A & B', keterangan: '<Jl. Melati>' }, footer: '—' }),
    );

    expect(paper).toContain('Toko A &amp; B');
    expect(paper).toContain('&lt;Jl. Melati&gt;');
    expect(paper).not.toContain('<Jl. Melati>');
  });
});

async function sellIndomie(): Promise<Sale> {
  const ledger = createLedger(new MemoryStore(), 'gawai-uji');
  const produkId = await ledger.append('produk.created', { kategoriId: 'kat', nama: 'Makanan' });
  const varianId = await ledger.append('varian.created', {
    produkId,
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
  const id = await ledger.recordSale([{ varianId, qty: 2 }], { discount: { kind: 'none' }, tendered: 7000 });
  const sale = (await ledger.shop()).sales.find((entry) => entry.id === id);
  if (!sale) throw new Error('Penjualan tidak ada di catatan.');
  return sale;
}
