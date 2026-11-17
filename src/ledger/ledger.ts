import type { Discount } from '@/design';
import { settleCash } from '@/design';
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupFile } from './backup';
import { newDeviceId } from './deviceId';
import { foldEvents } from './events';
import { ImportError, type ImportCommit, type ImportPlan } from './import';
import { createDbLedger, type SqlDatabase } from './dbLedger';
import { roundLine } from './register';
import { saleNumber } from './saleNumber';
import { correctionDelta, stockOf } from './stock';
import type { LedgerStore, StoredEvent } from './store';
import type { LedgerEvent, PaymentInput, Shop } from './types';


/**
 * The real ledger: expo-sqlite on the phone, whatever `SqlDatabase` is passed
 * in tests.
 */
export interface Ledger {
  /** The phone that writes new events. Changes when a backup is restored. */
  readonly deviceId: string;
  shop(): Promise<Shop>;
  /** The raw log, oldest first. Stock, and anything else per-event, folds this. */
  events(): Promise<LedgerEvent[]>;
  /** Records one sale, with what was paid, as one event. Returns the sale's id. */
  recordSale(lines: SaleLineInput[], payment: PaymentInput): Promise<string>;
  /**
   * Brings the app back to the shelf: the owner types what they counted, with
   * a reason, and one `stock.adjusted` records the delta from what the app
   * believed — never the absolute number. Returns the event's id.
   */
  adjustStock(input: StockCorrection): Promise<string>;
  /**
   * The count entered during setup, written as its own `stock.opening` event
   * so it is auditable like any other movement. Only a varian nobody has
   * counted yet can take one: a second opening would silently add stock.
   * Returns the event's id.
   */
  recordOpeningStock(input: OpeningStock): Promise<string>;
  /**
   * Writes a previewed import as one batch: every kategori, produk, varian and
   * opening count, or none of them. A plan with row errors is refused before
   * anything is written, so a half-imported catalog cannot exist.
   */
  importCatalog(plan: ImportPlan): Promise<ImportCommit>;
  /** The whole log as a file, ready to be saved off the phone. */
  backup(): Promise<BackupFile>;
  /**
   * Replaces this phone's log with a backup's, and adopts its device identity
   * so unsent events can continue the original stream. The caller is
   * responsible for the owner's consent; this is a rewrite, not a merge.
   */
  restore(backup: BackupFile): Promise<void>;
  /** Escape hatch for tests and the next tickets; appends raw event types. */
  append(type: string, payload: unknown): Promise<string>;
}

/** What the correction form hands the ledger: the counted number and why. */
export interface StockCorrection {
  varianId: string;
  /** What is actually on the shelf, as the owner counted it. */
  counted: number;
  /** The owner's own words. Required: a correction with no reason is a silent guess. */
  reason: string;
}

/** What the setup pass hands the ledger: the opening count for one varian. */
export interface OpeningStock {
  varianId: string;
  /** What is on the shelf on day one. Zero is a real count, not "unknown". */
  qty: number;
}

/** A quantity the log can carry: a finite number, not negative, in quarters of a unit. */
function checkCounted(counted: number): void {
  if (!Number.isFinite(counted) || counted < 0) {
    throw new StockError('Jumlah stok harus angka 0 atau lebih.');
  }
  if (Math.abs(counted * 4 - Math.round(counted * 4)) > 1e-9) {
    throw new StockError('Jumlah stok harus kelipatan 1/4.');
  }
}

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

export interface SaleLineInput {
  varianId: string;
  qty: number;
  /** The price the cashier saw on the nota, if the nota carried one. */
  harga?: number;
  /** The name shown on the nota. */
  nama?: string;
}

/**
 * The sale as it will be written: names, units and prices frozen at the
 * moment of saving, so the receipt can never disagree with the total beside
 * it — and a later price change cannot rewrite it (spec §8).
 *
 * The payment is settled here, from the lines' own gross, so the stored
 * discount, pembulatan, net and kembalian are the ones a reader can re-derive
 * from the lines beside them.
 */
export function saleDraft(lines: SaleLineInput[], shop: Shop, payment: PaymentInput) {
  const written = lines.map((line) => {
    const varian = shop.varian.find((entry) => entry.id === line.varianId);
    if (!varian) throw new Error(`Varian ${line.varianId} tidak ditemukan.`);
    // The cart's price wins: the cashier read that number to the customer.
    const harga = line.harga ?? varian.harga;
    return {
      varianId: varian.id,
      nama: line.nama ?? varian.nama,
      satuan: varian.satuan,
      qty: line.qty,
      harga,
      jumlah: roundLine(harga, line.qty),
    };
  });
  const total = written.reduce((sum, line) => sum + line.jumlah, 0);
  const settled = settleCash({
    gross: total,
    discount: payment.discount,
    tendered: payment.tendered,
    cashStep: payment.cashStep,
  });
  return { lines: written, total, payment: settled };
}

