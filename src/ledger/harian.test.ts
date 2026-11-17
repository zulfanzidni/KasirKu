import { todayTotals } from './queries';
import type { LedgerEvent } from './types';

/**
 * Two numbers the owner reads about today, and they are not supposed to match:
 * what was sold (hutang included) and what cash actually came in. The test
 * states both, so "sales" can never quietly become "cash collected".
 */

const HARI_INI = new Date('2026-11-17T15:00:00');

describe('today’s two numbers', () => {
  it('counts the full value sold but only the cash handed over', () => {
    const events: LedgerEvent[] = [
      // 30.000 sold, 20.000 handed over, 10.000 became hutang.
      sale('2026-11-17T10:00:00', { total: 30000, net: 30000, tendered: 20000, unpaid: 10000 }),
      // 10.000 sold and paid in full.
      sale('2026-11-17T10:30:00', { total: 10000, net: 10000, tendered: 10000, unpaid: 0 }),
      // A customer pays 4.000 of the hutang in the afternoon.
      event('receivable.paid', { pelangganId: 'ani', jumlah: 4000 }, '2026-11-17T11:00:00'),
      // Yesterday’s sale is not today’s.
      sale('2026-11-16T18:00:00', { total: 99000, net: 99000, tendered: 99000, unpaid: 0 }),
    ];

    expect(todayTotals(events, HARI_INI)).toEqual({
      penjualan: 40000,
      tunai: 34000,
      hutang: 10000,
    });
  });

  it('does not treat a write-off as money arriving', () => {
    const events: LedgerEvent[] = [
      sale('2026-11-17T09:00:00', { total: 8000, net: 8000, tendered: 3000, unpaid: 5000 }),
      event(
        'receivable.written_off',
        { pelangganId: 'ani', jumlah: 5000, alasan: 'Tidak jadi ditagih' },
        '2026-11-17T12:00:00',
      ),
    ];

    expect(todayTotals(events, HARI_INI)).toEqual({ penjualan: 8000, tunai: 3000, hutang: 5000 });
  });
});

function sale(
  at: string,
  input: { total: number; net: number; tendered: number; unpaid: number },
): LedgerEvent {
  return event(
    'sale.completed',
    {
      number: '20261117-UJI-001',
      lines: [],
      total: input.total,
      payment: {
        method: 'tunai',
        discount: 0,
        cashStep: 500,
        rounding: 0,
        net: input.net,
        tendered: input.tendered,
        kembalian: Math.max(0, input.tendered - input.net),
        unpaid: input.unpaid,
      },
      pelangganId: input.unpaid > 0 ? 'ani' : undefined,
      pelangganNama: input.unpaid > 0 ? 'Bu Ani' : undefined,
    },
    at,
  );
}

function event(type: string, payload: unknown, at: string): LedgerEvent {
  return { id: `${type}-${at}`, deviceId: 'gawai-uji', seq: 1, createdAt: at, type, payload } as LedgerEvent;
}

