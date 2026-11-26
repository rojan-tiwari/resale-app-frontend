import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import {
  Listing,
  ListingImage,
  ListingRequest,
  ListingStatus,
  ListingStatusRequest,
  ListingSummary,
} from '../models/listing';
import { Page } from '../models/page';
import { Recommendations, SearchParams } from '../models/search';

export interface PageOptions {
  /** Zero-based page index. */
  readonly page?: number;
  readonly size?: number;
}

/**
 * Listings and their photos. HTTP only: who may do what is decided by the server, which answers 401 / 403 / 404 / 422; the
 * pages only decide what to show.
 */
@Service()
export class ListingApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiBase}/listings`;

  /** Creates a draft. Fails with 400 and `fieldErrors` when a field or the category / place is wrong. */
  create(request: ListingRequest): Observable<Listing> {
    return this.http.post<Listing>(this.baseUrl, request);
  }

  /** One listing. 404 for one the caller may not see (a draft of someone else, or one that is not live). */
  get(id: string): Observable<Listing> {
    return this.http.get<Listing>(this.url(id));
  }

  /** Replaces the content of the caller's own listing. 403 for someone else's, 422 when its status is frozen. */
  update(id: string, request: ListingRequest): Observable<Listing> {
    return this.http.put<Listing>(this.url(id), request);
  }

  /** Takes a listing down (archives it). Repeating it is fine. */
  archive(id: string): Observable<void> {
    return this.http.delete<void>(this.url(id));
  }

  /** Moves a listing to another status; 422 when the state machine does not allow it. */
  changeStatus(id: string, request: ListingStatusRequest): Observable<Listing> {
    return this.http.patch<Listing>(`${this.url(id)}/status`, request);
  }

  /** The caller's own listings, newest first. Archived ones are left out unless `status` is `ARCHIVED`. */
  mine(
    options: PageOptions & { readonly status?: ListingStatus | null } = {},
  ): Observable<Page<ListingSummary>> {
    let params = this.pageParams(options);
    if (options.status) {
      params = params.set('status', options.status);
    }
    return this.http.get<Page<ListingSummary>>(`${this.baseUrl}/mine`, { params });
  }

  /** A member's live listings, newest first. 404 for an unknown, suspended or deleted member. */
  ofSeller(userId: string, options: PageOptions = {}): Observable<Page<ListingSummary>> {
    return this.http.get<Page<ListingSummary>>(
      `${this.apiBase}/users/${encodeURIComponent(userId)}/listings`,
      {
        params: this.pageParams(options),
      },
    );
  }

  /**
   * Public search. Only what is set is sent (blank values would mean "not given" anyway). The keyword searches whole words in the title
   * and description and parts of title words; every other field narrows the result, and they all combine.
   */
  search(params: SearchParams = {}): Observable<Page<ListingSummary>> {
    let query = new HttpParams();
    const text = (name: string, value: string | number | undefined) => {
      if (value !== undefined && value !== '') {
        query = query.set(name, value);
      }
    };
    text('q', params.q);
    text('categoryId', params.categoryId);
    text('subcategoryId', params.subcategoryId);
    text('minPrice', params.minPrice);
    text('maxPrice', params.maxPrice);
    for (const condition of params.condition ?? []) {
      query = query.append('condition', condition);
    }
    text('provinceId', params.provinceId);
    text('districtId', params.districtId);
    text('municipalityId', params.municipalityId);
    if (params.negotiable) {
      query = query.set('negotiable', true);
    }
    text('postedWithinDays', params.postedWithinDays);
    text('sort', params.sort);
    text('page', params.page);
    text('size', params.size);
    return this.http.get<Page<ListingSummary>>(this.baseUrl, { params: query });
  }

  /** Listings whose promotion is running (the home page's "featured"). */
  featured(limit = 8): Observable<ListingSummary[]> {
    return this.http.get<ListingSummary[]>(`${this.baseUrl}/featured`, { params: { limit } });
  }

  /** The newest live listings. */
  recent(limit = 8): Observable<ListingSummary[]> {
    return this.http.get<ListingSummary[]>(`${this.baseUrl}/recent`, { params: { limit } });
  }

  /** The home page's recommended ads, and the rule that picked them (it depends on who is signed in). */
  recommended(limit = 8): Observable<Recommendations> {
    return this.http.get<Recommendations>(`${this.baseUrl}/recommended`, { params: { limit } });
  }

  /** Live listings like this one. The server keeps `limit` between 1 and 24. */
  similar(id: string, limit = 8): Observable<ListingSummary[]> {
    return this.http.get<ListingSummary[]>(`${this.url(id)}/similar`, { params: { limit } });
  }

  /**
   * Adds photos to the end of the gallery (all or nothing) and returns the whole gallery. The browser sets the multipart
   * `Content-Type` itself, with the boundary, so it must not be set here.
   */
  uploadImages(id: string, files: readonly File[]): Observable<ListingImage[]> {
    const body = new FormData();
    for (const file of files) {
      body.append('images', file, file.name);
    }
    return this.http.post<ListingImage[]>(`${this.url(id)}/images`, body);
  }

  /** Removes a photo; returns the gallery that is left, with the photos behind it moved up. */
  deleteImage(id: string, imageId: string): Observable<ListingImage[]> {
    return this.http.delete<ListingImage[]>(
      `${this.url(id)}/images/${encodeURIComponent(imageId)}`,
    );
  }

  /** Puts the photos in this order (every photo id exactly once); the first becomes the main photo. */
  reorderImages(id: string, imageIds: readonly string[]): Observable<ListingImage[]> {
    return this.http.put<ListingImage[]>(`${this.url(id)}/images/order`, { imageIds });
  }

  private url(id: string): string {
    return `${this.baseUrl}/${encodeURIComponent(id)}`;
  }

  private pageParams(options: PageOptions): HttpParams {
    let params = new HttpParams();
    if (options.page !== undefined) {
      params = params.set('page', options.page);
    }
    if (options.size !== undefined) {
      params = params.set('size', options.size);
    }
    return params;
  }
}
