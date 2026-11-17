export { createCatalog, CatalogError, type Catalog, type VarianInput } from './catalog';
export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from './backup';
export { backupFiles, connectBackupFiles, type BackupFiles, type PickedFile, type SavedFile } from './backupFiles';
export { clearCart, loadCart, saveCart, type KeyValue } from './cartStorage';
export { emptyShop, foldEvents, sumSales } from './events';
export { openLedger, createLedger, saleDraft, type Ledger, type SaleLineInput } from './ledger';
export { deviceCode, saleNumber, saleNumberOf, dayStamp } from './saleNumber';
export {
  DEFAULT_RECEIPT,
  discountLine,
  receiptOf,
  roundingLine,
  shareReceipt,
  type ReceiptData,
  type ReceiptHeader,
  type ReceiptLine,
  type ReceiptShop,
} from './receipt';
export { connectPrinter, printer } from './printer';
export { MemoryStore } from './memoryStore';
export {
  gridVarian,
  isLow,
  lowStock,
  produkWithVarian,
  saleHistory,
  searchVarian,
  sortStock,
  stockByVariant,
  stockHistory,
  stockOnHand,
  type StockSource,
} from './queries';
export { correctionDelta, normaliseQty, stockOf, stockRows, type StockMovement, type StockRow } from './stock';
export { StockError, type StockCorrection } from './ledger';
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
  PaymentInput,
  PaymentMethod,
  Printer,
  Produk,
  Sale,
  SaleLine,
  SalePayment,
  Satuan,
  Shop,
  StockAdjusted,
  StockState,
  Varian,
} from './types';
export { useApp, LedgerProvider, type AppState } from './useLedger';
