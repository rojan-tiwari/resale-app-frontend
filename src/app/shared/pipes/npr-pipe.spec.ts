import { NprPipe } from './npr-pipe';

describe('NprPipe', () => {
  const pipe = new NprPipe();

  it('uses South-Asian digit grouping (lakh / crore)', () => {
    expect(pipe.transform(1000)).toBe('Rs. 1,000');
    expect(pipe.transform(125000)).toBe('Rs. 1,25,000');
    expect(pipe.transform(1250000)).toBe('Rs. 12,50,000');
    expect(pipe.transform(25000000)).toBe('Rs. 2,50,00,000');
  });

  it('shows two decimals only for fractional amounts', () => {
    expect(pipe.transform(1500)).toBe('Rs. 1,500');
    expect(pipe.transform(1500.5)).toBe('Rs. 1,500.50');
  });

  it('accepts numeric strings such as decimals serialised by the API', () => {
    expect(pipe.transform('85000.00')).toBe('Rs. 85,000');
  });

  it('formats zero (free items)', () => {
    expect(pipe.transform(0)).toBe('Rs. 0');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('abc')).toBe('');
  });
});
