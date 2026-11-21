import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '../models/auth';
import { User } from '../models/user';

/**
 * Sent on the two calls that are authenticated by the refresh-token cookie. A cross-site form or image request cannot
 * add a custom header, so the server refuses those calls without it (CSRF defence on top of the cookie's SameSite).
 */
const REQUESTED_WITH = new HttpHeaders({ 'X-Requested-With': 'XMLHttpRequest' });

/**
 * Registration, sign-in, session renewal and sign-out. This is only the HTTP layer; the signed-in state lives in
 * `AuthSession`. The refresh-token cookie needs no code here: the API is on the same origin (see `apiBaseUrl`), so the
 * browser stores it and sends it by itself.
 */
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

  /**
   * Signs in. Fails with status 401 for an unknown email or a wrong password (the same answer for both),
   * 403 when the password is right but the account is suspended, and 400 for missing fields.
   */
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, request);
  }

  /** Exchanges the refresh-token cookie for a new access token. Fails with 401 when there is no valid session. */
  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, null, {
      headers: REQUESTED_WITH,
    });
  }

  /** Ends the session on the server and clears the cookie. Always succeeds, even without a session. */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, null, { headers: REQUESTED_WITH });
  }

  /**
   * Ends every session of the signed-in person, on every device. Unlike `logout` this is a protected call: the
   * interceptor adds the access token, and it fails with 401 when there is none.
   */
  logoutAll(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout-all`, null);
  }

  /**
   * Asks for a password-reset link to be e-mailed. The server answers the same (202) whether or not the address has an
   * account, so this never says who is registered. Fails with 400 for a malformed address and 429 when asked too often.
   */
  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/forgot-password`, request);
  }

  /**
   * Sets a new password with the token from the e-mailed link and ends every session of the account. Fails with 400
   * and code `INVALID_TOKEN` when the link is unknown, used or expired, with 400 (and `fieldErrors`) for a weak password.
   */
  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reset-password`, request);
  }
}
