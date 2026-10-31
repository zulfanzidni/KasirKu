import { connectPhone } from '@/ledger/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';

/**
 * The app's phone: this device's SQLite file and its key-value storage.
 *
 * Wired here, once, at the entry point — the only place that loads the two
 * native modules. Everything below depends on `phoneEnvironment` instead.
 */
connectPhone({
  openDatabase: () => openDatabaseAsync('kasirku.db'),
  storage: {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },
});
