import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthSession } from '../auth/auth-session';
import { API_BASE_URL } from '../config/api-config';
import { ApiError } from '../models/api-error';

/** Calls that are identified by credentials or by the refresh cookie instead of an access token. Matched exactly: `/auth/logout-all` is not one of them. */
const TOKENLESS_AUTH_PATHS = ['/auth/register', '/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Adds the access token to calls to our own API and renews it when it has expired.
 *
 * When a call fails with 401 the token is probably out of date (it lives only 15 minutes), so the interceptor gets a new
 * one with the refresh cookie and repeats the call once. If the renewal fails too, the person is signed out and the
 * original 401 reaches the caller. The sign-in, registration, refresh and sign-out calls never carry a token and are
 * never retried: credentials or the refresh cookie identify the caller there. `/auth/logout-all` is not among them, it
 * is a protected call like any other and needs the access token.
 *
 * Must come before `problemDetailInterceptor` in the list, so that it sees failures already converted to `ApiError`.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBase = inject(API_BASE_URL);
  const session = inject(AuthSession);

  const tokenless = TOKENLESS_AUTH_PATHS.some((path) => request.url === `${apiBase}${path}`);
  if (!request.url.startsWith(`${apiBase}/`) || tokenless) {
    return next(request);
  }

  const send = (token: string | null) =>
    next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);

  const token = session.accessToken();
  return send(token).pipe(
    catchError((error: unknown) => {
      // Without a token there is nothing to renew: the caller was never signed in.
      if (token !== null && error instanceof ApiError && error.isUnauthorized) {
        return session.refresh().pipe(switchMap((fresh) => send(fresh)));
      }
      return throwError(() => error);
    }),
  );
};
