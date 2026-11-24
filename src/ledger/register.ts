import { formatQty, lineTotal } from '@/design';
import type { Satuan, Varian } from './types';

/**
 * The cart, as a draft. It touches no stock and no money until saved
 * (GLOSSARY: Keranjang), which is why every function here is pure and returns
 * a new cart instead of writing anything.
 */

// ---------------------------------------------------------------------------
// Selling
// ---------------------------------------------------------------------------

/** One line's rupiah, rounded once, by the one function in the app that does it. */
export function roundLine(harga: number, qty: number): number {
  return lineTotal({ unitPrice: harga, qty });
}

export interface CartLine {
  varianId: string;
  nama: string;
  satuan: Satuan;
  qty: number;
  harga: number;
  /** Rupiah, rounded once at the line. */
  jumlah: number;
}

export type Cart = CartLine[];

/** The steps a weight item is sold in, in kg. */
export const WEIGHT_STEPS: readonly number[] = [0.25, 0.5, 1, 1.5];

export function emptyCart(): Cart {
  return [];
}

/** What the grid does when a varian is tapped, before screen state is involved. */
export type TapResult =
  | { kind: 'add'; cart: Cart }
  | { kind: 'chooseWeight'; varian: Varian; pilihan: number[] };

/** Adds `qty` of a varian, merging into an existing line for the same varian. */
export function addToCart(cart: Cart, varian: Varian, qty = 1): Cart {
  const existing = cart.find((line) => line.varianId === varian.id);
  // A later tap carries the varian's current name and price, so the line always
  // reads what the cashier sees on the grid when they tap.
  if (existing) {
    const line = reline({ ...existing, nama: varian.nama, harga: varian.harga }, existing.qty + qty);
    return cart.map((entry) => (entry.varianId === line.varianId ? line : entry));
  }  return [...cart, { ...snapshot(varian), qty, jumlah: roundLine(varian.harga, qty) }];
}

/** Rewrites one line to a new quantity, recalculating its total once. */
export function setLineQty(cart: Cart, target: Pick<CartLine, 'varianId'>, qty: number): Cart {
  return cart.map((line) => (line.varianId === target.varianId ? reline(line, qty) : line));
}

function reline(line: CartLine, qty: number): CartLine {
  // Quantity goes through the same rounding every line uses, so 1/4 kg at a
  // weight price reads back the way it will read on the receipt.
  return { ...line, qty, jumlah: roundLine(line.harga, qty) };
}

export function removeLine(cart: Cart, varianId: string): Cart {
  return cart.filter((line) => line.varianId !== varianId);
}

export function cartTotal(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.jumlah, 0);
}

/** The quantity mark a row shows: "×2", "×¼". */
export function qtyMark(cart: Cart, varianId: string): string | undefined {
  const line = cart.find((entry) => entry.varianId === varianId);
  return line ? `×${formatQty(line.qty)}` : undefined;
}

/** The cart line for a varian, with the name and price frozen at the moment it was added. */
export function snapshot(varian: Varian): CartLine {
  return {
    varianId: varian.id,
    nama: varian.nama,
    satuan: varian.satuan,
    qty: 0,
    harga: varian.harga,
    jumlah: 0,
  };
}
