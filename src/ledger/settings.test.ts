import { createLedger, type Ledger } from './ledger';
import { MemoryStore } from './memoryStore';
import { receiptOf, shareReceipt } from './receipt';
import { receiptHtml } from './receiptHtml';
import type { Sale } from './types';

/**
 * The owner's own shop name and closing line on the nota.
 *
 * They are part of the record, not a device setting: they arrive as a
 * `settings.updated` event, so the second phone and a restored backup say the
 * same thing, and the receipt — on screen and on the PDF — reads them.
 */

describe('the nota in the owner’s words', () => {
  it('takes the header and footer the owner set, not only the ones this ticket shipped with', async () => {
    const till = await newTill();
    const sale = await till.sell();

    await act(till.ledger, () =>
      till.ledger.append('settings.updated', {
        receipt: {
          header: { nama: 'Warung Bu Sri', keterangan: 'Jl. Melati 12 · 0812-3456-7890' },
          footer: 'Terima kasih, datang lagi ya.',
        },
      }),
    );

    const shop = await till.ledger.shop();
    const nota = receiptOf(sale, shop.receipt);

    expect(nota.header).toEqual({ nama: 'Warung Bu Sri', keterangan: 'Jl. Melati 12 · 0812-3456-7890' });
    expect(nota.footer).toBe('Terima kasih, datang lagi ya.');
  });

  it('prints the shop name and footer on the PDF the customer gets', async () => {
    const till = await newTill();
    const sale = await till.sell();
    await act(till.ledger, () =>
      till.ledger.append('settings.updated', {
        receipt: { header: { nama: 'Warung Bu Sri', keterangan: '' }, footer: 'Datang lagi ya.' },
      }),
    );
    let paper = '';

    const shop = await till.ledger.shop();
    await shareReceipt(
      {
        print: async (nota) => {
          paper = receiptHtml(nota);
          return { uri: 'file:///cache/nota.pdf' };
        },
        canShare: async () => true,
        share: async () => {},
      },
      sale,
      shop.receipt,
    );

    expect(paper).toContain('Warung Bu Sri');
    expect(paper).toContain('Datang lagi ya.');
  });

  it('keeps the sent figures if the other phone sends older ones', async () => {
    // Settings are master data: last write wins on the moment it was written.
    const store = new MemoryStore();
    const ledger = createLedger(store, 'gawai-a');
    await ledger.append('settings.updated', {
      receipt: { header: { nama: 'Baru', keterangan: '' }, footer: 'Baru' },
    });
    // An older edit, as the other phone would send it after a late sync.
    await store.append([
      {
        id: 'evt-lama',
        deviceId: 'gawai-b',
        seq: 1,
        createdAt: '2020-01-01T00:00:00.000Z',
        type: 'settings.updated',
        payload: { receipt: { header: { nama: 'Lama', keterangan: '' }, footer: 'Lama' } },
      } as never,
    ]);

    expect((await ledger.shop()).receipt.header.nama).toBe('Baru');
  });
});

/** Writes through the ledger and lets its fold land, the way the provider does. */
async function act(ledger: Ledger, write: () => Promise<unknown>) {
  await write();
  await ledger.shop();
}

async function newTill() {
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
  return {
    ledger,
    async sell(): Promise<Sale> {
      const id = await ledger.recordSale([{ varianId, qty: 2 }], { discount: { kind: 'none' }, tendered: 7000 });
      const sale = (await ledger.shop()).sales.find((entry) => entry.id === id);
      if (!sale) throw new Error('Penjualan tidak ada di catatan.');
      return sale;
    },
  };
}
