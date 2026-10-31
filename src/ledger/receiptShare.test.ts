import { createLedger } from './ledger';
import { MemoryStore } from './memoryStore';
import { shareReceipt } from './receipt';
import type { Sale } from './types';

/**
 * Handing the customer a nota: the app asks the printer for a file and gives
 * it to the phone's share sheet. The test reads what was handed over, because
 * that is what reaches the customer.
 */

describe('sharing the nota of a sale', () => {
  it('prints the sale and hands that file to the share sheet', async () => {
    const sale = await sellIndomie();
    const printed: string[] = [];
    const shared: { uri: string; mimeType: string }[] = [];
    const printer = {
      print: async (nota: { number: string }) => {
        printed.push(nota.number);
        return { uri: 'file:///cache/nota-1.pdf' };
      },
      canShare: async () => true,
      share: async (uri: string, mimeType: string) => {
        shared.push({ uri, mimeType });
      },
    };

    const result = await shareReceipt(printer, sale);

    expect(result).toEqual({ uri: 'file:///cache/nota-1.pdf', shared: true });
    // The phone was asked to print *this sale's* nota, not some other paper.
    expect(printed).toEqual([sale.number]);
    expect(shared).toEqual([{ uri: 'file:///cache/nota-1.pdf', mimeType: 'application/pdf' }]);
  });

  it('still writes the file when the phone cannot share, and says it was not shared', async () => {
    const sale = await sellIndomie();
    const printer = {
      print: async () => ({ uri: 'file:///cache/nota.pdf' }),
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
