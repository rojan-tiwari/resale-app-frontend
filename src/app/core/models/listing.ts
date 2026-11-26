import { CategorySummary } from './category';
import { LocationNames, PublicUser } from './user';

/** Where a listing is in its life; the moves allowed to the signed-in person are in `Listing.allowedStatuses`. */
export type ListingStatus =
  'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'REJECTED' | 'ARCHIVED';

export type ListingCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'FOR_PARTS';

export type PriceType = 'FIXED' | 'NEGOTIABLE';

/** A listing holds at most this many photos (also enforced by the server and the database). */
export const MAX_LISTING_IMAGES = 8;

/** The largest photo the server accepts. The server checks again and its answer wins. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The picture formats the server accepts (it looks at the content, not the name). */
export const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/** One photo of a listing — mirrors the backend `ListingImageResponse`. */
export interface ListingImage {
  readonly id: string;
  /** Root-relative address of the picture (same origin as the API), usable as the `src` of an `img`. */
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
  /** Position in the gallery, starting at 0. */
  readonly position: number;
  /** The main photo shown on cards: always the one at position 0. */
  readonly primary: boolean;
}

/** A listing as shown on a card — mirrors the backend `ListingSummaryResponse`. */
export interface ListingSummary {
  readonly id: string;
  readonly title: string;
  /** NPR, up to two decimals. */
  readonly price: number;
  readonly currency: string;
  readonly priceType: PriceType;
  readonly condition: ListingCondition;
  readonly status: ListingStatus;
  readonly category: CategorySummary;
  readonly subcategory: CategorySummary | null;
  readonly location: LocationNames;
  /** Free-text area such as "Baneshwor". */
  readonly locality: string | null;
  readonly primaryImage: ListingImage | null;
  readonly featured: boolean;
  /** ISO-8601 instants in UTC. */
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

/** A listing in full — mirrors the backend `ListingResponse`. */
export interface Listing {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly currency: string;
  readonly priceType: PriceType;
  readonly condition: ListingCondition;
  readonly status: ListingStatus;
  /** Why a moderator rejected it; only sent to the seller and administrators. */
  readonly rejectionReason: string | null;
  readonly category: CategorySummary;
  readonly subcategory: CategorySummary | null;
  readonly provinceId: number;
  readonly districtId: number;
  readonly municipalityId: number | null;
  readonly location: LocationNames;
  readonly locality: string | null;
  readonly featured: boolean;
  readonly viewCount: number;
  /** In gallery order; the first is the main photo. */
  readonly images: readonly ListingImage[];
  readonly seller: PublicUser;
  /** The statuses the signed-in person may move this listing to now; empty for everyone but the seller and administrators. */
  readonly allowedStatuses: readonly ListingStatus[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  readonly soldAt: string | null;
}

/** Body of `POST /listings` and `PUT /listings/{id}` — mirrors the backend `ListingRequest`. */
export interface ListingRequest {
  readonly title: string;
  readonly description: string;
  readonly price: number;
  readonly priceType: PriceType;
  readonly condition: ListingCondition;
  readonly categoryId: number;
  readonly subcategoryId: number | null;
  readonly provinceId: number;
  readonly districtId: number;
  readonly municipalityId: number | null;
  readonly locality: string | null;
}

/** Body of `PATCH /listings/{id}/status`. `reason` is only used when an administrator rejects a listing. */
export interface ListingStatusRequest {
  readonly status: ListingStatus;
  readonly reason: string | null;
}
