import { sumSales } from './events';
import { createLedger, type Ledger } from './ledger';
import { hutangOf } from './hutang';
import { liveSales } from './queries';
import { MemoryExchange } from './memoryExchange';
import { MemoryStore } from './memoryStore';
import { STARTING_CHECKPOINT, parseCheckpoint, syncLedger, unsentEvents, type SyncCheckpoint } from './sync';
import { stockOf } from './stock';
import type { StoredEvent } from './store';
import type { PaymentInput } from './types';

/**
 * Two phones, one shared place to meet (ADR 0001).
 *
 * Each test speaks in the shop's terms: what was sold while the other phone was
 * away, what is on the shelf once they meet, which nota exists where. Nothing
 * here reads SQL or the sync endpoint's insides, because the thing being
 * promised is that the *log* merges, however it travels.
 */

const paid = (rupiah: number): PaymentInput => ({ discount: { kind: 'none' }, tendered: rupiah });

/** A phone with its own log. It writes and reads with no network at all. */
function phone(deviceId: string): Ledger {
  return createLedger(new MemoryStore(), deviceId);
}

/** A phone that has a katalog and ten on the shelf, and answers the varian's id. */
async function seedSepuluh(ledger: Ledger): Promise<string> {
  const varianId = await ledger.append('varian.created', {
    produkId: 'prd-indomie',
    nama: 'Indomie goreng',
    kode: 'IDM',
    satuan: 'bungkus',
    jualBy: 'unit',
    harga: 3500,
  });
  await ledger.adjustStock({ varianId, counted: 10, reason: 'Hitung gudang' });
  return varianId;
}

/** One exchange, from where this phone last stopped. */
async function tukar(ledger: Ledger, shared: MemoryExchange, checkpoint: SyncCheckpoint) {
  const result = await syncLedger(ledger, shared, checkpoint);
  return result.checkpoint;
}

