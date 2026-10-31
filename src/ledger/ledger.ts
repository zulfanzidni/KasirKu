import { newDeviceId } from './deviceId';
import { foldEvents } from './events';
import { createDbLedger, type SqlDatabase } from './dbLedger';
import { roundLine } from './register';
import type { LedgerStore, StoredEvent } from './store';
import type { Shop } from './types';

/**
 * The real ledger: expo-sqlite on the phone, whatever `SqlDatabase` is passed
 * in tests.
 */
export interface Ledger {
  deviceId: string;
  shop(): Promise<Shop>;
  /** Records one sale as one event. Returns the sale's id. */
  recordSale(lines: SaleLineInput[]): Promise<string>;
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
 * The sale as it will be written: names, units and prices frozen at the
 * moment of saving, so the receipt can never disagree with the total beside
 * it — and a later price change cannot rewrite it (spec §8).
 */
export function saleDraft(lines: SaleLineInput[], shop: Shop) {
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
  return { lines: written, total: written.reduce((sum, line) => sum + line.jumlah, 0) };
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
    async recordSale(input: SaleLineInput[]) {
      return append('sale.completed', saleDraft(input, foldEvents(await store.readAll())));
    },
    append,
  };
}

/** The phone's ledger against its own SQLite file. */
export async function openLedger(db: SqlDatabase, deviceId: string = newDeviceId()): Promise<Ledger> {
  return createLedger(await createDbLedger(db, deviceId), deviceId);
}

export type { SqlDatabase };
