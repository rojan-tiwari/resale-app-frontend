import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { FavoriteItem } from '../models/search';
import { Page } from '../models/page';

/** The signed-in person's saved listings. HTTP only: the shared state (which hearts are filled) lives in `FavoritesStore`. */
@Service()
export class FavoriteApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/favorites`;

  /** Saved listings, newest saved first. An ad that is no longer for sale is flagged (`available: false`), not left out. */
  list(page = 0, size = 24): Observable<Page<FavoriteItem>> {
    return this.http.get<Page<FavoriteItem>>(this.baseUrl, { params: { page, size } });
  }

  /** The ids of everything saved: what is needed to fill the hearts on cards. */
  ids(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/ids`);
  }

  /** Saves a live listing. 409 when it is already saved, 404 when it is not live, 422 when the limit is reached. */
  add(listingId: string): Observable<FavoriteItem> {
    return this.http.post<FavoriteItem>(`${this.baseUrl}/${encodeURIComponent(listingId)}`, null);
  }

  /** Removes a saved listing. Fine when it was not saved. */
  remove(listingId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(listingId)}`);
  }
}
