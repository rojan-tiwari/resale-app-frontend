import { Pipe, PipeTransform } from '@angular/core';

export type NepalDateStyle = 'date' | 'time' | 'datetime';

/**
 * The backend stores and returns instants in UTC; users must see Nepal time (Asia/Kathmandu, UTC+05:45).
 * `{{ listing.createdAt | nepalDate }}` -> `20 Oct 2026`, `| nepalDate: 'datetime'` -> `20 Oct 2026, 2:00 pm`.
 */
@Pipe({ name: 'nepalDate' })
export class NepalDatePipe implements PipeTransform {
  private static readonly options: Record<NepalDateStyle, Intl.DateTimeFormatOptions> = {
    date: { day: 'numeric', month: 'short', year: 'numeric' },
    time: { hour: 'numeric', minute: '2-digit', hour12: true },
    datetime: { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true },
  };

  private static readonly formatters = new Map<NepalDateStyle, Intl.DateTimeFormat>();

  transform(value: string | number | Date | null | undefined, style: NepalDateStyle = 'date'): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return NepalDatePipe.formatter(style).format(date);
  }

  private static formatter(style: NepalDateStyle): Intl.DateTimeFormat {
    let formatter = NepalDatePipe.formatters.get(style);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-GB', { ...NepalDatePipe.options[style], timeZone: 'Asia/Kathmandu' });
      NepalDatePipe.formatters.set(style, formatter);
    }
    return formatter;
  }
}
