/**
 * Builds a synthetic KasirKu backup for trying the app on a phone.
 *
 * It is not hand-written JSON. Every event is appended through the real
 * `MemoryStore`, and every figure is computed by the real fold modules
 * (`foldEvents`, `stockOf`, `hutangOf`, `cashDrawer`, `supplierPayable`), so the
 * file the app reads is the same shape the app writes. Before anything is
 * written to disk the finished log is folded and asserted: if a figure is not
 * what the scenario promises, no file is produced.
 *
 * The ledger's own commands stamp `createdAt: new Date()`, which would put three
 * weeks of history in one afternoon, so events are appended through the store
 * seam with backdated timestamps. Sale numbers are computed from that same
 * timestamp, so the number on a nota and the day it belongs to agree.
 *
 * Run it with:
 *   npx jest --runTestsByPath scripts/synthetic/generate.gen.ts --testMatch "**/*.gen.ts"
 *
 * The `.gen.ts` suffix keeps it out of `npm test`: it writes files, so it is a
 * tool you run on purpose, not a suite that runs on every save. That is also
 * why the command has to widen `testMatch` — jest-expo's default only picks up
 * `*.test.ts`, so the path alone finds nothing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatRupiah, settleCash, type Discount } from '@/design/money';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from '@/ledger/backup';
import { foldEvents, sumSales } from '@/ledger/events';
import { hutangOf } from '@/ledger/hutang';
import { cashDrawer, countPayload } from '@/ledger/kas';
import { MemoryStore } from '@/ledger/memoryStore';
import { roundLine } from '@/ledger/register';
import { dayStamp, saleNumber } from '@/ledger/saleNumber';
import { stockOf } from '@/ledger/stock';
import { supplierPayable } from '@/ledger/suppliers';
import type { StoredEvent } from '@/ledger/store';
import type { JualBy, LedgerEvent, Satuan } from '@/ledger/types';

const DEVICE = 'gawai-ibu';
const DAY = 24 * 60 * 60 * 1000;
const OUT_DIR = join(process.cwd(), '.scratch', 'synthetic');

// ---------------------------------------------------------------------------
// The shop
// ---------------------------------------------------------------------------

interface VarianSpec {
  key: string;
  kategori: string;
  produk: string;
  nama: string;
  kode: string | null;
  satuan: Satuan;
  jualBy: JualBy;
  harga: number;
  minimum: number | null;
  opening: number;
}

