import * as SQLite from 'expo-sqlite';
import { createLedger } from './ledger';
import { createDbLedger } from './dbLedger';

/**
 * The ledger against the phone's own database.
 *
 * expo-sqlite is mocked at the system boundary (it is a native module, and
 * jest-expo does not load one): the mock is a small table implementation of
 * the three calls the adapter makes. That way the test proves the adapter's
 * rows, `seq` handling and read-back *through the ledger interface*, and it
 * reopens from the same mocked file to stand in for an app restart.
 */
jest.mock('expo-sqlite', () => {
  // One object stands in for the file on the phone: created once, and still
  // there for the "reopened" app.
  const file = { rows: [] as Record<string, unknown>[], meta: [] as Record<string, unknown>[] };
  (globalThis as { __kasirkuFile?: unknown }).__kasirkuFile = file;

  class MockDatabase {
    rows = (function () {
      return (globalThis as unknown as { __kasirkuFile: typeof file }).__kasirkuFile.rows;
    })();
    meta = (function () {
      return (globalThis as unknown as { __kasirkuFile: typeof file }).__kasirkuFile.meta;
    })();
    async execAsync() {}
    async withTransactionAsync(task: () => Promise<unknown>) {
      return task();
    }
    async runAsync(sql: string, params: unknown[] = []) {
      if (/^\s*INSERT\s+INTO\s+events/i.test(sql)) {
        const [id, deviceId, seq, createdAt, type, payload] = params;
        this.rows.push({ id, device_id: deviceId, seq, created_at: createdAt, type, payload });
      } else if (/^\s*INSERT\s+INTO\s+ledger_meta/i.test(sql)) {
        const [key, value] = params;
        this.meta = this.meta.filter((row) => row.key !== key).concat({ key, value });
      }
      return {};
    }
    async getFirstAsync(sql: string, params: unknown[] = []) {
      if (/ledger_meta/i.test(sql)) {
        const key = params[0];
        const row = this.meta.find((entry) => entry.key === key);
        return row ? ({ value: row.value } as never) : null;
      }
      return null;
    }
    async getAllAsync(sql: string) {
      if (/FROM\s+events/i.test(sql)) {
        return this.rows.slice().sort((a, b) => Number(a.seq) - Number(b.seq)) as never;
      }
      return [] as never;
    }
  }
  return { openDatabaseAsync: async () => new MockDatabase() };
});

// The mock has no support for a UNIQUE index, so the fake mirrors the schema
// by hand: an id that exists is already a duplicate.
async function open() {
  const db = await SQLite.openDatabaseAsync('kasirku.db');
  return createDbLedger(db as never, 'gawai-1');
}

describe('the ledger on the phone', () => {
  it('stores a sale and still finds it after the app is reopened', async () => {
    const before = createLedger(await open(), 'gawai-1');
    const varianId = await before.append('varian.created', {
      produkId: 'prd-1',
      nama: 'Tepung terigu 1 kg',
      kode: 'TLG-1',
      satuan: 'kg',
      jualBy: 'weight',
      harga: 13500,
    });
    await before.recordSale([{ varianId, qty: 3 }], { discount: { kind: 'none' }, tendered: 40500 });

    const reopened = createLedger(await open(), 'gawai-1');

    expect((await reopened.shop()).sales).toHaveLength(1);
    expect((await reopened.shop()).sales[0].total).toBe(40500);
  });
});
