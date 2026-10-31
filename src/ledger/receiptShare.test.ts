import { createLedger } from './ledger';
import { MemoryStore } from './memoryStore';
import { shareReceipt } from './receipt';
import type { Sale } from './types';

/**
 * Handing the customer a nota: the app writes a PDF and gives it to the phone's
 * share sheet. The test reads what was handed over — the document and the
 * share call — because that is what the customer receives.
 */

describe('sharing the nota of a sale', () => {
  it('prints a PDF of the sale and hands that file to the share sheet', async () => {
    const sale = await sellIndomie();
    const printed: string[] = [];
    const shared: { uri: string; mimeType: string }[] = [];
    const printer = {
      printToFile: async (html: string) => {
        printed.push(html);
        return { uri: 'file:///cache/nota-1.pdf' };
      },
      canShare: async () => true,
      share: async (uri: string, mimeType: string) => {
        shared.push({ uri, mimeType });
      },
    };

    const result = await shareReceipt(printer, sale);

    expect(result).toEqual({ uri: 'file:///cache/nota-1.pdf', shared: true });
    expect(printed).toHaveLength(1);
    expect(shared).toEqual([{ uri: 'file:///cache/nota-1.pdf', mimeType: 'application/pdf' }]);
  });

  it('puts the lines, the number and the kembalian on the paper it prints', async () => {
    const sale = await sellIndomie();
    let paper = '';
    const printer = {
      printToFile: async (html: string) => {
        paper = html;
        // A document, not an escape sequence: it is the PDF body expo-print gets.
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        return { uri: 'file:///cache/nota.pdf' };
      },
      canShare: async () => true,
      share: async () => {},
    };

    await shareReceipt(printer, sale);

    expect(paper).toContain(sale.number);
    expect(paper).toContain('Indomie goreng');
    expect(paper).toContain('×2');
    expect(paper).toContain('7.000');
    expect(paper).toContain('Pembulatan');
    expect(paper).toContain('Kembalian');
    // 7.000 tendered for a 7.000 sale: nothing back.
    expect(paper).toContain('Terima kasih sudah berbelanja.');
  });

  it('still writes the file when the phone cannot share, and says it was not shared', async () => {
    const sale = await sellIndomie();
    const printer = {
      printToFile: async () => ({ uri: 'file:///cache/nota.pdf' }),
      canShare: async () => false,
      share: async () => {
        throw new Error('tidak boleh dipanggil');
      },
    };

    expect(await shareReceipt(printer, sale)).toEqual({ uri: 'file:///cache/nota.pdf', shared: false });
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