const VARIAN: readonly VarianSpec[] = [
  // Sembako
  { key: 'beras', kategori: 'Sembako', produk: 'Beras Premium', nama: 'Beras Premium 1 kg', kode: 'BRS-01', satuan: 'kg', jualBy: 'weight', harga: 13_000, minimum: 10, opening: 25 },
  { key: 'tepungKg', kategori: 'Sembako', produk: 'Tepung Terigu', nama: 'Tepung Terigu 1 kg', kode: 'TPG-01', satuan: 'kg', jualBy: 'weight', harga: 12_000, minimum: 5, opening: 8 },
  { key: 'tepungSak', kategori: 'Sembako', produk: 'Tepung Terigu', nama: 'Tepung Terigu 1 sak', kode: 'TPG-SK', satuan: 'sak', jualBy: 'unit', harga: 275_000, minimum: 1, opening: 2 },
  { key: 'gulaKg', kategori: 'Sembako', produk: 'Gula Pasir', nama: 'Gula Pasir 1 kg', kode: 'GLA-01', satuan: 'kg', jualBy: 'weight', harga: 15_000, minimum: 5, opening: 12 },
  { key: 'gulaSak', kategori: 'Sembako', produk: 'Gula Pasir', nama: 'Gula Pasir 1 sak', kode: 'GLA-SK', satuan: 'sak', jualBy: 'unit', harga: 340_000, minimum: 1, opening: 0 },
  { key: 'minyak', kategori: 'Sembako', produk: 'Minyak Goreng', nama: 'Minyak Goreng 1 liter', kode: 'MNK-01', satuan: 'liter', jualBy: 'unit', harga: 18_000, minimum: 6, opening: 10 },
  { key: 'telurKg', kategori: 'Sembako', produk: 'Telur Ayam', nama: 'Telur Ayam 1 kg', kode: 'TLR-01', satuan: 'kg', jualBy: 'weight', harga: 28_000, minimum: 3, opening: 5 },
  { key: 'telurButir', kategori: 'Sembako', produk: 'Telur Ayam', nama: 'Telur Ayam 1 butir', kode: 'TLR-BT', satuan: 'pcs', jualBy: 'unit', harga: 3_000, minimum: 10, opening: 20 },
  // Minuman
  { key: 'aqua', kategori: 'Minuman', produk: 'Aqua', nama: 'Aqua Botol 600 ml', kode: 'AQA-01', satuan: 'pcs', jualBy: 'unit', harga: 4_000, minimum: 12, opening: 24 },
  { key: 'teh', kategori: 'Minuman', produk: 'Teh Botol', nama: 'Teh Botol Sosro', kode: 'TEH-01', satuan: 'pcs', jualBy: 'unit', harga: 5_000, minimum: 6, opening: 6 },
  { key: 'kopi', kategori: 'Minuman', produk: 'Kopi Sachet', nama: 'Kopi Kapal Api', kode: 'KPI-01', satuan: 'pcs', jualBy: 'unit', harga: 2_000, minimum: 20, opening: 40 },
  // Rokok
  { key: 'gg', kategori: 'Rokok', produk: 'Gudang Garam', nama: 'Gudang Garam Filter', kode: 'GGF-01', satuan: 'bungkus', jualBy: 'unit', harga: 25_000, minimum: 5, opening: 10 },
  // Bumbu Dapur
  { key: 'bawang', kategori: 'Bumbu Dapur', produk: 'Bawang Merah', nama: 'Bawang Merah 1 kg', kode: 'BWM-01', satuan: 'kg', jualBy: 'weight', harga: 35_000, minimum: 2, opening: 3 },
  { key: 'cabai', kategori: 'Bumbu Dapur', produk: 'Cabai Merah', nama: 'Cabai Merah 1 kg', kode: 'CBM-01', satuan: 'kg', jualBy: 'weight', harga: 45_000, minimum: 1, opening: 1.5 },
];

const KATEGORI = ['Sembako', 'Minuman', 'Rokok', 'Bumbu Dapur'] as const;

const SUPPLIER = [
  { key: 'sm', nama: 'CV Sumber Makmur', telepon: '0812-3456-7890' },
  { key: 'gj', nama: 'Toko Grosir Jaya', telepon: '0857-1122-3344' },
] as const;

const PELANGGAN = [
  { key: 'ani', nama: 'Bu Ani', telepon: '0813-2222-1111' },
  { key: 'budi', nama: 'Pak Budi', telepon: '0821-3333-4444' },
  { key: 'sari', nama: 'Mbak Sari', telepon: null },
] as const;

/**
 * The four variants whose end state the scenario promises, so the low-stock
 * screen shows both answers at once: Tepung has sacks left (repack), Gula has
 * none (reorder).
 */
const SCRIPTED: Record<number, readonly { key: string; qty: number }[]> = {
  [-17]: [{ key: 'tepungKg', qty: 1 }],
  [-16]: [{ key: 'gulaKg', qty: 3 }],
  [-13]: [{ key: 'tepungKg', qty: 1 }],
  [-11]: [{ key: 'gulaKg', qty: 2 }],
  [-9]: [{ key: 'tepungKg', qty: 1 }],
  [-7]: [{ key: 'gulaKg', qty: 2 }],
  [-5]: [{ key: 'tepungKg', qty: 1 }],
  [-3]: [{ key: 'gulaKg', qty: 2 }],
  [-2]: [{ key: 'tepungKg', qty: 0.5 }],
};

/** Everything the random filler may sell. The scripted four are excluded. */
const POOL = ['beras', 'minyak', 'telurKg', 'telurButir', 'aqua', 'teh', 'kopi', 'gg', 'bawang', 'cabai'] as const;

/**
 * The sales the scenario depends on. Their quantities are reserved up front so
 * the random filler can never spend the stock the story needs.
 */
const STORY: readonly { key: string; qty: number }[] = [
  { key: 'beras', qty: 5 },
  { key: 'gulaKg', qty: 2 },
  { key: 'minyak', qty: 4 },
  { key: 'telurKg', qty: 2 },
  { key: 'gg', qty: 2 },
  { key: 'aqua', qty: 3 },
  { key: 'aqua', qty: 2 },
  { key: 'kopi', qty: 3 },
  { key: 'aqua', qty: 2 },
  { key: 'kopi', qty: 2 },
];

