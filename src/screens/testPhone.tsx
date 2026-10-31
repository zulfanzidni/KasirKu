import { connectPhone, type PhoneEnvironment } from '@/ledger/environment';
import { connectPrinter } from '@/ledger/printer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { LedgerProvider, useApp, type AppState } from '@/ledger/useLedger';
import { MemoryStore } from '@/ledger/memoryStore';
import type { SqlDatabase } from '@/ledger/sqlDatabase';
import type { Printer } from '@/ledger/types';

/**
 * The phone, faked at its single seam: the SQLite file and the key-value store.
 *
 * The log is a real `MemoryStore`, which enforces the same append-only contract
 * as SQLite, so the screen tests exercise the ledger itself. Every test drives
 * the app through the provider, so what it asserts is what the owner sees.
 */
export const mockPhone: { store: MemoryStore; kv: Map<string, string> } = {
  store: new MemoryStore(),
  kv: new Map<string, string>(),
};

/** Everything the phone printed this launch, and what it was asked to share. */
export const mockPrinter: {
  printed: string[];
  shared: { uri: string; mimeType: string }[];
  canShare: boolean;
} = {
  printed: [],
  shared: [],
  canShare: true,
};

export function resetPhone() {
  mockPhone.store = new MemoryStore();
  mockPhone.kv.clear();
  mockPrinter.printed = [];
  mockPrinter.shared = [];
  mockPrinter.canShare = true;
  const env: PhoneEnvironment = {
    // The phone's file is a real SQLite-shaped database over the in-memory
    // log, so the provider runs its actual open-fold-read path.
    openDatabase: async () => new InMemorySql(mockPhone.store),
    storage: {
      getItem: async (key) => mockPhone.kv.get(key) ?? null,
      setItem: async (key, value) => {
        mockPhone.kv.set(key, value);
      },
      removeItem: async (key) => {
        mockPhone.kv.delete(key);
      },
    },
  };
  connectPhone(env);

  const printer: Printer = {
    async printToFile(html) {
      mockPrinter.printed.push(html);
      return { uri: `file:///cache/nota-${mockPrinter.printed.length}.pdf` };
    },
    async canShare() {
      return mockPrinter.canShare;
    },
    async share(uri, mimeType) {
      mockPrinter.shared.push({ uri, mimeType });
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
  };
  connectPrinter(printer);
}

/** The provider's own state, captured so a test can seed the log and read the cart. */
export let app: AppState;

function Probe() {
  app = useApp();
  return null;
}

export function wrap(node: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <LedgerProvider>
        <Probe />
        {node}
      </LedgerProvider>
    </SafeAreaProvider>
  );
}

/** Waits, inside act, until the log is open — or fails loudly with why it is not. */
export async function waitReady(act: (fn: () => Promise<void>) => Promise<void>) {
  for (let i = 0; i < 100 && !app?.ready && !app?.error; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  if (!app) throw new Error('LedgerProvider belum terpasang.');
  if (app.error) throw new Error(`Catatan gagal dibuka: ${app.error}`);
  // The provider starts from an empty shop; let its first fold reach the screen.
  await act(async () => {});
  return app;
}

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
  outside: { x: 0, y: 0, width: 390, height: 844 },
};

/**
 * The three SQL calls `createDbLedger` makes, answered from the in-memory
 * store instead of a file. The schema is a no-op here; uniqueness and the
 * sequence rule are the store's own, exactly as on the phone.
 */
class InMemorySql implements SqlDatabase {
  constructor(private readonly store: MemoryStore) {}

  async execAsync() {}

  async withTransactionAsync(task: () => Promise<unknown>) {
    return task();
  }

  async runAsync(sql: string, params: unknown[] = []) {
    if (/INTO\s+ledger_meta/i.test(sql)) return undefined;
    if (/INTO\s+events/i.test(sql)) {
      const [id, deviceId, seq, createdAt, type, payload] = params;
      await this.store.append([
        {
          id: String(id),
          deviceId: String(deviceId),
          seq: Number(seq),
          createdAt: String(createdAt),
          type: String(type),
          payload: JSON.parse(String(payload)),
        } as never,
      ]);
    }
    return undefined;
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []) {
    if (/FROM\s+ledger_meta/i.test(sql)) {
      const last = (await this.store.readAll()).reduce((max, event) => Math.max(max, event.seq), 0);
      return (last === 0 ? null : { value: last }) as T | null;
    }
    if (/FROM\s+events\s+WHERE\s+id/i.test(sql)) {
      const found = (await this.store.readAll()).some((event) => event.id === params[0]);
      return (found ? { one: 1 } : null) as T | null;
    }
    return null;
  }

  async getAllAsync<T>(sql: string) {
    if (/FROM\s+events/i.test(sql)) {
      return (await this.store.readAll()).map((event) => ({
        id: event.id,
        device_id: event.deviceId,
        seq: event.seq,
        created_at: event.createdAt,
        type: event.type,
        payload: JSON.stringify(event.payload),
      })) as T[];
    }
    return [] as T[];
  }
}

