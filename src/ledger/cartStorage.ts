import type { Cart } from './register';

/**
 * The cart on disk, so locking the phone or killing the app does not lose a
 * half-entered sale (spec §Selling, story 9). This is a draft, not an event:
 * it never touches stock or money, and it is thrown away when the sale saves.
 */

/** The tiny slice of AsyncStorage this module needs, named so tests can fake it. */
export interface KeyValue {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const KEY = 'keranjang';

export async function saveCart(store: KeyValue, cart: Cart): Promise<void> {
  if (cart.length === 0) {
    await store.removeItem(KEY);
    return;
  }
  await store.setItem(KEY, JSON.stringify(cart));
}

/**
 * Reads the draft back. Anything unreadable is treated as no draft: a till
 * that cannot start because of one bad string is worse than losing it.
 */
export async function loadCart(store: KeyValue): Promise<Cart> {
  const raw = await store.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLine);
  } catch {
    return [];
  }
}

export async function clearCart(store: KeyValue): Promise<void> {
  await store.removeItem(KEY);
}

function isCartLine(value: unknown): value is Cart[number] {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.varianId === 'string' &&
    typeof line.nama === 'string' &&
    typeof line.qty === 'number' &&
    Number.isFinite(line.qty) &&
    line.qty > 0 &&
    typeof line.harga === 'number' &&
    typeof line.jumlah === 'number' &&
    typeof line.satuan === 'string'
  );
}

/** An in-memory stand-in for the phone's key-value storage. */
export class MemoryKeyValue implements KeyValue {
  private readonly items = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.items.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.items.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.items.delete(key);
  }
}
