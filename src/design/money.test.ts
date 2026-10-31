import {
  cartSubtotal,
  computeTotals,
  discountAmount,
  formatQty,
  formatRupiah,
  lineTotal,
  parseQty,
  parseRupiah,
  roundToCashStep,
  roundingAdjustment,
} from './money';

describe('formatRupiah', () => {
  it('groups thousands the way the shop writes them', () => {
    expect(formatRupiah(61500)).toBe('61.500');
    expect(formatRupiah(13500)).toBe('13.500');
    expect(formatRupiah(500)).toBe('500');
    expect(formatRupiah(0)).toBe('0');
    expect(formatRupiah(1250000)).toBe('1.250.000');
  });

  it('marks negatives with a minus that cannot be mistaken for a hyphen', () => {
    expect(formatRupiah(-2)).toBe('−2');
    expect(formatRupiah(-12500)).toBe('−12.500');
  });

  it('never prints decimals, because rupiah has none', () => {
    expect(formatRupiah(1500.4)).toBe('1.500');
  });
});

describe('cash rounding', () => {
  it('rounds to the nearest 500 by default', () => {
    expect(roundToCashStep(61350)).toBe(61500);
    expect(roundToCashStep(61500)).toBe(61500);
    expect(roundToCashStep(61101)).toBe(61500);
  });

  it('respects a configured step', () => {
    expect(roundToCashStep(61350, 100)).toBe(61400);
    expect(roundToCashStep(61350, 1000)).toBe(62000);
  });

  it('reports the adjustment as a signed line the receipt can print', () => {
    expect(roundingAdjustment(61350, 500)).toBe(150);
    expect(roundingAdjustment(61500, 500)).toBe(0);
  });
});

describe('discount', () => {
  it('handles rupiah discounts', () => {
    expect(discountAmount(61500, { kind: 'rupiah', value: 1500 })).toBe(1500);
  });

  it('handles percentage discounts', () => {
    expect(discountAmount(20000, { kind: 'percent', value: 10 })).toBe(2000);
  });

  it('clamps a discount that would exceed the sale', () => {
    expect(discountAmount(10000, { kind: 'rupiah', value: 99999 })).toBe(10000);
  });

  it('clamps a negative discount to zero', () => {
    expect(discountAmount(10000, { kind: 'rupiah', value: -500 })).toBe(0);
  });

  it('treats no discount as zero', () => {
    expect(discountAmount(10000, { kind: 'none' })).toBe(0);
  });
});

describe('line totals', () => {
  it('rounds once at the line', () => {
    expect(lineTotal({ unitPrice: 13500, qty: 2 })).toBe(27000);
  });

  it('handles fractional weight quantities', () => {
    // 13.500 x 0,25 kg
    expect(lineTotal({ unitPrice: 13500, qty: 0.25 })).toBe(3375);
  });

  it('sums to the cart subtotal without accumulating rounding error', () => {
    const lines = [
      { unitPrice: 13500, qty: 0.25 },
      { unitPrice: 13500, qty: 0.25 },
      { unitPrice: 13500, qty: 0.25 },
      { unitPrice: 13500, qty: 0.25 },
    ];
    // Each line rounds to 3375, so four lines are exactly one kg.
    expect(cartSubtotal(lines)).toBe(13500);
  });
});

describe('computeTotals', () => {
  const lines = [
    { unitPrice: 13500, qty: 2 },
    { unitPrice: 16000, qty: 1 },
    { unitPrice: 18500, qty: 1 },
  ];

  it('builds the full picture for an exact cash payment', () => {
    const totals = computeTotals({ lines, tendered: 61500 });
    expect(totals.subtotal).toBe(61500);
    expect(totals.discount).toBe(0);
    expect(totals.net).toBe(61500);
    expect(totals.rounding).toBe(0);
    expect(totals.due).toBe(61500);
    expect(totals.kembalian).toBe(0);
    expect(totals.hutang).toBe(0);
  });

  it('shows kembalian when the customer overpays', () => {
    const totals = computeTotals({ lines, tendered: 100000 });
    expect(totals.kembalian).toBe(38500);
    expect(totals.hutang).toBe(0);
  });

  it('applies the discount before rounding, so the receipt adds up', () => {
    const totals = computeTotals({
      lines: [{ unitPrice: 10020, qty: 1 }],
      discount: { kind: 'rupiah', value: 20 },
      tendered: 10000,
    });
    expect(totals.net).toBe(10000);
    expect(totals.rounding).toBe(0);
    expect(totals.due).toBe(10000);
    expect(totals.kembalian).toBe(0);
  });

  it('rounds a non-round total up to the cash step', () => {
    const totals = computeTotals({ lines: [{ unitPrice: 61350, qty: 1 }], tendered: 61500 });
    expect(totals.due).toBe(61500);
    expect(totals.rounding).toBe(150);
    expect(totals.kembalian).toBe(0);
  });

  it('turns a shortfall into hutang, never a negative kembalian', () => {
    const totals = computeTotals({ lines, tendered: 50000 });
    expect(totals.kembalian).toBe(0);
    expect(totals.hutang).toBe(11500);
  });

  it('can be told not to round, for the receipt preview', () => {
    const totals = computeTotals({ lines: [{ unitPrice: 61350, qty: 1 }], applyRounding: false });
    expect(totals.rounding).toBe(0);
    expect(totals.due).toBe(61350);
  });

  it('treats a missing payment as fully unpaid', () => {
    const totals = computeTotals({ lines });
    expect(totals.tendered).toBe(0);
    expect(totals.hutang).toBe(totals.due);
  });
});

describe('parsing what a human types', () => {
  it('accepts rupiah with separators, spaces and an Rp prefix', () => {
    expect(parseRupiah('13.500')).toBe(13500);
    expect(parseRupiah('Rp 13.500')).toBe(13500);
    expect(parseRupiah('13500')).toBe(13500);
  });

  it('refuses text that is not a number instead of reading it as zero', () => {
    expect(parseRupiah('abc')).toBeNull();
    expect(parseRupiah('')).toBeNull();
    expect(parseRupiah('13.5.0.0x')).toBeNull();
  });

  it('accepts fractional quantities in either decimal convention', () => {
    expect(parseQty('1,5')).toBe(1.5);
    expect(parseQty('1.5')).toBe(1.5);
    expect(parseQty('0,25')).toBe(0.25);
    expect(parseQty('2')).toBe(2);
  });

  it('refuses a quantity that is not a number', () => {
    expect(parseQty('satu')).toBeNull();
    expect(parseQty('')).toBeNull();
  });

  it('formats quantities with a comma and no trailing zeros', () => {
    expect(formatQty(2)).toBe('2');
    expect(formatQty(0.25)).toBe('0,25');
    expect(formatQty(1.5)).toBe('1,5');
  });
});
