import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { District, Municipality, Province } from '../models/location';

/** Structured Nepal locations (province -> district -> municipality). */
@Service()
export class LocationApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/locations`;

  provinces(): Observable<Province[]> {
    return this.http.get<Province[]>(`${this.baseUrl}/provinces`);
  }

  districts(provinceId: number): Observable<District[]> {
    return this.http.get<District[]>(`${this.baseUrl}/provinces/${provinceId}/districts`);
  }

  municipalities(districtId: number): Observable<Municipality[]> {
    return this.http.get<Municipality[]>(`${this.baseUrl}/districts/${districtId}/municipalities`);
  }
}