describe('dua ponsel bertukar catatan', () => {
  it('kedua ponsel yang menjual tanpa sinyal berakhir dengan stok dan total yang sama', async () => {
    const shared = new MemoryExchange();
    const ibu = phone('gawai-ibu');
    const anak = phone('gawai-anak');

    // Ibu mencatat katalog dan sepuluh di rak, lalu ponsel anak sempat
    // menyamakan diri sebelum keduanya berpisah.
    const varianId = await seedSepuluh(ibu);
    let checkpointIbu = await tukar(ibu, shared, STARTING_CHECKPOINT);
    let checkpointAnak = await tukar(anak, shared, STARTING_CHECKPOINT);
    expect(stockOf(await anak.events(), varianId).stock).toEqual({ kind: 'counted', qty: 10 });

    // Keduanya menjual di tempat berbeda, tanpa jaringan sama sekali.
    await ibu.recordSale([{ varianId, qty: 2 }], paid(7_000));
    await anak.recordSale([{ varianId, qty: 3 }], paid(10_500));

    // Sinyal datang: masing-masing menyampaikan apa yang tercatat.
    checkpointIbu = await tukar(ibu, shared, checkpointIbu);
    checkpointAnak = await tukar(anak, shared, checkpointAnak);
    // ... dan sekali lagi, karena yang pertama masih belum saling mendengar.
    checkpointIbu = await tukar(ibu, shared, checkpointIbu);
    checkpointAnak = await tukar(anak, shared, checkpointAnak);

    const shopIbu = await ibu.shop();
    const shopAnak = await anak.shop();

    // Dua penjualan di buku, di kedua ponsel, dan tidak satu pun tercatat dua kali.
    expect(shopIbu.sales).toHaveLength(2);
    expect(shopAnak.sales).toHaveLength(2);
    expect(shopIbu.sales.map((sale) => sale.id).sort()).toEqual(shopAnak.sales.map((sale) => sale.id).sort());
    expect(shopIbu.sales.reduce((sum, sale) => sum + sale.total, 0)).toBe(17_500);
    expect(shopAnak.sales.reduce((sum, sale) => sum + sale.total, 0)).toBe(17_500);

    // Sepuluh di rak, lima terjual: angka yang sama di kedua ponsel.
    expect(stockOf(await ibu.events(), varianId).stock).toEqual({ kind: 'counted', qty: 5 });
    expect(stockOf(await anak.events(), varianId).stock).toEqual({ kind: 'counted', qty: 5 });

    // Nomor nota tetap milik ponsel yang menulisnya: tidak bertabrakan.
    const nomor = shopIbu.sales.map((sale) => sale.number);
    expect(new Set(nomor).size).toBe(2);
    expect(shopAnak.sales.map((sale) => sale.number).sort()).toEqual(nomor.sort());
  });

  it('kumpulan catatan yang sama diterapkan dua kali tidak menambah apa pun', async () => {
    const ibu = phone('gawai-ibu');
    const anak = phone('gawai-anak');
    const varianId = await seedSepuluh(ibu);
    await ibu.recordSale([{ varianId, qty: 2 }], paid(7_000));

    // Seluruh log ibu sampai di ponsel anak sebagai satu kumpulan — dua kali,
    // seperti sambungan yang putus lalu diulang.
    const batch = (await ibu.events()) as StoredEvent[];
    const pertama = await anak.applyRemote(batch);
    const sesudahPertama = await anak.events();
    const penjualanPertama = (await anak.shop()).sales.reduce((sum, sale) => sum + sale.total, 0);

    const kedua = await anak.applyRemote(batch);
    const sesudahKedua = await anak.events();

    // Tidak satu pun catatan masuk dua kali, dan tidak ada angka yang bergeser.
    expect(pertama).toBe(batch.length);
    expect(kedua).toBe(0);
    expect(sesudahKedua.map((event) => event.id)).toEqual(sesudahPertama.map((event) => event.id));
    expect(stockOf(sesudahKedua, varianId).stock).toEqual({ kind: 'counted', qty: 8 });
    expect((await anak.shop()).sales.reduce((sum, sale) => sum + sale.total, 0)).toBe(penjualanPertama);
  });

  it('urutan kedatangan tidak mengubah stok, hutang, atau total yang terlihat', async () => {
    const a = phone('gawai-a');
    const b = phone('gawai-b');
    const varianId = await seedSepuluh(a);
    const pelangganId = await a.append('pelanggan.created', { nama: 'Bu Ani', telepon: null });
    // B baru tahu katalognya dari A, jadi ia bisa menjual barang yang sama.
    await b.applyRemote(await a.events());

    // A menjual empat dengan sebagian dibayar, lalu menghitung ulang raknya.
    await a.recordSale([{ varianId, qty: 4 }], {
      discount: { kind: 'none' },
      tendered: 5_000,
      pelangganId,
    });
    await a.adjustStock({ varianId, counted: 8, reason: 'Hitung rak' });
    // B menjual dua tunai di ponselnya sendiri.
    await b.recordSale([{ varianId, qty: 2 }], paid(7_000));

    // Dua ponsel ketiga menerima kumpulan yang sama, dengan urutan terbalik.
    const dariA = (await a.events()) as StoredEvent[];
    const dariB = (await b.events()) as StoredEvent[];
    const satu = phone('gawai-1');
    await satu.applyRemote(dariA);
    await satu.applyRemote(dariB);
    const dua = phone('gawai-2');
    await dua.applyRemote(dariB);
    await dua.applyRemote(dariA);

    const eventsSatu = await satu.events();
    const eventsDua = await dua.events();

    expect(stockOf(eventsSatu, varianId).stock).toEqual(stockOf(eventsDua, varianId).stock);
    expect(hutangOf(eventsSatu, pelangganId).state).toEqual(hutangOf(eventsDua, pelangganId).state);
    expect((await satu.shop()).sales.map((sale) => sale.number)).toEqual(
      (await dua.shop()).sales.map((sale) => sale.number),
    );
    // 10 di rak − 4 dan − 2 terjual, dengan satu koreksi +2.
    expect(stockOf(eventsSatu, varianId).stock).toEqual({ kind: 'counted', qty: 6 });
    // 14.000 dijual, 5.000 dibayar: sisa hutangnya 9.000.
    expect(hutangOf(eventsSatu, pelangganId).state).toEqual({ kind: 'hutang', jumlah: 9_000 });
  });

  it('pembatalan di satu ponsel sampai ke ponsel lain, dan keduanya setuju soal pendapatan', async () => {
    const shared = new MemoryExchange();
    const ibu = phone('gawai-ibu');
    const anak = phone('gawai-anak');
    const varianId = await seedSepuluh(ibu);

    // Kedua ponsel mulai dari rak yang sama.
    let checkpointIbu = await tukar(ibu, shared, STARTING_CHECKPOINT);
    let checkpointAnak = await tukar(anak, shared, STARTING_CHECKPOINT);

    // Ibu menjual dua, dan anak menerima penjualannya.
    const saleId = await ibu.recordSale([{ varianId, qty: 2 }], paid(7_000));
    checkpointIbu = await tukar(ibu, shared, checkpointIbu);
    checkpointAnak = await tukar(anak, shared, checkpointAnak);
    expect((await anak.shop()).sales).toHaveLength(1);

    // Ibu membatalkan penjualan itu; pembatalannya ikut menyeberang.
    await ibu.voidSale({ saleId, alasan: 'Salah input' });
    checkpointIbu = await tukar(ibu, shared, checkpointIbu);
    checkpointAnak = await tukar(anak, shared, checkpointAnak);

    const shopIbu = await ibu.shop();
    const shopAnak = await anak.shop();

    // Kedua ponsel melihat penjualan yang sama, ditandai dibatalkan.
    expect(shopIbu.sales.find((sale) => sale.id === saleId)?.voided).toBe(true);
    expect(shopAnak.sales.find((sale) => sale.id === saleId)?.voided).toBe(true);

    // Pendapatan dan stok yang sama: tidak ada yang dihitung dua kali.
    expect(sumSales(liveSales(shopIbu))).toBe(0);
    expect(sumSales(liveSales(shopAnak))).toBe(0);
    expect(stockOf(await ibu.events(), varianId).stock).toEqual({ kind: 'counted', qty: 10 });
    expect(stockOf(await anak.events(), varianId).stock).toEqual({ kind: 'counted', qty: 10 });
  });

  it('tipe catatan yang belum dikenal pun ikut tersalin, tanpa merge mengenalnya', async () => {
    const shared = new MemoryExchange();
    const ibu = phone('gawai-ibu');
    const anak = phone('gawai-anak');

    // Tiket berikutnya menambah tipe catatan; merge tidak boleh perlu diubah.
    const id = await ibu.append('sale.voided', { saleId: 'sale-1', alasan: 'Salah input' });
    await syncLedger(ibu, shared, STARTING_CHECKPOINT);
    const { report } = await syncLedger(anak, shared, STARTING_CHECKPOINT);

    expect(report.applied).toBe(1);
    expect((await anak.events()).map((event) => event.type)).toContain('sale.voided');
    expect((await anak.events()).map((event) => event.id)).toContain(id);
  });
});

