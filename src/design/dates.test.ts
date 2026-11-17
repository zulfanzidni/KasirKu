import { formatMoment } from './dates';

describe('formatMoment', () => {
  // Local time, so the expected string is built from the same moment object.
  const at = new Date(2026, 10, 17, 14, 20, 5).toISOString();

  it('writes a moment the way the shop does, with the year', () => {
    expect(formatMoment(at)).toBe('17/11/2026 14.20');
  });

  it('drops the year only when the list already carries it', () => {
    expect(formatMoment(at, { withYear: false })).toBe('17/11 14.20');
  });

  it('pads a single-digit day, month, hour and minute', () => {
    expect(formatMoment(new Date(2026, 0, 5, 8, 5, 0).toISOString())).toBe('05/01/2026 08.05');
  });
});
