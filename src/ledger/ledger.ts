import type { Discount } from '@/design';
import { settleCash } from '@/design';
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupFile } from './backup';
import { newDeviceId } from './deviceId';
import { foldEvents } from './events';
import { ImportError, type ImportCommit, type ImportPlan } from './import';
import { cashMovement, countPayload, openingFloat, type CashMovementInput } from './kas';
import { createDbLedger, type SqlDatabase } from './dbLedger';
import { hutangOf } from './hutang';
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
  /** Records a customer, so hutang has an owner. Returns the customer's id. */
  tambahPelanggan(input: PelangganInput): Promise<string>;
  /**
   * Hides a customer without erasing their history. Refused while they still
   * owe: a debt that cannot be seen is a debt that will not be collected.
   */
  arsipkanPelanggan(pelangganId: string): Promise<string>;
  /** Records money handed over against hutang. Returns the event's id. */
  catatPembayaranHutang(input: PembayaranHutangInput): Promise<string>;
  /**
   * Forgets the remaining hutang without collecting cash. A separate event
   * from a payment, so collections never count money that never arrived.
   */
  hapusBukuHutang(input: HapusBukuInput): Promise<string>;
  /**
   * Money leaving the drawer for something other than a supplier (listrik,
   * transport, banking the takings), or money put in. Every movement is its own
   * event, so expected cash is a fold rather than a remembered balance.
   */
  recordCashMovement(input: CashMovementInput): Promise<string>;
  /** Declares what the drawer holds now: the baseline expected cash folds from. */
  setOpeningFloat(input: { jumlah: number }): Promise<string>;
  /**
   * Records a physical count beside what the log expected and the difference,
   * with the baseline named. A count moves no money and locks nothing.
   */
  countCash(input: { counted: number; catatan?: string | null }): Promise<string>;
  /** The whole log as a file, ready to be saved off the phone. */
  backup(): Promise<BackupFile>;
  /**
   * Merges the other phone's events into this log. Additive and idempotent by
   * event id: an event already held is skipped, and no event type is treated
   * specially, so a type added later syncs without touching this. Answers how
   * many events were new.
   */
  applyRemote(events: readonly StoredEvent[]): Promise<number>;
  /**
   * Replaces this phone's log with a backup's, and adopts its device identity
   * so unsent events can continue the original stream. The caller is
   * responsible for the owner's consent; this is a rewrite, not a merge.
   */
  restore(backup: BackupFile): Promise<void>;
  /**
   * Continues another phone's stream without touching the log: new events
   * carry `deviceId` and numbers above the last one that phone used. The
   * caller is responsible for the safety check (ADR 0003); this only moves the
   * identity and the counter.
   */
  adoptIdentity(deviceId: string): Promise<void>;
  /** Escape hatch for tests and the next tickets; appends raw event types. */
  append(type: string, payload: unknown): Promise<string>;
}

/** What the customer form hands the ledger. */
export interface PelangganInput {
  nama: string;
  telepon?: string | null;
}

/** A payment against hutang, in whole rupiah. */
export interface PembayaranHutangInput {
  pelangganId: string;
  jumlah: number;
}

