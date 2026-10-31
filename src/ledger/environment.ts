import type { KeyValue } from './cartStorage';
import type { SqlDatabase } from './sqlDatabase';

/**
 * Everything the app needs from the phone beneath it.
 *
 * Two things live here rather than being imported straight into the provider:
 * the SQLite file (a native module) and the key-value store. The provider
 * depends on this one seam, so a test can hand it an in-memory phone and
 * exercise the real ledger on top of it.
 */
export interface PhoneEnvironment {
  openDatabase(): Promise<SqlDatabase>;
  storage: KeyValue;
}

/**
 * The real phone. `openDatabase` is set at the app entry, which is the one
 * place that imports expo-sqlite; until then the till cannot open a log, which
 * is exactly what should happen if the entry forgot to wire it.
 */
export const phoneEnvironment: PhoneEnvironment = {
  openDatabase: async () => {
    throw new Error('Penyimpanan ponsel belum disambungkan.');
  },
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
};

/** Point the app at a given phone. Only the app entry and the tests call this. */
export function connectPhone(phone: PhoneEnvironment): void {
  Object.assign(phoneEnvironment, phone);
}

