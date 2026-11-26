import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { Category } from '../models/category';

/** The two-level category tree. Public and cached by the browser for an hour (the server says so). */
@Service()
export class CategoryApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/categories`;

  /** Active top-level categories, each with its active subcategories, in display order. */
  tree(): Observable<Category[]> {
    return this.http.get<Category[]>(this.baseUrl);
  }

  /** One category with its subcategories. 404 when it does not exist or is hidden. */
  one(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.baseUrl}/${id}`);
  }
}
