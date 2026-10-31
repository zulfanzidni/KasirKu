import type { Discount } from '@/design';
import { settleCash } from '@/design';
import { newDeviceId } from './deviceId';
import { foldEvents } from './events';
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
