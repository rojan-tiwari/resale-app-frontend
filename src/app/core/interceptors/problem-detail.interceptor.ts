import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '../models/api-error';

/**
 * Converts every failed HTTP response (RFC 9457 problem details, plain-text proxy errors, network failures)
 * into a typed `ApiError`, so the rest of the app has exactly one error shape to handle.
 *
 * Phase 2 adds `authInterceptor` (bearer token + refresh-on-401) in front of this one.
 */
export const problemDetailInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
