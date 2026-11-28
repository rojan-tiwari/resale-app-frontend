import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { ChangePasswordRequest } from '../models/auth';
import { PublicUser, UpdateProfileRequest, User } from '../models/user';

/** The signed-in person's own profile and password, and the public profile of any member. HTTP only: the signed-in state lives in `AuthSession`. */
@Service()
export class UserApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/users`;

  /** Own account, with the private fields. Needs a signed-in person. */
  me(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`);
  }

  /**
   * Saves the profile form (the whole profile is replaced). Fails with 400 and `fieldErrors` for invalid input or a
   * location that does not fit together, and with 409 when the profile was changed elsewhere in the meantime.
   */
  updateMe(request: UpdateProfileRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/me`, request);
  }

  /**
   * Changes the password. On success the server has ended every session of the account, this one included. Fails with
   * 400 and a field error on `currentPassword` when it is wrong (never a 401), and with 429 when tried too often.
   */
  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/me/password`, request);
  }

  /** What anyone may see about a member. 404 for an unknown, suspended or deleted member. */
  publicProfile(id: string): Observable<PublicUser> {
    return this.http.get<PublicUser>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
