import type { Discount } from '@/design';
import { settleCash } from '@/design';
import { newDeviceId } from './deviceId';
import { foldEvents } from './events';
import { createDbLedger, type SqlDatabase } from './dbLedger';
import { roundLine } from './register';
import { saleNumber } from './saleNumber';
import type { LedgerStore, StoredEvent } from './store';
import type { Shop } from './types';

/**
 * The real ledger: expo-sqlite on the phone, whatever `SqlDatabase` is passed
 * in tests.
 */
export interface Ledger {
  deviceId: string;
  shop(): Promise<Shop>;
  /** Records one sale, with what was paid, as one event. Returns the sale's id. */
  recordSale(lines: SaleLineInput[], payment: PaymentInput): Promise<string>;
  /** Escape hatch for tests and the next tickets; appends raw event types. */
  append(type: string, payload: unknown): Promise<string>;
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
 * What the payment step hands the ledger. The discount is passed as it was
 * typed (rupiah or percent) and settled against the lines' gross inside the
 * draft, so the saved figure is the one the receipt prints.
 */
export interface PaymentInput {
  discount: Discount;
  /** Cash the customer put down. */
  tendered: number;
  /** Pembulatan step; omitted means the shop's default of Rp 500. */
  cashStep?: number;
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
