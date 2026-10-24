import { HttpErrorResponse } from '@angular/common/http';

/** A single validation problem, as returned by the backend in `errors`. */
export interface FieldError {
  readonly field: string;
  readonly message: string;
}

/** RFC 9457 "problem details" body produced by the backend, plus our `code`, `errors` and `traceId` extensions. */
export interface ProblemDetail {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  /** Stable machine-readable code, e.g. `LISTING_NOT_FOUND`. Never shown to users. */
  readonly code?: string;
  readonly errors?: readonly FieldError[];
  readonly traceId?: string;
}

interface ApiErrorInit {
  readonly status: number;
  readonly title: string;
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: readonly FieldError[];
  readonly traceId?: string;
}

/**
 * The single error type the UI deals with. Every failed HTTP call is converted to this by
 * `problemDetailInterceptor`, so components never inspect raw `HttpErrorResponse`s.
 */
export class ApiError extends Error {
  /** HTTP status; 0 when the server could not be reached, -1 for non-HTTP errors. */
  readonly status: number;
  readonly title: string;
  readonly code: string | undefined;
  readonly fieldErrors: readonly FieldError[];
  readonly traceId: string | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.title = init.title;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? [];
    this.traceId = init.traceId;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Message for a specific form field, if the server reported one. */
  fieldMessage(field: string): string | undefined {
    return this.fieldErrors.find((e) => e.field === field)?.message;
  }
}

function isProblemDetail(body: unknown): body is ProblemDetail {
  return typeof body === 'object' && body !== null && ('title' in body || 'status' in body || 'detail' in body);
}

/** Normalises anything thrown by an HTTP call into an {@link ApiError}. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiError({
        status: 0,
        title: 'Network error',
        message: 'Cannot reach the server. Check your connection and try again.',
        code: 'NETWORK_ERROR',
      });
    }

    const body: unknown = error.error;
    if (isProblemDetail(body)) {
      return new ApiError({
        status: body.status ?? error.status,
        title: body.title ?? error.statusText,
        message: body.detail ?? body.title ?? error.message,
        ...(body.code !== undefined && { code: body.code }),
        ...(body.errors !== undefined && { fieldErrors: body.errors }),
        ...(body.traceId !== undefined && { traceId: body.traceId }),
      });
    }

    return new ApiError({
      status: error.status,
      title: error.statusText || 'Request failed',
      message: `The server responded with status ${error.status}.`,
      code: `HTTP_${error.status}`,
    });
  }

  return new ApiError({
    status: -1,
    title: 'Unexpected error',
    message: error instanceof Error ? error.message : 'Something went wrong.',
    code: 'UNEXPECTED',
  });
}
