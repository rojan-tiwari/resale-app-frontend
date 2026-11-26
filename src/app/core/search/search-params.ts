import { ParamMap, Params } from '@angular/router';
import { ListingCondition } from '../models/listing';
import { LISTING_SORTS, ListingSort, SearchParams } from '../models/search';

const CONDITIONS: readonly ListingCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS'];

/** How many results a page of the search shows (a multiple of 2, 3 and 4, the card grid's columns). */
export const SEARCH_PAGE_SIZE = 24;

function whole(value: string | null): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
}

function amount(value: string | null): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function positive(value: string | null): number | undefined {
  const number = whole(value);
  return number !== undefined && number > 0 ? number : undefined;
}

/**
 * Reads a search from the address of the page. The address is untrusted (anyone can edit or share it): a value that does not make
 * sense is ignored instead of breaking the page, and the server validates whatever is left.
 */
export function parseSearchParams(map: ParamMap): SearchParams {
  const q = map.get('q')?.trim();
  const sort = map.get('sort');
  const conditions = map
    .getAll('condition')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is ListingCondition =>
      (CONDITIONS as readonly string[]).includes(value),
    );
  const unique = [...new Set(conditions)];

  const params: Record<string, unknown> = {
    q: q ? q : undefined,
    categoryId: positive(map.get('categoryId')),
    subcategoryId: positive(map.get('subcategoryId')),
    minPrice: amount(map.get('minPrice')),
    maxPrice: amount(map.get('maxPrice')),
    condition: unique.length > 0 ? unique : undefined,
    provinceId: positive(map.get('provinceId')),
    districtId: positive(map.get('districtId')),
    municipalityId: positive(map.get('municipalityId')),
    negotiable: map.get('negotiable') === 'true' ? true : undefined,
    postedWithinDays: positive(map.get('postedWithinDays')),
    sort:
      sort !== null && (LISTING_SORTS as readonly string[]).includes(sort)
        ? (sort as ListingSort)
        : undefined,
    page: whole(map.get('page')),
  };
  // Leave out what is not set, so the result compares and prints cleanly.
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as SearchParams;
}

/**
 * The address of a search: only what is set and differs from the default, so the usual search has a short, readable link.
 * Page 0 and the default size are left out; `relevance` is the default with a keyword and `newest` without one.
 */
export function toQueryParams(params: SearchParams): Params {
  const query: Params = {};
  if (params.q) {
    query['q'] = params.q;
  }
  const numbers: readonly (keyof SearchParams)[] = [
    'categoryId',
    'subcategoryId',
    'minPrice',
    'maxPrice',
    'provinceId',
    'districtId',
    'municipalityId',
    'postedWithinDays',
  ];
  for (const key of numbers) {
    const value = params[key];
    if (typeof value === 'number') {
      query[key] = value;
    }
  }
  if (params.condition && params.condition.length > 0) {
    query['condition'] = [...params.condition];
  }
  if (params.negotiable) {
    query['negotiable'] = true;
  }
  const defaultSort: ListingSort = params.q ? 'relevance' : 'newest';
  if (params.sort && params.sort !== defaultSort) {
    query['sort'] = params.sort;
  }
  if (params.page && params.page > 0) {
    query['page'] = params.page;
  }
  return query;
}

/** How many filters are set (not the keyword, sort or page): the number on the "Filters" button of a phone. */
export function activeFilterCount(params: SearchParams): number {
  const set = [
    params.categoryId,
    params.subcategoryId,
    params.minPrice,
    params.maxPrice,
    params.provinceId,
    params.districtId,
    params.municipalityId,
    params.postedWithinDays,
  ].filter((value) => value !== undefined).length;
  return set + (params.condition?.length ? 1 : 0) + (params.negotiable ? 1 : 0);
}