describe('apa yang dihitung sebagai belum terkirim', () => {
  it('hanya catatan ponsel ini, bukan catatan yang baru diterima', async () => {
    const shared = new MemoryExchange();
    const ibu = phone('gawai-ibu');
    const anak = phone('gawai-anak');
    await seedSepuluh(ibu);

    await syncLedger(ibu, shared, STARTING_CHECKPOINT);
    await syncLedger(anak, shared, STARTING_CHECKPOINT);

    // Anak belum menulis apa pun sendiri: tidak ada yang perlu dikirim, walau
    // lognya sekarang berisi dua catatan milik ibu.
    expect(await anak.events()).toHaveLength(2);
    expect(unsentEvents(await anak.events(), 'gawai-anak', 0)).toEqual([]);
  });

  it('pemeriksaan yang tidak terbaca dimulai dari awal, bukan menyangka sudah beres', () => {
    expect(parseCheckpoint(null)).toEqual(STARTING_CHECKPOINT);
    expect(parseCheckpoint('bukan json')).toEqual(STARTING_CHECKPOINT);
    expect(parseCheckpoint('{"lastAckSeq":"tujuh","cursor":7}')).toEqual(STARTING_CHECKPOINT);
  });
});

describe('sinkron yang gagal', () => {  it('tidak menghilangkan catatan yang belum terkirim dan bisa diulang', async () => {
    const shared = new MemoryExchange();
    const ibu = phone('gawai-ibu');
    await seedSepuluh(ibu);
    const semua = (await ibu.events()) as StoredEvent[];
    expect(unsentEvents(semua, 'gawai-ibu', STARTING_CHECKPOINT.lastAckSeq)).toHaveLength(2);

    shared.offline = true;
    await expect(syncLedger(ibu, shared, STARTING_CHECKPOINT)).rejects.toThrow(/sambungan/i);

    // Tidak ada yang berubah: catatan tetap di ponsel, dan pemeriksaan belum
    // bergerak, jadi keduanya masih menunggu untuk dikirim.
    expect((await ibu.events()).map((event) => event.id)).toEqual(semua.map((event) => event.id));
    expect(unsentEvents(await ibu.events(), 'gawai-ibu', STARTING_CHECKPOINT.lastAckSeq)).toHaveLength(2);
    expect(shared.ids()).toEqual([]);
  });

  it('menyimpan catatan yang sudah terkirim walau jawaban tidak pernah datang', async () => {
    const shared = new MemoryExchange();
    const ibu = phone('gawai-ibu');
    await seedSepuluh(ibu);
    const semua = (await ibu.events()) as StoredEvent[];

    // Terkirim, lalu sambungan putus sebelum jawabannya sampai.
    shared.failPull = true;
    await expect(syncLedger(ibu, shared, STARTING_CHECKPOINT)).rejects.toThrow(/putus/i);

    // Catatannya sudah diterima tempat bersama dan masih utuh di ponsel;
    // mengulang hanya mengirim ulang hal yang sama, yang diabaikan di sana.
    expect(shared.ids()).toEqual(semua.map((event) => event.id));
    expect((await ibu.events()).map((event) => event.id)).toEqual(semua.map((event) => event.id));

    shared.failPull = false;
    const { checkpoint, report } = await syncLedger(ibu, shared, STARTING_CHECKPOINT);
    expect(report.pushed).toBe(semua.length);
    expect(report.applied).toBe(0);
    expect(shared.ids()).toEqual(semua.map((event) => event.id));
    expect(unsentEvents(await ibu.events(), 'gawai-ibu', checkpoint.lastAckSeq)).toHaveLength(0);
  });
});
