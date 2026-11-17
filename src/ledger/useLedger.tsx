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
import { createSettings, type Settings } from './settings';
import { clearCart, loadCart, saveCart } from './cartStorage';
import { newEventId } from './dbLedger';
import { hutangOf as hutangOfEvents, type HutangLedger } from './hutang';
import {
  openLedger,
  StockError,
  type HapusBukuInput,
  type Ledger,
  type PelangganInput,
  type PembayaranHutangInput,
  type StockCorrection,
} from './ledger';
import { sortStock, stockHistory as historyOf, todayTotals as todayTotalsOf, type TodayTotals } from './queries';
import { addToCart, emptyCart, removeLine as removeFromCart, setLineQty as setQty, type Cart } from './register';
import { stockOf as stockOfEvents, type StockRow } from './stock';
import type { LedgerEvent, PaymentInput, Shop, StockState, Varian } from './types';

/** One line of a varian's stock history, with the count after it. */
export type StockHistoryEntry = ReturnType<typeof historyOf> extends Promise<(infer T)[]> ? T : never;

export type { HutangLedger, StockCorrection, StockRow, StockState, TodayTotals };

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
  /** The shop's own words for the nota. Null until the log is open. */
  settings: Settings | null;

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
   *
   * `lines` is only for a sale that is not the cart (tests, and later a
   * quick-sale flow); the till always passes nothing and sells the cart.
   */
  saveSale(payment: PaymentInput, lines?: readonly { varianId: string; qty: number }[]): Promise<string | null> | null;

  /** The count for one varian as the log answers it: `unknown` or a number. */
  stockOf(varianId: string): StockState;
  /** Everything that moved this varian's count, oldest first, with the running total. */
  stockHistory(varianId: string): StockHistoryEntry[];
  /** Every live varian with its own count, in the Stok screen's order. */
  stockRows(): StockRow[];
  /**
   * The owner counted the shelf: `counted` becomes the stock, recorded as the
   * delta from what the app believed, with their reason. Returns the event id.
   */
  adjustStock(input: StockCorrection): Promise<string>;

  /** One customer's hutang, folded from the log: hutang, lunas or kredit. */
  hutangOf(pelangganId: string): HutangLedger;
  /** Today's full value sold and the cash that actually came in. */
  todayTotals(): TodayTotals;
  /** Records a customer, so hutang has an owner. */
  tambahPelanggan(input: PelangganInput): Promise<string>;
  /** Hides a customer; refused while they still owe. */
  arsipkanPelanggan(pelangganId: string): Promise<string>;
  /** Records money handed over against hutang. */
  catatPembayaranHutang(input: PembayaranHutangInput): Promise<string>;
  /** Forgets the remaining hutang without collecting cash. */
  hapusBukuHutang(input: HapusBukuInput): Promise<string>;

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
  /** The whole log, kept beside the folded shop: stock questions fold this. */
  const [events, setEvents] = useState<LedgerEvent[]>([]);

  const ledgerRef = useRef<Ledger | null>(null);
  const eventsRef = useRef<LedgerEvent[]>([]);
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

  const showEvents = useCallback((next: LedgerEvent[]) => {
    eventsRef.current = next;
    setEvents(next);
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
      showEvents(await current.events());
      return id;
    },
    [showShop, showEvents],
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
        showEvents(await opened.events());

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
  }, [kv, showShop, showEvents]);

  const catalog = useMemo(() => (ready ? createCatalog(append) : null), [append, ready]);
  const settings = useMemo(() => (ready ? createSettings(append) : null), [append, ready]);

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

  /**
   * Writes exactly one sale. The promise is refused in the caller's own tick
   * when a write is already in flight: a second entrance gets null, never a
   * second sale, and this holds across a re-render, a screen unmount and a
   * re-opened payment step.
   */
  const saveSale = useCallback(
    (payment: PaymentInput, given?: readonly { varianId: string; qty: number }[]): Promise<string | null> | null => {
      // The save button also disables itself the instant it is tapped; this
      // guard is what covers the tap that lands before that render, and any
      // re-entry while the write is running.
      if (savingRef.current) return null;
      const current = ledgerRef.current;
      const lines = given ?? cartRef.current;
      if (!current || lines.length === 0) return null;
      savingRef.current = true;
      return write();

      async function write(): Promise<string | null> {
        try {
          // A sale that is not the cart leaves the cart, and its saved draft,
          // exactly as they were.
          const onCart = given === undefined;
          // The written sale is the nota the cashier read out, line for line —
          // price included — never a re-lookup that could have moved since.
          const saleId = await current!.recordSale(
            onCart
              ? cartRef.current.map((line) => ({ varianId: line.varianId, qty: line.qty, harga: line.harga, nama: line.nama }))
              : lines.map((line) => ({ varianId: line.varianId, qty: line.qty })),
            payment,
          );
          if (onCart) {
            updateCart(emptyCart());
            // The draft must be gone from disk before anything else is shown: a
            // restored cart would otherwise offer to sell the same nota twice.
            await persistCart(emptyCart());
            await clearCart(kv);
          }
          setLastSaleId(saleId);
          showShop(await current!.shop());
          showEvents(await current!.events());
          return saleId;
        } finally {
          // Reached only once the write has finished — after a throw before it,
          // or after an emptied cart. A retry that finds the cart empty cannot
          // sell twice, and a retry after a failed write is the right thing to
          // offer.
          savingRef.current = false;
        }
      }
    },
    [kv, persistCart, showShop, showEvents, updateCart],
  );

  /** Stock, read off the log. Pure and instant: the events are already in hand. */
  const stockOf = useCallback((varianId: string): StockState => stockOfEvents(events, varianId).stock, [events]);

  const stockHistory = useCallback((varianId: string): StockHistoryEntry[] => {
    const { movements } = stockOfEvents(events, varianId);
    let after = 0;
    return movements.map((movement) => {
      after += movement.delta;
      return { ...movement, after };
    });
  }, [events]);

  const stockRows = useCallback((): StockRow[] => {
    // Same order the Stok list draws; the low rule comes from the owner's
    // minimum stored on the varian (ticket 05 adds selling speed).
    const rows = shop.varian.map((varian) => ({ varian, stock: stockOfEvents(events, varian.id).stock }));
    return sortStock(rows.filter((row) => !row.varian.archived));
  }, [events, shop.varian]);

  const adjustStock = useCallback(
    async (input: StockCorrection) => {
      const current = ledgerRef.current;
      if (!current) throw new StockError('Catatan belum siap.');
      const id = await current.adjustStock(input);
      showShop(await current.shop());
      showEvents(await current.events());
      return id;
    },
    [showShop, showEvents],
  );

  /** Hutang is a fold of the events already in hand, so it is instant. */
  const hutangOf = useCallback((pelangganId: string): HutangLedger => hutangOfEvents(events, pelangganId), [events]);

  const todayTotals = useCallback((): TodayTotals => todayTotalsOf(events), [events]);

  /** Every customer write goes through the ledger, then re-reads the log. */
  const writePelanggan = useCallback(
    async (write: (ledger: Ledger) => Promise<string>) => {
      const current = ledgerRef.current;
      if (!current) throw new StockError('Catatan belum siap.');
      const id = await write(current);
      showShop(await current.shop());
      showEvents(await current.events());
      return id;
    },
    [showShop, showEvents],
  );

  const tambahPelanggan = useCallback(
    (input: PelangganInput) => writePelanggan((ledger) => ledger.tambahPelanggan(input)),
    [writePelanggan],
  );
  const arsipkanPelanggan = useCallback(
    (pelangganId: string) => writePelanggan((ledger) => ledger.arsipkanPelanggan(pelangganId)),
    [writePelanggan],
  );
  const catatPembayaranHutang = useCallback(
    (input: PembayaranHutangInput) => writePelanggan((ledger) => ledger.catatPembayaranHutang(input)),
    [writePelanggan],
  );
  const hapusBukuHutang = useCallback(
    (input: HapusBukuInput) => writePelanggan((ledger) => ledger.hapusBukuHutang(input)),
    [writePelanggan],
  );

  const value: AppState = {
    ready,
    error,
    shop,
    cart,
    cartRestored,
    lastSaleId,
    catalog,
    settings,
    tapItem,
    addVarian,
    setLineQty: (varianId, qty) => updateCart(setQty(cartRef.current, { varianId }, qty)),
    removeLine: (varianId) => updateCart(removeFromCart(cartRef.current, varianId)),
    cancelCart: () => updateCart(emptyCart()),
    saveSale,
    forgetLastSale: () => setLastSaleId(null),
    stockOf,
    stockHistory,
    stockRows,
    adjustStock,
    hutangOf,
    todayTotals,
    tambahPelanggan,
    arsipkanPelanggan,
    catatPembayaranHutang,
    hapusBukuHutang,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
