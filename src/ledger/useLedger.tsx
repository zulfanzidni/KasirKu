import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { phoneEnvironment } from './environment';
import { emptyShop } from './events';
import { createCatalog, type Catalog } from './catalog';
import { clearCart, loadCart, saveCart } from './cartStorage';
import { newEventId } from './dbLedger';
import { openLedger, type Ledger } from './ledger';
import { addToCart, emptyCart, removeLine as removeFromCart, setLineQty as setQty, type Cart } from './register';
import type { PaymentInput, Shop, Varian } from './types';

/**
 * The app's single connection to the record, plus the one piece of screen
 * state that must outlive the phone: the unsaved cart.
 *
 * Screens read `shop` (folded from the log) and `cart` (a draft, written to
 * disk on every change) and never query SQLite themselves.
 */
export interface AppState {
  ready: boolean;
  error: string | null;
  shop: Shop;
  cart: Cart;
  /** True when the cart was read back from disk this launch — say so out loud. */
  cartRestored: boolean;
  /** The last sale saved this launch, for the confirmation screen. */
  lastSaleId: string | null;
  catalog: Catalog | null;

  /** Adds one, or says a choice is needed before anything is added. */
  tapItem(varianId: string): TapOutcome;
  /** Adds a chosen size or weight — what the sheets call. */
  addVarian(varianId: string, qty: number): void;
  setLineQty(varianId: string, qty: number): void;
  removeLine(varianId: string): void;
  cancelCart(): void;
  /**
   * Writes exactly one `sale.completed` for the cart and the payment given.
   * Null when another save is already running. A successful save empties the
   * cart, which is what keeps a second tap from ever writing again.
   */
  saveSale(payment: PaymentInput): Promise<string | null>;
  forgetLastSale(): void;
}

export type TapOutcome =
  | { kind: 'added' }
  | { kind: 'chooseVariant'; varian: Varian[] }
  | { kind: 'chooseWeight'; varian: Varian; pilihan: number[] }
  | { kind: 'ignored' };

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error('useApp harus dipakai di dalam LedgerProvider.');
  return state;
}

/** The key the phone's own id is stored under. */
const DEVICE_KEY = 'device_id';

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<Shop>(emptyShop);
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [cartRestored, setCartRestored] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  const ledgerRef = useRef<Ledger | null>(null);
  const shopRef = useRef<Shop>(shop);
  const cartRef = useRef<Cart>(cart);
  const savingRef = useRef(false);
  /** Serialises every write to the saved draft, so a stale write can never land after a newer one. */
  const diskRef = useRef<Promise<void>>(Promise.resolve());

  const kv = useMemo(() => phoneEnvironment.storage, []);

  const showShop = useCallback((next: Shop) => {
    shopRef.current = next;
    setShop(next);
  }, []);

  /** Queue a draft write behind every earlier one (spec §Selling: the cart survives a kill). */
  const persistCart = useCallback(
    (next: Cart) => {
      diskRef.current = diskRef.current.then(() => saveCart(kv, next)).catch(() => {});
      return diskRef.current;
    },
    [kv],
  );

  const updateCart = useCallback(
    (next: Cart) => {
      cartRef.current = next;
      setCart(next);
      void persistCart(next);
    },
    [persistCart],
  );

  const append = useCallback(
    async (type: string, payload: unknown) => {
      const current = ledgerRef.current;
      if (!current) throw new Error('Catatan belum siap.');
      const id = await current.append(type, payload);
      showShop(await current.shop());
      return id;
    },
    [showShop],
  );

  // Open the log and read the saved draft once, before the till is usable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let deviceId = await kv.getItem(DEVICE_KEY);
        if (!deviceId) {
          deviceId = newEventId();
          await kv.setItem(DEVICE_KEY, deviceId);
        }
        const db = await phoneEnvironment.openDatabase();
        const opened = await openLedger(db, deviceId);
        if (cancelled) return;
        ledgerRef.current = opened;
        showShop(await opened.shop());

        const saved = await loadCart(kv);
        if (cancelled) return;
        cartRef.current = saved;
        setCart(saved);
        setCartRestored(saved.length > 0);
        setReady(true);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kv, showShop]);

  const catalog = useMemo(() => (ready ? createCatalog(append) : null), [append, ready]);

  const tapItem = useCallback(
    (varianId: string): TapOutcome => {
      // Resolved from the folded shop, not from the rendered row: a stale
      // render must not sell an item at yesterday's price.
      const current = shopRef.current;
      const varian = current.varian.find((entry) => entry.id === varianId);
      if (!varian) return { kind: 'ignored' };

      const siblings = current.varian.filter((entry) => entry.produkId === varian.produkId && !entry.archived);
      if (siblings.length > 1) return { kind: 'chooseVariant', varian: siblings };
      if (varian.jualBy === 'weight') return { kind: 'chooseWeight', varian, pilihan: [0.25, 0.5, 1, 1.5] };
      updateCart(addToCart(cartRef.current, varian, 1));
      return { kind: 'added' };
    },
    [updateCart],
  );

  const addVarian = useCallback(
    (varianId: string, qty: number) => {
      const varian = shopRef.current.varian.find((entry) => entry.id === varianId);
      if (varian) updateCart(addToCart(cartRef.current, varian, qty));
    },
    [updateCart],
  );

  const saveSale = useCallback(
    async (payment: PaymentInput) => {
      // The save button disables itself the instant it is tapped; this guard
      // catches a second tap that lands before that render, or during the
      // write. It is closed before any await.
      if (savingRef.current) return null;
      const current = ledgerRef.current;
      const lines = cartRef.current;
      if (!current || lines.length === 0) return null;
      savingRef.current = true;
      try {
        // The written sale is the nota the cashier read out, line for line —
        // price included — never a re-lookup that could have moved since.
        const saleId = await current.recordSale(
          lines.map((line) => ({ varianId: line.varianId, qty: line.qty, harga: line.harga, nama: line.nama })),
          payment,
        );
        updateCart(emptyCart());
        // The draft must be gone from disk before anything else is shown: a
        // restored cart would otherwise offer to sell the same nota twice.
        await persistCart(emptyCart());
        await clearCart(kv);
        setLastSaleId(saleId);
        showShop(await current.shop());
        return saleId;
      } finally {
        // Only reached with the cart emptied (successfully, or past the write).
        // A save that threw before writing reopens the guard, and one that threw
        // after writing finds an empty cart, so neither can sell twice.
        savingRef.current = false;
      }
    },
    [kv, persistCart, showShop, updateCart],
  );

  const value: AppState = {
    ready,
    error,
    shop,
    cart,
    cartRestored,
    lastSaleId,
    catalog,
    tapItem,
    addVarian,
    setLineQty: (varianId, qty) => updateCart(setQty(cartRef.current, { varianId }, qty)),
    removeLine: (varianId) => updateCart(removeFromCart(cartRef.current, varianId)),
    cancelCart: () => updateCart(emptyCart()),
    saveSale,
    forgetLastSale: () => setLastSaleId(null),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
