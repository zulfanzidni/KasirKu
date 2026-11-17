import { formatQty, formatRupiah } from '../design/money';
import { newEventId } from './dbLedger';
import { foldStock } from './stock';
import type { LedgerEvent, Settlement, Shop, Supplier } from './types';

/**
 * Suppliers, the delivery notes that bring their goods in, and what the shop
 * owes them.
 *
 * Nothing here stores a balance (ADR 0001). The payable is a fold of the log:
 *  - a tempo delivery adds its value the moment the goods arrive;
 *  - a titip delivery adds nothing until a unit sells (GLOSSARY: Titip);
 *  - a tunai line never adds anything;
 *  - a payment subtracts, and whatever is left carries over.
 *
 * A delivery note is one event per line, all sharing a `notaId`, because that
 * is what lets one visit mix tunai, tempo and titip and still read as one
 * record.
 */

export interface SupplierInput {
  nama: string;
  telepon?: string | null;
}

export interface DeliveryLineInput {
  varianId: string;
  qty: number;
  settlement: Settlement;
  /** The supplier's price per satuan. Required for tempo and titip. */
  hargaBeli?: number;
}

export interface DeliveryInput {
  supplierId: string;
  lines: readonly DeliveryLineInput[];
}

export interface SupplierBook {
  /** Records a supplier. Returns the event's id. */
  createSupplier(input: SupplierInput): Promise<string>;
  /** Writes one `stock.received` per line, all sharing one nota id. */
  receiveDelivery(input: DeliveryInput): Promise<string>;
  /** Records money handed to the supplier against the running total. */
  paySupplier(input: { supplierId: string; amount: number }): Promise<string>;
  /** Sends unsold titip units back. No money moves. */
  returnTitip(input: { supplierId: string; varianId: string; qty: number }): Promise<string>;
}

/** What the screen shows for one supplier: the total and what it is made of. */
export interface SupplierPayable {
  supplier: Supplier;
  /** Gross debt from tempo deliveries. */
  tempo: number;
  /** Gross debt from titip units that sold. */
  titip: number;
  /** Money already paid. */
  paid: number;
  /** What is still owed: tempo + titip − paid. */
  total: number;
}

/** Titip units still on the shelf, per supplier and varian. */
export interface TitipStock {
  supplierId: string;
  varianId: string;
  qty: number;
}

export class SupplierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierError';
  }
}

/** What a command may read: the folded shop and the log, already in hand. */
export interface SupplierReader {
  shop: Shop;
  events: LedgerEvent[];
}

function checkQty(qty: number, label: string): number {
  if (!Number.isFinite(qty) || qty <= 0) throw new SupplierError(`${label} harus lebih dari 0.`);
  if (Math.abs(qty * 4 - Math.round(qty * 4)) > 1e-9) {
    throw new SupplierError(`${label} harus kelipatan 1/4.`);
  }
  return qty;
}

function checkRupiah(amount: number, label: string): number {
  if (!Number.isInteger(amount) || amount < 0) throw new SupplierError(`${label} harus angka rupiah bulat.`);
  return amount;
}

