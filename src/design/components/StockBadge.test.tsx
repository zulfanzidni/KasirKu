import { render, screen } from '@testing-library/react-native';
import { stockStatus, StockBadge } from './StockBadge';

describe('stockStatus', () => {
  it('treats never-counted as its own state, not as zero', () => {
    expect(stockStatus(null)).toBe('unknown');
    expect(stockStatus(0)).toBe('out');
  });

  it('flags negative before anything else', () => {
    expect(stockStatus(-2, 5)).toBe('negative');
  });

  it('flags low only against a minimum that is set', () => {
    expect(stockStatus(3, 5)).toBe('low');
    expect(stockStatus(3, null)).toBe('ok');
    expect(stockStatus(5, 5)).toBe('ok');
  });
});

describe('StockBadge', () => {
  it('reads "Belum dihitung" for a variant nobody has counted', () => {
    render(<StockBadge qty={null} />);
    expect(screen.getByText('Belum dihitung')).toBeTruthy();
    expect(screen.queryByText('Habis')).toBeNull();
  });

  it('shows the number, not just a status', () => {
    render(<StockBadge qty={24} />);
    expect(screen.getByText('24')).toBeTruthy();
  });

  it('names the state in words so colour is never the only signal', () => {
    render(<StockBadge qty={2} minimum={5} />);
    expect(screen.getByText('Rendah')).toBeTruthy();
  });

  it('uses a comma for fractional stock', () => {
    render(<StockBadge qty={12.5} />);
    expect(screen.getByText('12,5')).toBeTruthy();
  });

  it('asks for a recount when stock has gone negative', () => {
    render(<StockBadge qty={-2} />);
    expect(screen.getByText('Hitung ulang')).toBeTruthy();
  });
});
