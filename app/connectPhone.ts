import { connectPhone } from '@/ledger/environment';
import { connectBackupFiles } from '@/ledger/backupFiles';
import { connectImportFiles } from '@/ledger/importFiles';
import { phoneBackupFiles } from '@/ledger/phoneBackupFiles';
import { phoneImportFiles } from '@/ledger/phoneImportFiles';
import { phonePrinter } from '@/ledger/phonePrinter';
import { connectPrinter } from '@/ledger/printer';
import { connectSync } from '@/ledger/sync';
import { createHttpExchange } from '@/ledger/syncHttp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';

/**
 * The app's phone: this device's SQLite file, its key-value storage, the
 * printer that writes a nota to PDF, and the files a backup is carried in.
 *
 * Wired here, once, at the entry point — the only place that loads these
 * native modules. Everything below depends on `phoneEnvironment`, `printer`
 * and `backupFiles` instead.
 */
connectPhone({
  openDatabase: () => openDatabaseAsync('kasirku.db'),
  storage: {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },
});

connectPrinter(phonePrinter);
connectBackupFiles(phoneBackupFiles);
connectImportFiles(phoneImportFiles);

// The shared place two phones meet. It is configured at build time and points
// at whatever endpoint satisfies the contract in `src/ledger/syncHttp.ts`.
// Without an address, the app says sync is not connected rather than quietly
// pretending the other phone heard; selling is unaffected either way.
const syncUrl = process.env.EXPO_PUBLIC_SYNC_URL;
if (syncUrl) {
  connectSync(createHttpExchange({ baseUrl: syncUrl, token: process.env.EXPO_PUBLIC_SYNC_TOKEN }));
}