export function createSupplierBook(
  append: (type: string, payload: unknown) => Promise<string>,
  read: () => SupplierReader,
): SupplierBook {
  function supplierOrThrow(supplierId: string): Supplier {
    const supplier = read().shop.supplier.find((entry) => entry.id === supplierId);
    if (!supplier || supplier.archived) throw new SupplierError('Pemasok tidak ditemukan.');
    return supplier;
  }

  return {
    async createSupplier(input) {
      const nama = input.nama.trim();
      if (!nama) throw new SupplierError('Nama pemasok wajib diisi.');
      return append('supplier.created', { nama, telepon: input.telepon?.trim() || null });
    },

    async receiveDelivery(input) {
      const { shop } = read();
      const supplier = shop.supplier.find((entry) => entry.id === input.supplierId);
      if (!supplier || supplier.archived) throw new SupplierError('Pemasok tidak ditemukan.');
      if (input.lines.length === 0) throw new SupplierError('Nota harus punya minimal satu baris.');

      // Validate every line before writing any of them: a half-written visit
      // would claim goods arrived that the owner never recorded.
      const lines = input.lines.map((line, index) => {
        const varian = shop.varian.find((entry) => entry.id === line.varianId);
        if (!varian || varian.archived) throw new SupplierError(`Baris ${index + 1}: varian tidak ditemukan.`);
        const qty = checkQty(line.qty, `Baris ${index + 1} jumlah`);
        if (!['tunai', 'tempo', 'titip'].includes(line.settlement)) {
          throw new SupplierError(`Baris ${index + 1}: cara bayar tidak dikenal.`);
        }
        if (line.settlement !== 'tunai' && line.hargaBeli == null) {
          throw new SupplierError(`Baris ${index + 1}: harga beli wajib untuk tempo atau titip.`);
        }
        const hargaBeli = line.hargaBeli == null ? undefined : checkRupiah(line.hargaBeli, `Baris ${index + 1} harga beli`);
        return { varianId: line.varianId, qty, settlement: line.settlement, hargaBeli };
      });

      const notaId = newEventId();
      for (const line of lines) {
        await append('stock.received', {
          varianId: line.varianId,
          qty: line.qty,
          settlement: line.settlement,
          supplierId: supplier.id,
          notaId,
          ...(line.hargaBeli === undefined ? {} : { hargaBeli: line.hargaBeli }),
        });
      }
      return notaId;
    },

    async paySupplier(input) {
      const supplier = supplierOrThrow(input.supplierId);
      const amount = checkRupiah(input.amount, 'Jumlah bayar');
      if (amount === 0) throw new SupplierError('Jumlah bayar harus lebih dari 0.');
      const owed = supplierPayable(read().events, supplier.id);
      if (amount > owed.total) {
        throw new SupplierError(`Pembayaran melebihi sisa utang Rp ${formatRupiah(owed.total)}.`);
      }
      return append('payable.paid', { supplierId: supplier.id, amount });
    },

    async returnTitip(input) {
      supplierOrThrow(input.supplierId);
      const varian = read().shop.varian.find((entry) => entry.id === input.varianId);
      if (!varian) throw new SupplierError('Varian tidak ditemukan.');
      const qty = checkQty(input.qty, 'Jumlah titip yang dikembalikan');
      const remaining = titipStock(read().events, input.supplierId).find(
        (entry) => entry.varianId === input.varianId,
      )?.qty;
      if (remaining == null || qty > remaining) {
        throw new SupplierError(`Titip tersisa hanya ${formatQty(remaining ?? 0)} ${varian.satuan}.`);
      }
      return append('stock.consignment_returned', {
        supplierId: input.supplierId,
        varianId: input.varianId,
        qty,
      });
    },
  };
}

/** What one supplier is owed, and the three figures that make it up. */
export function supplierPayable(events: readonly LedgerEvent[], supplierId: string): Omit<SupplierPayable, 'supplier'> {
  const fold = foldStock(events);
  const tempo = fold.tempo.get(supplierId) ?? 0;
  const titip = fold.titipSale.get(supplierId) ?? 0;
  const paid = fold.paid.get(supplierId) ?? 0;
  return { tempo, titip, paid, total: tempo + titip - paid };
}

/** Every live supplier with the running total owed and its composition. */
export function supplierPayables(events: readonly LedgerEvent[], suppliers: readonly Supplier[]): SupplierPayable[] {
  return suppliers
    .filter((supplier) => !supplier.archived)
    .map((supplier) => ({ supplier, ...supplierPayable(events, supplier.id) }))
    .sort((a, b) => a.supplier.nama.localeCompare(b.supplier.nama, 'id'));
}

/** Titip stock still on the shelf for one supplier, per varian. */
export function titipStock(events: readonly LedgerEvent[], supplierId?: string): TitipStock[] {
  const byKey = new Map<string, TitipStock>();
  for (const lot of foldStock(events).lots) {
    if (!lot.supplierId) continue;
    if (supplierId !== undefined && lot.supplierId !== supplierId) continue;
    const key = `${lot.supplierId}:${lot.varianId}`;
    const entry = byKey.get(key) ?? { supplierId: lot.supplierId, varianId: lot.varianId, qty: 0 };
    entry.qty += lot.qty;
    byKey.set(key, entry);
  }
  return [...byKey.values()].map((entry) => ({ ...entry, qty: Math.round(entry.qty * 1000) / 1000 }));
}
