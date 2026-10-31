import type { LedgerEvent, Shop, Varian } from './types';

/**
 * What the cashier can see and tap. Everything here is an answer read off the
 * event log; nothing is a second place to write state.
 */

export function gridVarian(shop: Shop): Varian[] {
  return shop.varian
    .filter((varian) => !varian.archived)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
}

/**
 * Search by name, ignoring case and accents the way a person types. An empty
 * query is not a filter: the whole grid stays.
 */
export function searchVarian(varian: readonly Varian[], query: string): Varian[] {
  const needle = query.trim().toLowerCase().replace(/,/g, '.');
  if (!needle) return [...varian];
  return varian.filter((entry) => entry.nama.toLowerCase().includes(needle));
}

/** Every product that has at least one live variant, for creation forms. */
export function produkWithVarian(shop: Shop) {
  return shop.produk.filter(
    (produk) =>
      !produk.archived &&
      shop.varian.some((varian) => varian.produkId === produk.id && !varian.archived),
  );
}

/** Every event as stored, oldest first: the history the owner can look back on. */
export function saleHistory(shop: Shop) {
  return [...shop.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type { LedgerEvent, Shop, Varian };
