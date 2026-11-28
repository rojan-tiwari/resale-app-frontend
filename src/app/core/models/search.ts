import { ListingCondition, ListingSummary } from './listing';

/** How results are ordered. `relevance` only makes sense with a keyword (the server treats it as `newest` without one). */
export type ListingSort = 'relevance' | 'newest' | 'priceAsc' | 'priceDesc';

export const LISTING_SORTS: readonly ListingSort[] = [
  'relevance',
  'newest',
  'priceAsc',
  'priceDesc',
];

/**
 * What a search asks for — the query parameters of `GET /api/v1/listings`. Every field is optional and they all combine. The same
 * names are used in the address of the search page, so a search is a link that can be shared.
 */
export interface SearchParams {
  readonly q?: string;
  readonly categoryId?: number;
  readonly subcategoryId?: number;
  /** In NPR. */
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly condition?: readonly ListingCondition[];
  readonly provinceId?: number;
  readonly districtId?: number;
  readonly municipalityId?: number;
  /** Only negotiable prices. */
  readonly negotiable?: boolean;
  /** Only listings that went live in the last this many days. */
  readonly postedWithinDays?: number;
  readonly sort?: ListingSort;
  /** Zero-based. */
  readonly page?: number;
  readonly size?: number;
}

/** A saved listing — mirrors the backend `FavoriteResponse`. */
export interface FavoriteItem {
  readonly listingId: string;
  /** ISO-8601 instant in UTC. */
  readonly savedAt: string;
  /** True while the ad is live. */
  readonly available: boolean;
  /** The card: present while live and for an ad that sold (`status` SOLD); null for an ad that was taken down. */
  readonly listing: ListingSummary | null;
}

/** Which rule picked the recommended ads. */
export type RecommendationBasis = 'FAVOURITE_CATEGORIES' | 'POPULAR';

/** The home page's recommended list — mirrors the backend `RecommendationsResponse`. */
export interface Recommendations {
  readonly basis: RecommendationBasis;
  readonly listings: readonly ListingSummary[];
}
