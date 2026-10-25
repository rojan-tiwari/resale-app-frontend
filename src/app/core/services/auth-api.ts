import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { RegisterRequest } from '../models/auth';
import { User } from '../models/user';

/** Account registration (login, refresh and logout join this service as Phase 2 grows). */
@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/auth`;

  /**
   * Creates an account. Fails with an `ApiError` of status 409 when the email is already registered and
   * status 400 (with `fieldErrors`) when the input is invalid. It does not sign the user in.
   */
  register(request: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register`, request);
  }
}
