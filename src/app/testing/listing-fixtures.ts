import { Listing, ListingImage, ListingSummary } from '../core/models/listing';
import { PublicUser } from '../core/models/user';

/** Ready-made API answers for specs: one place to keep them in step with the backend DTOs. */

export const SELLER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
export const LISTING_ID = '0b8f0a54-6a52-4d3c-9f43-0a3d4a8d6c11';

export function photo(id = 'img-1', position = 0): ListingImage {
  return {
    id,
    url: `/api/v1/listings/${LISTING_ID}/images/${id}`,
    width: 640,
    height: 480,
    position,
    primary: position === 0,
  };
}

export const seller: PublicUser = {
  id: SELLER_ID,
  displayName: 'Sita Sharma',
  bio: null,
  memberSince: '2026-10-20T08:15:00Z',
  location: { province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu' },
  phone: null,
};

export function summary(overrides: Partial<ListingSummary> = {}): ListingSummary {
  return {
    id: LISTING_ID,
    title: 'iPhone 13, 128 GB',
    price: 85000,
    currency: 'NPR',
    priceType: 'NEGOTIABLE',
    condition: 'LIKE_NEW',
    status: 'ACTIVE',
    category: { id: 1, name: 'Mobiles & Tablets', slug: 'mobiles-tablets' },
    subcategory: { id: 15, name: 'Mobile Phones', slug: 'mobile-phones' },
    location: { province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu' },
    locality: 'Baneshwor',
    primaryImage: photo(),
    featured: false,
    createdAt: '2026-10-20T08:15:00Z',
    publishedAt: '2026-10-21T08:15:00Z',
    ...overrides,
  };
}

export function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: LISTING_ID,
    title: 'iPhone 13, 128 GB',
    description: 'Bought last year.\nBattery health 91%.',
    price: 85000,
    currency: 'NPR',
    priceType: 'NEGOTIABLE',
    condition: 'LIKE_NEW',
    status: 'ACTIVE',
    rejectionReason: null,
    category: { id: 1, name: 'Mobiles & Tablets', slug: 'mobiles-tablets' },
    subcategory: { id: 15, name: 'Mobile Phones', slug: 'mobile-phones' },
    provinceId: 3,
    districtId: 30,
    municipalityId: 1,
    location: { province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu' },
    locality: 'Baneshwor',
    featured: false,
    viewCount: 12,
    images: [photo('img-1', 0), photo('img-2', 1)],
    seller,
    allowedStatuses: [],
    createdAt: '2026-10-20T08:15:00Z',
    updatedAt: '2026-10-21T08:15:00Z',
    publishedAt: '2026-10-21T08:15:00Z',
    soldAt: null,
    ...overrides,
  };
}

/** An empty page, as the API sends it for a list with nothing in it. */
export function pageOf<T>(
  content: readonly T[],
  extra: { page?: number; totalPages?: number; totalElements?: number } = {},
) {
  const page = extra.page ?? 0;
  const totalPages = extra.totalPages ?? (content.length > 0 ? 1 : 0);
  return {
    content,
    page,
    size: 12,
    totalElements: extra.totalElements ?? content.length,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
  };
}