/** A write-off: the owner's reason is required, as with a stock correction. */
export interface HapusBukuInput {
  pelangganId: string;
  alasan: string;
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

/** A refusal about hutang: no customer, no debt; no debt, no payment. */
export class HutangError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HutangError';
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
  // The customer is resolved against the shop as it is now, and their name is
  // frozen onto the sale so a later rename cannot rewrite the nota.
  const pelanggan = payment.pelangganId
    ? shop.pelanggan.find((entry) => entry.id === payment.pelangganId)
    : undefined;
  return {
    lines: written,
    total,
    payment: settled,
    pelangganId: pelanggan?.id,
    pelangganNama: pelanggan?.nama,
  };
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
    async adoptIdentity(nextDeviceId) {
      // The log is not rewritten: only the name on the next event and the
      // number it takes move. The tail is the last number the adopted phone
      // used, so the next event continues its stream instead of reusing one.
      const events = await store.readAll();
      const tail = events
        .filter((event) => event.deviceId === nextDeviceId)
        .reduce((high, event) => Math.max(high, event.seq), 0);
      await store.continueFrom(tail);
      deviceId = nextDeviceId;
    },
    async applyRemote(events) {
      // Nothing here knows what an event means. The store merges by id, which
      // is what keeps the union additive however the events arrived.
      return store.appendAbsent(events);
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
      const shop = foldEvents(await store.readAll());
      const draft = saleDraft(input, shop, payment);
      // A shortfall is hutang, and hutang needs an owner. Refusing here means
      // no sale can ever create money owed that nobody can pay (user story 20).
      if (payment.pelangganId) {
        const pelanggan = shop.pelanggan.find((entry) => entry.id === payment.pelangganId);
        if (!pelanggan) throw new HutangError('Pelanggan tidak ditemukan.');
        if (pelanggan.archived) throw new HutangError('Pelanggan ini sudah diarsipkan.');
      } else if (draft.payment.unpaid > 0) {
        throw new HutangError(
          `Sisa Rp ${draft.payment.unpaid.toLocaleString('id-ID')} menjadi hutang, jadi pilih pelanggan dulu.`,
        );
      }
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
    async tambahPelanggan(input) {
      const nama = input.nama.trim();
      if (!nama) throw new HutangError('Nama pelanggan wajib diisi.');
      const { id, seq } = await store.nextIdentity();
      await store.append([
        {
          id,
          seq,
          deviceId,
          createdAt: new Date().toISOString(),
          type: 'pelanggan.created',
          payload: { nama, telepon: input.telepon?.trim() || null },
        } as StoredEvent,
      ]);
      return id;
    },
    async catatPembayaranHutang(input) {
      const events = (await store.readAll()) as LedgerEvent[];
      const shop = foldEvents(events);
      const pelanggan = shop.pelanggan.find((entry) => entry.id === input.pelangganId);
      if (!pelanggan) throw new HutangError('Pelanggan tidak ditemukan.');
      if (pelanggan.archived) throw new HutangError('Pelanggan ini sudah diarsipkan.');
      if (!Number.isInteger(input.jumlah) || input.jumlah <= 0) {
        throw new HutangError('Jumlah pembayaran harus rupiah bulat lebih dari 0.');
      }
      const { state } = hutangOf(events, input.pelangganId);
      if (state.kind !== 'hutang') {
        throw new HutangError('Pelanggan ini tidak punya hutang.');
      }
      const { id, seq } = await store.nextIdentity();
      await store.append([
        {
          id,
          seq,
          deviceId,
          createdAt: new Date().toISOString(),
          type: 'receivable.paid',
          payload: { pelangganId: input.pelangganId, jumlah: input.jumlah },
        } as StoredEvent,
      ]);
      return id;
    },
    async arsipkanPelanggan(pelangganId) {
      const events = (await store.readAll()) as LedgerEvent[];
      const shop = foldEvents(events);
      const pelanggan = shop.pelanggan.find((entry) => entry.id === pelangganId);
      if (!pelanggan) throw new HutangError('Pelanggan tidak ditemukan.');
      const { state } = hutangOf(events, pelangganId);
      if (state.kind === 'hutang') {
        throw new HutangError(
          `Pelanggan masih punya hutang Rp ${state.jumlah.toLocaleString('id-ID')}. Lunasi atau hapus buku dulu.`,
        );
      }
      const { id, seq } = await store.nextIdentity();
      await store.append([
        {
          id,
          seq,
          deviceId,
          createdAt: new Date().toISOString(),
          type: 'pelanggan.archived',
          payload: { pelangganId, archived: true },
        } as StoredEvent,
      ]);
      return id;
    },
    async hapusBukuHutang(input) {
      const alasan = input.alasan.trim();
      if (!alasan) throw new HutangError('Alasan hapus buku wajib diisi.');
      const events = (await store.readAll()) as LedgerEvent[];
      const shop = foldEvents(events);
      const pelanggan = shop.pelanggan.find((entry) => entry.id === input.pelangganId);
      if (!pelanggan) throw new HutangError('Pelanggan tidak ditemukan.');
      if (pelanggan.archived) throw new HutangError('Pelanggan ini sudah diarsipkan.');
      const { state } = hutangOf(events, input.pelangganId);
      if (state.kind !== 'hutang') throw new HutangError('Tidak ada hutang yang bisa dihapus.');
      const { id, seq } = await store.nextIdentity();
      await store.append([
        {
          id,
          seq,
          deviceId,
          createdAt: new Date().toISOString(),
          type: 'receivable.written_off',
          payload: { pelangganId: input.pelangganId, jumlah: state.jumlah, alasan },
        } as StoredEvent,
      ]);
      return id;
    },
    async recordCashMovement(input) {
      const { type, payload } = cashMovement(input);
      return append(type, payload);
    },
    async setOpeningFloat(input) {
      const { type, payload } = openingFloat(input);
      return append(type, payload);
    },
    async countCash(input) {
      const { type, payload } = countPayload((await store.readAll()) as LedgerEvent[], input);
      return append(type, payload);
    },
    append,
  };
}

/** The phone's ledger against its own SQLite file. */
export async function openLedger(db: SqlDatabase, deviceId: string = newDeviceId()): Promise<Ledger> {
  return createLedger(await createDbLedger(db, deviceId), deviceId);
}

export type { SqlDatabase };
