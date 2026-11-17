import { connectPhone } from '@/ledger/environment';
import { connectBackupFiles } from '@/ledger/backupFiles';
import { phoneBackupFiles } from '@/ledger/phoneBackupFiles';
import { phonePrinter } from '@/ledger/phonePrinter';
import { connectPrinter } from '@/ledger/printer';
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
