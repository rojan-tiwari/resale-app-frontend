import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { SystemInfo } from '../models/system-info';

/** Backend health and build information. */
@Service()
export class SystemApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Proves the whole chain works: browser -> API -> database. */
  ping(): Observable<SystemInfo> {
    return this.http.get<SystemInfo>(`${this.baseUrl}/system/ping`);
  }
}