// ---------------------------------------------------------------------------
// Deterministic randomness, so a re-run tells the same story
// ---------------------------------------------------------------------------

let seed = 20_261_118;
function rnd(): number {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rnd() * items.length)];
}
function int(min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

// ---------------------------------------------------------------------------

it('writes a synthetic backup the app can restore', async () => {
  const store = new MemoryStore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const at = (offset: number, hour: number, minute = 0): Date => {
    const moment = new Date(today.getTime() + offset * DAY);
    moment.setHours(hour, minute, 0, 0);
    return moment;
  };

  async function write(type: string, payload: unknown, when: Date): Promise<StoredEvent> {
    const { id, seq } = await store.nextIdentity();
    const event = {
      id,
      seq,
      deviceId: DEVICE,
      createdAt: when.toISOString(),
      type,
      payload,
    } as StoredEvent;
    await store.append([event]);
    return event;
  }

  // --- Day one: the shop exists -------------------------------------------

  await write(
    'settings.updated',
    {
      receipt: {
        header: { nama: 'Warung Bu Sri', keterangan: 'Jl. Melati 12, RT 03 / RW 05\nTelp 0812-3456-7890' },
        footer: 'Terima kasih sudah berbelanja. Barang yang sudah dibeli tidak dapat ditukar.',
      },
    },
    at(-20, 6, 0),
  );

  await write('cash.opening_float', { jumlah: 200_000 }, at(-20, 6, 30));

  const kategoriId = new Map<string, string>();
  for (const nama of KATEGORI) {
    const event = await write('kategori.created', { nama, parentId: null }, at(-20, 6, 40));
    kategoriId.set(nama, event.id);
  }

  const produkId = new Map<string, string>();
  for (const spec of VARIAN) {
    if (produkId.has(spec.produk)) continue;
    const event = await write(
      'produk.created',
      { kategoriId: kategoriId.get(spec.kategori)!, nama: spec.produk },
      at(-20, 6, 45),
    );
    produkId.set(spec.produk, event.id);
  }

  const varianId = new Map<string, string>();
  for (const spec of VARIAN) {
    const event = await write(
      'varian.created',
      {
        produkId: produkId.get(spec.produk)!,
        nama: spec.nama,
        kode: spec.kode,
        satuan: spec.satuan,
        jualBy: spec.jualBy,
        harga: spec.harga,
      },
      at(-20, 6, 50),
    );
    varianId.set(spec.key, event.id);
  }

  // The minimum is its own stamped field, exactly as the Stok form writes it.
  for (const spec of VARIAN) {
    if (spec.minimum === null) continue;
    await write(
      'varian.updated',
      { varianId: varianId.get(spec.key)!, minimum: { value: spec.minimum, at: at(-20, 6, 51).toISOString() } },
      at(-20, 6, 51),
    );
  }

  const sisa = new Map<string, number>();
  const reserved = new Map<string, number>();
  for (const line of STORY) reserved.set(line.key, (reserved.get(line.key) ?? 0) + line.qty);
  // Two butir leave the shelf by a correction, not a sale, so the filler has to
  // leave room for them as well.
  const BROKEN_EGGS = 2;
  reserved.set('telurButir', (reserved.get('telurButir') ?? 0) + BROKEN_EGGS);
  for (const spec of VARIAN) {
    await write('stock.opening', { varianId: varianId.get(spec.key)!, qty: spec.opening }, at(-20, 7, 0));
    sisa.set(spec.key, spec.opening);
  }

  const supplierId = new Map<string, string>();
  for (const entry of SUPPLIER) {
    const event = await write('supplier.created', { nama: entry.nama, telepon: entry.telepon }, at(-20, 7, 10));
    supplierId.set(entry.key, event.id);
  }

  const pelangganId = new Map<string, string>();
  for (const entry of PELANGGAN) {
    const event = await write('pelanggan.created', { nama: entry.nama, telepon: entry.telepon }, at(-20, 7, 15));
    pelangganId.set(entry.key, event.id);
  }

  // --- Deliveries ----------------------------------------------------------

  async function delivery(
    when: Date,
    supplierKey: string,
    notaId: string,
    lines: readonly { key: string; qty: number; settlement: 'tunai' | 'tempo' | 'titip'; hargaBeli: number }[],
  ): Promise<void> {
    for (const line of lines) {
      await write(
        'stock.received',
        {
          varianId: varianId.get(line.key)!,
          qty: line.qty,
          settlement: line.settlement,
          supplierId: supplierId.get(supplierKey)!,
          notaId,
          hargaBeli: line.hargaBeli,
        },
        when,
      );
      sisa.set(line.key, (sisa.get(line.key) ?? 0) + line.qty);
    }
  }

  // --- Sales ---------------------------------------------------------------

  async function sale(
    when: Date,
    lines: readonly { key: string; qty: number }[],
    options: { discount?: Discount; unpaid?: number; pelanggan?: string; tendered?: number; story?: boolean } = {},
  ): Promise<StoredEvent> {
    const shop = foldEvents(await store.readAll());
    const written = lines.map((line) => {
      const varian = shop.varian.find((entry) => entry.id === varianId.get(line.key))!;
      return {
        varianId: varian.id,
        nama: varian.nama,
        satuan: varian.satuan,
        qty: line.qty,
        harga: varian.harga,
        jumlah: roundLine(varian.harga, line.qty),
      };
    });
    const total = written.reduce((sum, line) => sum + line.jumlah, 0);
    const discount = options.discount ?? { kind: 'none' };
    const net = settleCash({ gross: total, discount, tendered: 0 }).net;

    let tendered: number;
    if (options.unpaid !== undefined) {
      tendered = net - options.unpaid;
    } else if (options.tendered !== undefined) {
      tendered = options.tendered;
    } else {
      // A round note handed over, with change coming back.
      tendered = Math.ceil((net + 2_000) / 5_000) * 5_000;
    }

    const payment = settleCash({ gross: total, discount, tendered });
    const { id, seq } = await store.nextIdentity();
    const iso = when.toISOString();
    const pelanggan = options.pelanggan ? PELANGGAN.find((entry) => entry.key === options.pelanggan) : undefined;

    const event = {
      id,
      seq,
      deviceId: DEVICE,
      createdAt: iso,
      type: 'sale.completed',
      payload: {
        number: saleNumber(iso, DEVICE, seq),
        lines: written,
        total,
        payment,
        ...(pelanggan
          ? { pelangganId: pelangganId.get(pelanggan.key)!, pelangganNama: pelanggan.nama }
          : {}),
      },
    } as StoredEvent;

    await store.append([event]);
    for (const line of lines) {
      sisa.set(line.key, (sisa.get(line.key) ?? 0) - line.qty);
      if (options.story) reserved.set(line.key, (reserved.get(line.key) ?? 0) - line.qty);
    }
    return event;
  }

  function qtyFor(key: string): number {
    const spec = VARIAN.find((entry) => entry.key === key)!;
    if (spec.jualBy === 'weight') return pick([0.25, 0.5, 0.5, 0.75, 1, 1.5]);
    return int(1, 2);
  }

  let voidedSale: StoredEvent | null = null;

  // One chronological pass. Deliveries land on their day, so stock is only
  // available from then on; the story beats sit on the days they belong to;
  // the random filler spends whatever is left. That keeps the running tally
  // the generator keeps identical to the one the fold will compute.
  for (let offset = -19; offset <= 0; offset += 1) {
    if (offset === -18) {
      // One visit that mixes all three settlement models, as a real one does.
      await delivery(at(offset, 9, 0), 'sm', 'nota-sm-01', [
        { key: 'beras', qty: 20, settlement: 'tunai', hargaBeli: 11_000 },
        { key: 'minyak', qty: 12, settlement: 'tempo', hargaBeli: 15_000 },
        { key: 'teh', qty: 24, settlement: 'titip', hargaBeli: 3_500 },
      ]);
    }
    if (offset === -14) {
      await delivery(at(offset, 9, 0), 'gj', 'nota-gj-01', [
        { key: 'kopi', qty: 60, settlement: 'tempo', hargaBeli: 1_500 },
      ]);
    }
    // A warung restocks, or the last week would be an empty shelf.
    if (offset === -10) {
      await delivery(at(offset, 9, 0), 'sm', 'nota-sm-02', [
        { key: 'beras', qty: 20, settlement: 'tunai', hargaBeli: 11_000 },
        { key: 'minyak', qty: 12, settlement: 'tempo', hargaBeli: 15_000 },
        { key: 'aqua', qty: 24, settlement: 'tempo', hargaBeli: 2_800 },
      ]);
    }
    if (offset === -4) {
      await delivery(at(offset, 9, 0), 'gj', 'nota-gj-02', [
        { key: 'kopi', qty: 60, settlement: 'tempo', hargaBeli: 1_500 },
        { key: 'gg', qty: 20, settlement: 'tempo', hargaBeli: 22_000 },
      ]);
    }

    let slot = 0;
    const nextAt = () => at(offset, 8, slot++ * 40);

    for (const line of SCRIPTED[offset] ?? []) {
      await sale(nextAt(), [line]);
    }

    if (offset === -16) {
      await sale(at(offset, 11, 0), [{ key: 'beras', qty: 5 }, { key: 'gulaKg', qty: 2 }], {
        unpaid: 25_000,
        pelanggan: 'ani',
        story: true,
      });
    }
    if (offset === -11) {
      await sale(at(offset, 15, 0), [{ key: 'minyak', qty: 4 }, { key: 'telurKg', qty: 2 }], {
        unpaid: 40_000,
        pelanggan: 'budi',
        story: true,
      });
    }
    if (offset === -8) {
      await sale(at(offset, 13, 0), [{ key: 'gg', qty: 2 }, { key: 'aqua', qty: 3 }], {
        unpaid: 20_000,
        pelanggan: 'sari',
        story: true,
      });
    }
    if (offset === -3) {
      voidedSale = await sale(at(offset, 14, 0), [{ key: 'aqua', qty: 2 }, { key: 'kopi', qty: 3 }], {
        story: true,
      });
    }
    if (offset === -2) {
      await write(
        'sale.voided',
        { saleId: voidedSale!.id, alasan: 'Salah input: pelanggan minta 2 kopi, bukan 3.' },
        at(offset, 9, 0),
      );
      await sale(at(offset, 9, 10), [{ key: 'aqua', qty: 2 }, { key: 'kopi', qty: 2 }], { story: true });
      // Overpaid on purpose: the extra becomes a credit, never a negative hutang.
      await write('receivable.paid', { pelangganId: pelangganId.get('sari')!, jumlah: 25_000 }, at(offset, 10, 0));
    }
    if (offset === -5) {
      await write('receivable.paid', { pelangganId: pelangganId.get('ani')!, jumlah: 10_000 }, at(offset, 10, 0));
    }
    if (offset === -1) {
      await write(
        'receivable.written_off',
        {
          pelangganId: pelangganId.get('budi')!,
          jumlah: 40_000,
          alasan: 'Pelanggan pindah kampung, tidak bisa ditagih.',
        },
        at(offset, 18, 0),
      );
    }
    if (offset === -6) {
      await write(
        'stock.adjusted',
        {
          varianId: varianId.get('telurButir')!,
          delta: -BROKEN_EGGS,
          reason: 'Dua butir pecah saat barang diturunkan.',
        },
        at(offset, 8, 30),
      );
      sisa.set('telurButir', (sisa.get('telurButir') ?? 0) - BROKEN_EGGS);
      reserved.set('telurButir', (reserved.get('telurButir') ?? 0) - BROKEN_EGGS);
      await write('payable.paid', { supplierId: supplierId.get('sm')!, amount: 100_000 }, at(offset, 15, 0));
    }
    if (offset === -15) await write('cash.expense', { jumlah: 85_000, keterangan: 'Bayar listrik' }, at(offset, 16, 0));
    if (offset === -10) await write('cash.expense', { jumlah: 25_000, keterangan: 'Transport kulakan' }, at(offset, 11, 0));
    if (offset === -7) await write('cash.withdrawn', { jumlah: 300_000, keterangan: 'Setor ke bank' }, at(offset, 17, 0));
    if (offset === -4) await write('cash.deposited', { jumlah: 50_000, keterangan: 'Tambah modal dari Bu Sri' }, at(offset, 8, 0));

    // The rest of the day's trade, spending only what the story has not reserved.
    const free = (key: string) => (sisa.get(key) ?? 0) - (reserved.get(key) ?? 0);
    const count = int(4, 7);
    for (let index = 0; index < count; index += 1) {
      const key = pick(POOL);
      const qty = qtyFor(key);
      if (free(key) < qty) continue;
      const lines = [{ key, qty }];
      // Occasionally a second item rides along, as it does at a warung.
      if (rnd() < 0.35) {
        const extra = pick(POOL);
        const extraQty = qtyFor(extra);
        if (extra !== key && free(extra) >= extraQty) lines.push({ key: extra, qty: extraQty });
      }
      const discount: Discount = rnd() < 0.08 ? { kind: 'rupiah', value: 1_000 } : { kind: 'none' };
      await sale(nextAt(), lines, { discount });
    }

    // A count comes last in the day, after the trade it is counting.
    if (offset === -9) {
      const events = (await store.readAll()) as LedgerEvent[];
      const payload = countPayload(events, {
        counted: cashDrawer(events).expected,
        catatan: 'Hitung malam, uang pas.',
      });
      await write(payload.type, payload.payload, at(offset, 20, 0));
    }
    if (offset === 0) {
      const events = (await store.readAll()) as LedgerEvent[];
      const payload = countPayload(events, {
        counted: cashDrawer(events).expected - 5_000,
        catatan: 'Selisih lima ribu, kemungkinan kembalian belum dicatat.',
      });
      await write(payload.type, payload.payload, at(offset, 20, 0));
    }
  }

  // -------------------------------------------------------------------------
  // Fold it, and refuse to write a file that does not say what it should
  // -------------------------------------------------------------------------

  const events = (await store.readAll()) as LedgerEvent[];
  const shop = foldEvents(events);

  const stockOfKey = (key: string) => stockOf(events, varianId.get(key)!).stock;
  const counted = (key: string): number => {
    const stock = stockOfKey(key);
    if (stock.kind !== 'counted') throw new Error(`${key} belum pernah dihitung.`);
    return stock.qty;
  };

  const problems: string[] = [];
  const expect = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };

  expect(shop.kategori.length === 4, `kategori: ${shop.kategori.length}, harusnya 4`);
  expect(shop.produk.length === 11, `produk: ${shop.produk.length}, harusnya 11`);
  expect(shop.varian.length === 14, `varian: ${shop.varian.length}, harusnya 14`);
  expect(shop.sales.length >= 80, `penjualan: ${shop.sales.length}, harusnya >= 80`);
  expect(shop.sales.filter((entry) => entry.voided).length === 1, 'harus ada tepat satu penjualan dibatalkan');

  expect(counted('tepungKg') < 5, `Tepung kg ${counted('tepungKg')}, harusnya di bawah minimum 5`);
  expect(counted('gulaKg') < 5, `Gula kg ${counted('gulaKg')}, harusnya di bawah minimum 5`);
  expect(counted('tepungSak') === 2, `Tepung sak ${counted('tepungSak')}, harusnya 2 (repack)`);
  expect(counted('gulaSak') === 0, `Gula sak ${counted('gulaSak')}, harusnya 0 (reorder)`);

  for (const spec of VARIAN) {
    const qty = counted(spec.key);
    expect(qty >= 0, `${spec.nama} stoknya minus: ${qty}`);
  }

  const ani = hutangOf(events, pelangganId.get('ani')!);
  expect(ani.state.kind === 'hutang', `Bu Ani harusnya masih punya hutang, hasilnya ${ani.state.kind}`);
  const budi = hutangOf(events, pelangganId.get('budi')!);
  expect(budi.state.kind === 'lunas', `Pak Budi harusnya lunas setelah hapus buku, hasilnya ${budi.state.kind}`);
  const sari = hutangOf(events, pelangganId.get('sari')!);
  expect(sari.state.kind === 'kredit', `Mbak Sari harusnya kredit, hasilnya ${sari.state.kind}`);

  const drawer = cashDrawer(events);
  expect(drawer.expected > 0, `kas seharusnya positif, hasilnya ${drawer.expected}`);
  expect(drawer.baseline?.kind === 'count', `patokan kas harusnya hitung terakhir, hasilnya ${drawer.baseline?.kind}`);

  const sm = supplierPayable(events, supplierId.get('sm')!);
  expect(sm.total > 0, `CV Sumber Makmur harusnya masih diutang, hasilnya ${sm.total}`);
  expect(sm.titip > 0, 'titip yang terjual harusnya membuat utang ke pemasok');
  const gj = supplierPayable(events, supplierId.get('gj')!);
  expect(gj.total > 0, `Toko Grosir Jaya harusnya masih diutang, hasilnya ${gj.total}`);

  const sellingDays = new Set(shop.sales.filter((entry) => !entry.voided).map((entry) => dayStamp(entry.createdAt)));
  expect(sellingDays.size >= 7, `hari berjualan: ${sellingDays.size}, harusnya >= 7`);

  if (problems.length > 0) {
    throw new Error(`Data sintetis tidak sesuai skenario:\n- ${problems.join('\n- ')}`);
  }

  // -------------------------------------------------------------------------
  // Write the backup and the checklist
  // -------------------------------------------------------------------------

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    deviceId: DEVICE,
    lastSeq: await store.lastSeq(),
    events: await store.readAll(),
  };

  const text = serializeBackup(backup);
  // The app will run this exact function on the file; prove it accepts it.
  const reread = parseBackup(text);
  expect(reread.events.length === backup.events.length, 'berkas tidak terbaca ulang dengan utuh');

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = dayStamp(new Date().toISOString());
  const fileName = `kasirku-synthetic-${stamp}.json`;
  writeFileSync(join(OUT_DIR, fileName), text, 'utf8');

  const revenue = sumSales(shop.sales);
  const todayStamp = dayStamp(new Date().toISOString());
  const todaySales = shop.sales.filter((entry) => !entry.voided && dayStamp(entry.createdAt) === todayStamp);
  const todayTotal = todaySales.reduce((sum, entry) => sum + entry.total, 0);

  const stockLines = VARIAN.map((spec) => {
    const qty = counted(spec.key);
    const low = spec.minimum !== null && qty < spec.minimum;
    return `| ${spec.nama} | ${spec.satuan} | ${qty} | ${spec.minimum ?? '—'} | ${low ? '**rendah**' : 'aman'} |`;
  }).join('\n');

  const hutangLines = PELANGGAN.map((entry) => {
    const state = hutangOf(events, pelangganId.get(entry.key)!).state;
    const label =
      state.kind === 'hutang'
        ? `Hutang ${formatRupiah(state.jumlah)}`
        : state.kind === 'kredit'
          ? `Kredit ${formatRupiah(state.jumlah)}`
          : 'Lunas';
    return `| ${entry.nama} | ${label} |`;
  }).join('\n');

  const supplierLines = SUPPLIER.map((entry) => {
    const payable = supplierPayable(events, supplierId.get(entry.key)!);
    return `| ${entry.nama} | ${formatRupiah(payable.tempo)} | ${formatRupiah(payable.titip)} | ${formatRupiah(payable.paid)} | **${formatRupiah(payable.total)}** |`;
  }).join('\n');

  const checklist = `# KasirKu — data sintetis

Berkas: \`${fileName}\`
Dibuat: ${new Date().toLocaleString('id-ID')}
Perangkat: \`${DEVICE}\` (nomor nota memakai awalan \`GAWA\`)

## Cara memasukkan

1. Pindahkan \`${fileName}\` ke ponsel (unduh lewat browser, atau salin lewat USB ke folder Download).
2. Buka aplikasi → **Lainnya → Pengaturan → Cadangan → Pulihkan**.
3. Pilih berkasnya. Jika ponsel sudah punya riwayat, akan muncul peringatan — pilih **Ganti riwayat**.

> Pemulihan **mengganti** seluruh riwayat di ponsel. Ekspor dulu kalau ada data yang mau disimpan.

## Angka yang harus cocok

| Hal | Nilai |
|---|---|
| Total penjualan (tanpa yang dibatalkan) | ${formatRupiah(revenue)} |
| Penjualan hari ini | ${formatRupiah(todayTotal)} (${todaySales.length} nota) |
| Jumlah nota tersimpan | ${shop.sales.length} (1 dibatalkan) |
| Hari berjualan | ${sellingDays.size} |
| Kas yang seharusnya ada | ${formatRupiah(drawer.expected)} |
| Patokan kas | ${drawer.baseline?.kind === 'count' ? 'hitung terakhir' : 'kas awal'} ${formatRupiah(drawer.baseline?.jumlah ?? 0)} |

## Stok akhir

| Varian | Satuan | Stok | Minimum | Status |
|---|---|---|---|---|
${stockLines}

## Hutang pelanggan

| Pelanggan | Keadaan |
|---|---|
${hutangLines}

## Utang ke pemasok

| Pemasok | Tempo | Titip terjual | Dibayar | Sisa |
|---|---|---|---|---|
${supplierLines}

## Yang perlu dicek di layar

- [ ] **Kasir** — grid hanya menampilkan varian yang bisa dijual; satu nota bisa dibuat dan nomornya berawalan \`GAWA\`.
- [ ] **Stok** — Tepung menampilkan **Repack** (sak masih ada), Gula menampilkan **Reorder** (sak habis), dan setiap baris rendah menyebut aturannya.
- [ ] **Riwayat** — nota yang dibatalkan masih ada, bertanda *Dibatalkan* beserta alasannya; nota penggantinya dihitung sekali.
- [ ] **Pelanggan** — Bu Ani masih punya sisa, Pak Budi lunas lewat hapus buku, Mbak Sari menampilkan **Kredit**.
- [ ] **Pemasok** — total utang beserta rinciannya (Tempo / Titip terjual / Dibayar), dan stok titip terpisah dari stok milik.
- [ ] **Kas** — kas yang seharusnya ada beserta patokannya, dan dua riwayat hitung (satu pas, satu selisih kurang).
- [ ] **Laporan** — ${sellingDays.size} hari riwayat, jadi sudah melewati ambang dan berani menyebut barang terlaris; peringkat satuan memisahkan kg dari bungkus.
`;

  writeFileSync(join(OUT_DIR, 'CHECKLIST.md'), checklist, 'utf8');

  // A tap-to-download page, because a phone's browser renders a .json instead
  // of saving it. `download` makes Chrome write the file to Downloads, which is
  // where the app's document picker can see it.
  writeFileSync(
    join(OUT_DIR, 'index.html'),
    `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KasirKu — data sintetis</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; font: 16px/1.5 system-ui, sans-serif; background: #F7F3EA; color: #2F2A24; }
  main { max-width: 34rem; margin: 0 auto; }
  h1 { font-size: 1.4rem; color: #1F3A6E; margin: 0 0 .25rem; }
  p.lead { color: #8A7F6D; margin: 0 0 1.5rem; }
  a.download { display: block; padding: 1rem; border-radius: 4px; background: #1F3A6E; color: #FDFBF6;
               text-decoration: none; font-weight: 600; text-align: center; }
  ol { padding-left: 1.25rem; }
  li { margin: .5rem 0; }
  .note { margin-top: 1.5rem; padding: .75rem 1rem; border-left: 3px solid #A8231F; background: #FDFBF6; font-size: .9rem; }
  code { background: #E7EAE3; padding: .1rem .3rem; border-radius: 3px; }
</style>
</head>
<body>
<main>
  <h1>KasirKu — data sintetis</h1>
  <p class="lead">21 hari riwayat Warung Bu Sri, ${backup.events.length} peristiwa.</p>

  <a class="download" href="${fileName}" download>Unduh ${fileName}</a>

  <ol>
    <li>Ketuk tautan di atas. Berkasnya masuk ke folder <code>Download</code>.</li>
    <li>Buka KasirKu &rarr; <strong>Lainnya &rarr; Pengaturan &rarr; Cadangan &rarr; Pulihkan</strong>.</li>
    <li>Pilih berkas tadi. Kalau muncul peringatan, pilih <strong>Ganti riwayat</strong>.</li>
  </ol>

  <div class="note">Pemulihan <strong>mengganti</strong> seluruh riwayat di ponsel. Ekspor dulu kalau ada data yang mau disimpan.</div>
</main>
</body>
</html>
`,
    'utf8',
  );

  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      `Berkas : ${join(OUT_DIR, fileName)}`,
      `Peristiwa: ${backup.events.length}`,
      `Penjualan: ${shop.sales.length} (1 dibatalkan)`,
      `Omzet    : ${formatRupiah(revenue)}`,
      `Hari ini : ${formatRupiah(todayTotal)} (${todaySales.length} nota)`,
      `Kas      : ${formatRupiah(drawer.expected)}`,
      `Hutang   : Bu Ani ${ani.state.kind === 'hutang' ? formatRupiah(ani.state.jumlah) : ani.state.kind}`,
      `Pemasok  : CV Sumber Makmur ${formatRupiah(sm.total)} · Toko Grosir Jaya ${formatRupiah(gj.total)}`,
      '',
    ].join('\n'),
  );
}, 120_000);
