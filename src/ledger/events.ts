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

      case 'varian.created': {
        const varian: Varian = {
          id: event.id,
          produkId: event.payload.produkId,
          nama: event.payload.nama,
          kode: event.payload.kode,
          satuan: event.payload.satuan,
          jualBy: event.payload.jualBy,
          harga: event.payload.harga,
          archived: false,
        };
        shop.varian.push(varian);
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

  return shop;
}

/** Every rupiah the shop has sold, per the log. */
export function sumSales(sales: readonly Sale[]): number {
  return sales.reduce((sum, sale) => sum + sale.total, 0);
}

export type { Kategori, Produk, Sale, Shop, Stamped, Varian, LedgerEvent };
