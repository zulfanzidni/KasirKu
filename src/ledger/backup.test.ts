import { BACKUP_FORMAT, parseBackup, serializeBackup } from './backup';
import { createLedger, type Ledger } from './ledger';
import { MemoryStore } from './memoryStore';
import { stockOf } from './stock';

/**
 * Cadangan — the whole log in one file.
 *
 * A backup is not a second kind of record: it is the same events, plus the
 * phone's own name and the last number it used, so another phone can finish the
 * sentence this one started. These tests read the file, never the database.
 */

describe('cadangan — seluruh catatan dalam satu berkas', () => {
  it('menyalin setiap peristiwa, identitas gawai dan nomor urut terakhir', async () => {
    const store = new MemoryStore();
    const kasir = createLedger(store, 'gawai-ibu');
    await seedWarung(kasir);

    const backup = await kasir.backup();

    expect(backup.format).toBe('kasirku-cadangan');
    expect(backup.deviceId).toBe('gawai-ibu');
    // Every event, in the order the log holds them — not a summary.
    expect(backup.events.map((event) => event.id)).toEqual((await store.readAll()).map((event) => event.id));
    // The tail is part of the file: a restored phone must not reuse a number.
    expect(backup.lastSeq).toBe(5);
  });

  it('memulihkan riwayat di ponsel baru dengan angka, nomor nota dan identitas yang sama', async () => {
    const ibu = createLedger(new MemoryStore(), 'gawai-ibu');
    const asal = await seedWarung(ibu);
    const asalShop = await ibu.shop();
    const backup = await ibu.backup();

    // A freshly installed app: a new phone with its own name already picked.
    const anak = createLedger(new MemoryStore(), 'gawai-anak');
    await anak.restore(backup);

    const pulih = await anak.shop();
    expect(pulih.varian.map((varian) => varian.nama)).toEqual(asalShop.varian.map((varian) => varian.nama));
    expect(pulih.sales.map((sale) => sale.total)).toEqual(asalShop.sales.map((sale) => sale.total));
    expect(pulih.sales.map((sale) => sale.number)).toEqual(asalShop.sales.map((sale) => sale.number));
    // A literal anchor, independent of the fold: day, the phone's own code, seq.
    expect(asalShop.sales[0].number).toMatch(/^\d{8}-GAWA-005$/);
    expect(stockOf(await anak.events(), asal.varianId).stock).toEqual({ kind: 'counted', qty: 8 });
    // The recovered shop is still the old phone, speaking in its own name.
    expect(anak.deviceId).toBe('gawai-ibu');

    // The next sale continues the original stream: never a second number 1.
    const id = await anak.recordSale([{ varianId: asal.varianId, qty: 1 }], {
      discount: { kind: 'none' },
      tendered: 5_000,
    });
    const next = (await anak.shop()).sales.find((sale) => sale.id === id)!;
    expect(next.number).toMatch(/^\d{8}-GAWA-006$/);
  });

  it('mengganti seluruh log dengan isi cadangan, bukan mencampurnya', async () => {
    const ibu = createLedger(new MemoryStore(), 'gawai-ibu');
    await seedWarung(ibu);
    const backup = await ibu.backup();

    // A phone that already sold something of its own: that history must not
    // survive beside the restored one, or the shop would count two days.
    const anak = createLedger(new MemoryStore(), 'gawai-anak');
    await anak.append('kategori.created', { nama: 'Toko lama', parentId: null });
    await anak.restore(backup);

    const shop = await anak.shop();
    expect(shop.kategori.map((kategori) => kategori.nama)).toEqual(['Sembako']);
    expect(shop.sales).toHaveLength(1);
  });
});

describe('cadangan — berkasnya bisa dibaca kembali', () => {
  it('menulis lalu membaca berkas tanpa kehilangan satu peristiwa pun', async () => {
    const ibu = createLedger(new MemoryStore(), 'gawai-ibu');
    await seedWarung(ibu);

    const backup = await ibu.backup();
    const text = serializeBackup(backup);

    expect(JSON.parse(text).format).toBe(BACKUP_FORMAT);
    expect(parseBackup(text)).toEqual(backup);
  });

  it('menolak berkas lain dengan kalimat yang bisa ditindaklanjuti', () => {
    expect(() => parseBackup('bukan json sama sekali')).toThrow('Berkas ini bukan cadangan KasirKu.');
    expect(() => parseBackup('{"halo":1}')).toThrow('Berkas ini bukan cadangan KasirKu.');
    expect(() => parseBackup(JSON.stringify({ ...backupKosong(), events: [{ id: 'x' }] }))).toThrow(
      'Berkas ini bukan cadangan KasirKu.',
    );
  });

  it('menolak cadangan dari versi aplikasi yang lebih baru, bukan menebak isinya', () => {
    expect(() => parseBackup(JSON.stringify({ ...backupKosong(), version: 99 }))).toThrow(
      'Cadangan ini dari versi KasirKu yang lebih baru. Perbarui aplikasi dulu.',
    );
  });
});

function backupKosong() {
  return { format: BACKUP_FORMAT, version: 1, deviceId: 'gawai-uji', lastSeq: 0, events: [] };
}

/** A shop that has sold something: the smallest history worth rescuing. */
async function seedWarung(kasir: Ledger) {
  const kategoriId = await kasir.append('kategori.created', { nama: 'Sembako', parentId: null });
  const produkId = await kasir.append('produk.created', { kategoriId, nama: 'Indomie goreng' });
  const varianId = await kasir.append('varian.created', {
    produkId,
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
  await kasir.adjustStock({ varianId, counted: 10, reason: 'Hitung gudang' });
  await kasir.recordSale([{ varianId, qty: 2 }], { discount: { kind: 'none' }, tendered: 10_000 });
  return { kategoriId, produkId, varianId };
}
