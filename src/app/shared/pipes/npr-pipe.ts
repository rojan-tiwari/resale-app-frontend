import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats an amount as Nepalese Rupees using the South-Asian digit grouping people expect in Nepal
 * (`1,25,000`, not `125,000`): `{{ 1250000 | npr }}` -> `Rs. 12,50,000`.
 *
 * Whole amounts show no decimals; fractional amounts always show two.
 */
@Pipe({ name: 'npr' })
export class NprPipe implements PipeTransform {
  private static readonly whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  private static readonly fractional = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const amount = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(amount)) {
      return '';
    }
    const formatter = Number.isInteger(amount) ? NprPipe.whole : NprPipe.fractional;
    return `Rs. ${formatter.format(amount)}`;
  }
}
