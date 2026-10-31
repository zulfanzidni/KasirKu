import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The slice of expo-sqlite the ledger uses, declared structurally so the
 * ledger depends on four calls rather than on a native module type.
 *
 * Bind parameters are `unknown` (SQLite accepts strings and numbers), and the
 * real `SQLiteDatabase` satisfies this: its variadic overload accepts any
 * value.
 */
export interface SqlDatabase {
  execAsync(source: string): Promise<unknown>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  /** Runs `task` inside one SQLite transaction. */
  withTransactionAsync(task: () => Promise<unknown>): Promise<unknown>;
}

/**
 * Compiles only if the real database still answers every call the ledger
 * makes. When expo-sqlite changes a signature, this line is what breaks — not
 * a screen at the counter.
 */
export type RealDatabaseFits = SQLiteDatabase extends SqlDatabase ? true : never;
