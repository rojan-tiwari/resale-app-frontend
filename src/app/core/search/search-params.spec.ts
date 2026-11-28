import { convertToParamMap } from '@angular/router';
import { SearchParams } from '../models/search';
import { activeFilterCount, parseSearchParams, toQueryParams } from './search-params';

const parse = (params: Record<string, string | string[]>) =>
  parseSearchParams(convertToParamMap(params));

describe('parseSearchParams', () => {
  it('reads nothing from an empty address', () => {
    expect(parse({})).toEqual({});
  });

  it('reads every kind of parameter', () => {
    expect(
      parse({
        q: 'iphone 13',
        categoryId: '1',
        subcategoryId: '15',
        minPrice: '5000',
        maxPrice: '90000.5',
        condition: ['GOOD', 'LIKE_NEW'],
        provinceId: '3',
        districtId: '30',
        municipalityId: '1',
        negotiable: 'true',
        postedWithinDays: '7',
        sort: 'priceAsc',
        page: '2',
      }),
    ).toEqual({
      q: 'iphone 13',
      categoryId: 1,
      subcategoryId: 15,
      minPrice: 5000,
      maxPrice: 90000.5,
      condition: ['GOOD', 'LIKE_NEW'],
      provinceId: 3,
      districtId: 30,
      municipalityId: 1,
      negotiable: true,
      postedWithinDays: 7,
      sort: 'priceAsc',
      page: 2,
    });
  });

  it('trims the keyword and treats a blank one as none', () => {
    expect(parse({ q: '  laptop  ' }).q).toBe('laptop');
    expect(parse({ q: '   ' }).q).toBeUndefined();
  });

  it('ignores values that make no sense instead of failing: the address can be edited by anybody', () => {
    const params = parse({
      categoryId: 'abc',
      subcategoryId: '-3',
      minPrice: '-1',
      maxPrice: 'NaN',
      provinceId: '1.5',
      districtId: '0',
      postedWithinDays: 'x',
      sort: 'cheapest',
      page: '-1',
      negotiable: 'yes',
    });

    expect(params).toEqual({});
  });

  it('accepts conditions repeated, comma separated, in any case, once each, and drops unknown ones', () => {
    expect(parse({ condition: ['good', 'NEW,fair', 'GOOD', 'BROKEN'] }).condition).toEqual([
      'GOOD',
      'NEW',
      'FAIR',
    ]);
    expect(parse({ condition: 'BROKEN' }).condition).toBeUndefined();
  });

  it('keeps a page of 0 and a price of 0', () => {
    expect(parse({ page: '0', minPrice: '0' })).toEqual({ page: 0, minPrice: 0 });
  });

  it('knows only the four sorts', () => {
    for (const sort of ['relevance', 'newest', 'priceAsc', 'priceDesc']) {
      expect(parse({ sort }).sort).toBe(sort);
    }
    expect(parse({ sort: 'PRICEASC' }).sort).toBeUndefined();
  });
});

describe('toQueryParams', () => {
  it('writes only what is set', () => {
    expect(toQueryParams({})).toEqual({});
    expect(
      toQueryParams({
        q: 'phone',
        categoryId: 1,
        minPrice: 0,
        negotiable: true,
        condition: ['NEW'],
      }),
    ).toEqual({
      q: 'phone',
      categoryId: 1,
      minPrice: 0,
      negotiable: true,
      condition: ['NEW'],
    });
  });

  it('leaves out the default sort (relevance with a keyword, newest without) and the first page', () => {
    expect(toQueryParams({ q: 'phone', sort: 'relevance', page: 0 })).toEqual({ q: 'phone' });
    expect(toQueryParams({ sort: 'newest' })).toEqual({});
    expect(toQueryParams({ q: 'phone', sort: 'newest' })).toEqual({ q: 'phone', sort: 'newest' });
    expect(toQueryParams({ sort: 'priceDesc', page: 3 })).toEqual({ sort: 'priceDesc', page: 3 });
  });

  it('leaves out a false negotiable flag and an empty list of conditions', () => {
    expect(toQueryParams({ negotiable: false, condition: [] })).toEqual({});
  });

  it('round-trips: what is written is read back the same', () => {
    const original: SearchParams = {
      q: 'samsung phone',
      categoryId: 1,
      subcategoryId: 15,
      minPrice: 1000,
      maxPrice: 50000,
      condition: ['GOOD', 'FAIR'],
      provinceId: 3,
      districtId: 30,
      municipalityId: 1,
      negotiable: true,
      postedWithinDays: 30,
      sort: 'priceDesc',
      page: 4,
    };

    // The router writes every value into the address as text; this does the same before reading it back.
    const inAddress = Object.fromEntries(
      Object.entries(toQueryParams(original)).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : String(value),
      ]),
    );

    expect(parse(inAddress)).toEqual(original);
  });
});

describe('activeFilterCount', () => {
  it('counts filters, not the keyword, sort or page', () => {
    expect(activeFilterCount({ q: 'phone', sort: 'priceAsc', page: 3 })).toBe(0);
    expect(
      activeFilterCount({
        categoryId: 1,
        minPrice: 5,
        maxPrice: 9,
        provinceId: 3,
        negotiable: true,
        postedWithinDays: 7,
      }),
    ).toBe(6);
  });

  it('counts the conditions as one filter however many are chosen', () => {
    expect(activeFilterCount({ condition: ['NEW', 'GOOD', 'FAIR'] })).toBe(1);
    expect(activeFilterCount({ condition: [] })).toBe(0);
  });
});
