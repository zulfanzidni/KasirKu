import type { Discount } from '@/design';
import { settleCash } from '@/design';
import { newDeviceId } from './deviceId';
import { foldEvents } from './events';
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
  deviceId: string;
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

export function createLedger(store: LedgerStore, deviceId: string = newDeviceId()): Ledger {
  async function append(type: string, payload: unknown): Promise<string> {
    const { id, seq } = await store.nextIdentity();
    await store.append([
      { id, seq, deviceId, createdAt: new Date().toISOString(), type, payload } as StoredEvent,
    ]);
    return id;
  }

  return {
    deviceId,
    async shop() {
      return foldEvents(await store.readAll());
    },
    async events() {
      return (await store.readAll()) as LedgerEvent[];
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
    append,
  };
}

/** The phone's ledger against its own SQLite file. */
export async function openLedger(db: SqlDatabase, deviceId: string = newDeviceId()): Promise<Ledger> {
  return createLedger(await createDbLedger(db, deviceId), deviceId);
}

export type { SqlDatabase };
