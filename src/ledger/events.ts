import { DEFAULT_RECEIPT } from './receipt';
import { saleNumberOf } from './saleNumber';
import type { StoredEvent } from './store';
import type {
  Kategori,
  LedgerEvent,
  Produk,
  Sale,
  Shop,
  Stamped,
  Varian,
} from './types';

/**
 * Folding the log into the shop. Pure: same events in, same shop out, on any
 * phone. Nothing here reads the clock, the disk or the network.
 */

export function emptyShop(): Shop {
  return { kategori: [], produk: [], varian: [], sales: [], receipt: DEFAULT_RECEIPT, receiptAt: null };
}

export function foldEvents(events: readonly LedgerEvent[]): Shop {
  const shop = emptyShop();
  const fieldAt = new WeakMap<object, Map<string, string>>();

  for (const event of events) {
    switch (event.type) {
      case 'kategori.created':
        shop.kategori.push({
          id: event.id,
          nama: event.payload.nama,
          parentId: event.payload.parentId,
          archived: false,
        });
        break;

      case 'kategori.updated': {
        const kategori = shop.kategori.find((entry) => entry.id === event.payload.kategoriId);
        if (kategori) applyFieldEdits(kategori, event.payload, KATEGORI_FIELDS, fieldAt);
        break;
      }

      case 'kategori.archived': {
        const kategori = shop.kategori.find((entry) => entry.id === event.payload.kategoriId);
        if (kategori) kategori.archived = event.payload.archived;
        break;
      }

      case 'produk.created': {
        const produk: Produk = {
          id: event.id,
          kategoriId: event.payload.kategoriId,
          nama: event.payload.nama,
          archived: false,
        };
        shop.produk.push(produk);
        break;
      }

      case 'produk.updated': {
        const produk = shop.produk.find((entry) => entry.id === event.payload.produkId);
        if (produk) applyFieldEdits(produk, event.payload, PRODUK_FIELDS, fieldAt);
        break;
      }

      case 'produk.archived': {
        const produk = shop.produk.find((entry) => entry.id === event.payload.produkId);
        if (produk) produk.archived = event.payload.archived;
        break;
      }

      case 'varian.created': {
        const varian: Varian = {
          id: event.id,
          produkId: event.payload.produkId,
          nama: event.payload.nama,
          kode: event.payload.kode,
          satuan: event.payload.satuan,
          jualBy: event.payload.jualBy,
          harga: event.payload.harga,
          minimum: null,
          archived: false,
        };
        shop.varian.push(varian);
        break;
      }

      case 'varian.updated':
        // Resolved per field: a payload carries only what changed, so two
        // phones editing different fields both survive. Within one field the
        // later stamped moment wins.
        {
          const varian = shop.varian.find((entry) => entry.id === event.payload.varianId);
          if (varian) applyFieldEdits(varian, event.payload, VARIAN_FIELDS, fieldAt);
        }
        break;

      case 'varian.archived': {
        const varian = shop.varian.find((entry) => entry.id === event.payload.varianId);
        if (varian) varian.archived = event.payload.archived;
        break;
      }

      case 'sale.completed': {
        const sale: Sale = {
          id: event.id,
          createdAt: event.createdAt,
          lines: event.payload.lines,
          total: event.payload.total,
          number: saleNumberOf(event as StoredEvent),
          payment: event.payload.payment ?? null,
        };
        shop.sales.push(sale);
        break;
      }

      case 'stock.adjusted':
        // The count itself is not stored here; stock.ts folds it on demand.
        // Keeping the fold out of `Shop` keeps the shop cheap to rebuild while
        // a screen can still ask for any one varian's number.
        break;

      case 'settings.updated':
        // Last write wins on the moment it was written: an older edit that
        // syncs late must not undo a newer one the owner already sees.
        if (shop.receiptAt === null || event.createdAt > shop.receiptAt) {
          shop.receipt = event.payload.receipt;
          shop.receiptAt = event.createdAt;
        }
        break;
    }
  }

  // A produk whose kategori is archived is not deleted: it stays in the list,
  // uncategorised (ticket 13). Derived here, so the rule holds however the
  // events arrived and whichever phone wrote them.
  const archivedKategori = new Set(shop.kategori.filter((entry) => entry.archived).map((entry) => entry.id));
  for (const produk of shop.produk) {
    if (produk.kategoriId !== null && archivedKategori.has(produk.kategoriId)) produk.kategoriId = null;
  }

  return shop;
}

type VarianField = 'nama' | 'kode' | 'jualBy' | 'harga' | 'minimum';
const VARIAN_FIELDS: readonly VarianField[] = ['nama', 'kode', 'jualBy', 'harga', 'minimum'];
const KATEGORI_FIELDS = ['nama', 'parentId'] as const;
const PRODUK_FIELDS = ['nama', 'kategoriId'] as const;

/**
 * Master data resolves per field (ADR 0001): an update payload holds only the
 * fields that changed, each stamped. Folding in log order with "the later
 * moment wins" gives the same answer on both phones without keeping any extra
 * state: a stale edit that arrives after a newer one is ignored.
 */
function applyFieldEdits<T extends object>(
  target: T,
  payload: Record<string, unknown>,
  fields: readonly string[],
  fieldAt: WeakMap<object, Map<string, string>>,
): void {
  for (const field of fields) {
    const change = payload[field] as Stamped<unknown> | undefined;
    if (!change) continue;
    if (change.at < (fieldAt.get(target)?.get(field) ?? '')) continue;
    (target as Record<string, unknown>)[field] = change.value;
    let stamped = fieldAt.get(target);
    if (!stamped) {
      stamped = new Map();
      fieldAt.set(target, stamped);
    }
    stamped.set(field, change.at);
  }
}

/** Every rupiah the shop has sold, per the log. */
export function sumSales(sales: readonly Sale[]): number {
  return sales.reduce((sum, sale) => sum + sale.total, 0);
}

export type { Kategori, Produk, Sale, Shop, Stamped, Varian, LedgerEvent };
