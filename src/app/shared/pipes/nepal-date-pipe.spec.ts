import { NepalDatePipe } from './nepal-date-pipe';

describe('NepalDatePipe', () => {
  const pipe = new NepalDatePipe();

  it('converts UTC instants to Nepal time (UTC+05:45)', () => {
    // 08:15 UTC + 5h45m = 14:00 in Kathmandu
    expect(pipe.transform('2026-10-20T08:15:00Z', 'time')).toMatch(/^2:00\spm$/i);
  });

  it('rolls the date over when Nepal time is already the next day', () => {
    // 20:30 UTC on 20 Oct is 02:15 on 21 Oct in Nepal
    expect(pipe.transform('2026-10-20T20:30:00Z')).toBe('21 Oct 2026');
  });

  it('formats date and time together', () => {
    expect(pipe.transform('2026-10-20T08:15:00Z', 'datetime')).toMatch(/^20 Oct 2026,\s2:00\spm$/i);
  });

  it('accepts Date objects and epoch milliseconds', () => {
    expect(pipe.transform(new Date('2026-01-01T00:00:00Z'))).toBe('1 Jan 2026');
    expect(pipe.transform(Date.UTC(2026, 0, 1, 0, 0, 0))).toBe('1 Jan 2026');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('not a date')).toBe('');
  });
});