export function createLedger(store: LedgerStore, initialDeviceId: string = newDeviceId()): Ledger {
  // The identity is written onto every new event, so restoring a backup has to
  // move this value, not just the rows: the restored shop keeps its name.
  let deviceId = initialDeviceId;

  async function append(type: string, payload: unknown): Promise<string> {
    const { id, seq } = await store.nextIdentity();
    await store.append([
      { id, seq, deviceId, createdAt: new Date().toISOString(), type, payload } as StoredEvent,
    ]);
    return id;
  }

  return {
    get deviceId() {
      return deviceId;
    },
    async shop() {
      return foldEvents(await store.readAll());
    },
    async events() {
      return (await store.readAll()) as LedgerEvent[];
    },
    async backup() {
      return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        deviceId,
        lastSeq: await store.lastSeq(),
        events: await store.readAll(),
      };
    },
    async restore(backup) {
      await store.replaceAll(backup.events, backup.lastSeq);
      deviceId = backup.deviceId;
    },
    async adjustStock(input) {
      const reason = input.reason.trim();
      if (!reason) throw new StockError('Alasan hitung ulang wajib diisi.');
      checkCounted(input.counted);
      const events = (await store.readAll()) as LedgerEvent[];
      if (!foldEvents(events).varian.some((varian) => varian.id === input.varianId)) {
        throw new StockError('Varian tidak ditemukan.');
      }
      const delta = correctionDelta(stockOf(events, input.varianId).stock, input.counted);
      const { id, seq } = await store.nextIdentity();
      await store.append([
        {
          id,
          seq,
          deviceId,
          createdAt: new Date().toISOString(),
          type: 'stock.adjusted',
          payload: { varianId: input.varianId, delta, reason },
        } as StoredEvent,
      ]);
      return id;
    },
    async recordOpeningStock(input) {
      checkCounted(input.qty);
      const events = (await store.readAll()) as LedgerEvent[];
      if (!foldEvents(events).varian.some((varian) => varian.id === input.varianId)) {
        throw new StockError('Varian tidak ditemukan.');
      }
      // Opening is the first count, not another movement on top of one. A
      // second one would add stock the owner never counted, so it is refused
      // and the correction form is the way to change a count that exists.
      if (stockOf(events, input.varianId).stock.kind !== 'unknown') {
        throw new StockError('Stok awal hanya bisa dicatat sekali. Gunakan Hitung ulang untuk mengoreksi.');
      }
      return append('stock.opening', { varianId: input.varianId, qty: input.qty });
    },
    async importCatalog(plan) {
      if (plan.errors.length > 0) {
        throw new ImportError('Perbaiki baris yang salah sebelum mengimpor.');
      }
      const shop = foldEvents(await store.readAll());
      const at = new Date().toISOString();
      const drafts: StoredEvent[] = [];

      // Existing records are reused by name, so importing into a shop that
      // already has "Sembako" does not create a second one.
      const kategoriId = new Map<string, string>();
      for (const entry of shop.kategori) {
        if (!entry.archived) kategoriId.set(entry.nama.trim().toLowerCase(), entry.id);
      }
      for (const entry of plan.kategori) {
        const { id, seq } = await store.nextIdentity();
        kategoriId.set(entry.nama.trim().toLowerCase(), id);
        drafts.push({
          id,
          seq,
          deviceId,
          createdAt: at,
          type: 'kategori.created',
          payload: { nama: entry.nama, parentId: null },
        } as StoredEvent);
      }

      const produkId = new Map<string, string>();
      for (const entry of shop.produk) {
        if (!entry.archived) produkId.set(entry.nama.trim().toLowerCase(), entry.id);
      }
      for (const entry of plan.produk) {
        const parent = kategoriId.get(entry.kategori.trim().toLowerCase());
        if (!parent) throw new ImportError(`Kategori ${entry.kategori} tidak ditemukan.`);
        const { id, seq } = await store.nextIdentity();
        produkId.set(entry.nama.trim().toLowerCase(), id);
        drafts.push({
          id,
          seq,
          deviceId,
          createdAt: at,
          type: 'produk.created',
          payload: { kategoriId: parent, nama: entry.nama },
        } as StoredEvent);
      }

      for (const entry of plan.varian) {
        const parent = produkId.get(entry.produk.trim().toLowerCase());
        if (!parent) throw new ImportError(`Produk ${entry.produk} tidak ditemukan.`);
        const { id, seq } = await store.nextIdentity();
        drafts.push({
          id,
          seq,
          deviceId,
          createdAt: at,
          type: 'varian.created',
          payload: {
            produkId: parent,
            nama: entry.nama,
            kode: entry.kode,
            satuan: entry.satuan,
            jualBy: entry.jualBy,
            harga: entry.harga,
          },
        } as StoredEvent);
        if (entry.stokAwal !== null) {
          const opening = await store.nextIdentity();
          drafts.push({
            id: opening.id,
            seq: opening.seq,
            deviceId,
            createdAt: at,
            type: 'stock.opening',
            payload: { varianId: id, qty: entry.stokAwal },
          } as StoredEvent);
        }
      }

      // One append for the whole catalog: the store writes the batch as a
      // unit, so a failure leaves the shop exactly as it was.
      await store.append(drafts);
      return { kategori: plan.kategori.length, produk: plan.produk.length, varian: plan.varian.length };
    },
    async recordSale(input: SaleLineInput[], payment: PaymentInput) {
      const draft = saleDraft(input, foldEvents(await store.readAll()), payment);
      // Identity, number and payment are written by one append: the number on
      // the receipt and the figures beside it can never come from two saves.
      // One clock read, so the number can never straddle midnight away from
      // the time stamped on its own event.
      const at = new Date();
      const { id, seq } = await store.nextIdentity();
      await store.append([
        {
          id,
          seq,
          deviceId,
          createdAt: at.toISOString(),
          type: 'sale.completed',
          payload: { number: saleNumber(at.toISOString(), deviceId, seq), ...draft },
        } as StoredEvent,
      ]);
      return id;
    },
    append,
  };
}

/** The phone's ledger against its own SQLite file. */
export async function openLedger(db: SqlDatabase, deviceId: string = newDeviceId()): Promise<Ledger> {
  return createLedger(await createDbLedger(db, deviceId), deviceId);
}

export type { SqlDatabase };
