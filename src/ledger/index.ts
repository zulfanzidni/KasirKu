export { createCatalog, CatalogError, type Catalog, type VarianInput } from './catalog';
export { clearCart, loadCart, saveCart, type KeyValue } from './cartStorage';
export { emptyShop, foldEvents, sumSales } from './events';
export { openLedger, createLedger, type Ledger, type SaleLineInput } from './ledger';
export { MemoryStore } from './memoryStore';
export { produkWithVarian, saleHistory, searchVarian } from './queries';
export {
  addToCart,
  cartTotal,
  emptyCart,
  qtyMark,
  removeLine,
  setLineQty,
  WEIGHT_STEPS,
  type Cart,
  type CartLine,
} from './register';
export { teks } from './copy';

export type {
  JualBy,
  Kategori,
  LedgerEvent,
  Produk,
  Sale,
  SaleLine,
  Satuan,
  Shop,
  Varian,
} from './types';
export { useApp, LedgerProvider, type AppState } from './useLedger';
