import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, toApiError } from './api-error';

describe('toApiError', () => {
  it('maps an RFC 9457 problem detail body, including field errors', () => {
    const response = new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request',
      error: {
        title: 'Validation failed',
        status: 400,
        detail: 'One or more fields are invalid.',
        code: 'VALIDATION_FAILED',
        traceId: 'abc123',
        errors: [{ field: 'email', message: 'must be a valid email address' }],
      },
    });

    const error = toApiError(response);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.title).toBe('Validation failed');
    expect(error.message).toBe('One or more fields are invalid.');
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.traceId).toBe('abc123');
    expect(error.fieldMessage('email')).toBe('must be a valid email address');
    expect(error.fieldMessage('password')).toBeUndefined();
  });

  it('treats status 0 as a network error', () => {
    const error = toApiError(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));

    expect(error.isNetworkError).toBe(true);
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('falls back gracefully when the body is not a problem detail (e.g. a proxy error page)', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 502, statusText: 'Bad Gateway', error: 'upstream connect error' }),
    );

    expect(error.status).toBe(502);
    expect(error.title).toBe('Bad Gateway');
    expect(error.code).toBe('HTTP_502');
  });

  it('exposes convenience flags', () => {
    expect(toApiError(new HttpErrorResponse({ status: 401, error: { title: 'x', status: 401 } })).isUnauthorized).toBe(true);
    expect(toApiError(new HttpErrorResponse({ status: 403, error: { title: 'x', status: 403 } })).isForbidden).toBe(true);
    expect(toApiError(new HttpErrorResponse({ status: 404, error: { title: 'x', status: 404 } })).isNotFound).toBe(true);
  });

  it('returns an existing ApiError unchanged and wraps unknown values', () => {
    const existing = new ApiError({ status: 409, title: 'Conflict', message: 'duplicate' });

    expect(toApiError(existing)).toBe(existing);
    expect(toApiError(new Error('boom')).message).toBe('boom');
    expect(toApiError('weird').code).toBe('UNEXPECTED');
  });
});
