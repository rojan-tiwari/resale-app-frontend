import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '../auth/auth-session';
import { API_BASE_URL } from '../config/api-config';
import { ApiError } from '../models/api-error';
import { AuthResponse } from '../models/auth';
import { authInterceptor } from './auth.interceptor';
import { problemDetailInterceptor } from './problem-detail.interceptor';

const LOGIN_URL = '/api/v1/auth/login';
const REFRESH_URL = '/api/v1/auth/refresh';

const session = (accessToken: string): AuthResponse => ({
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    email: 'sita@example.com',
    displayName: 'Sita Sharma',
    phone: null,
    createdAt: '2026-10-20T08:15:00Z',
    roles: ['ROLE_USER'],
  },
});

const unauthorized = { status: 401, statusText: 'Unauthorized' };
const problem401 = {
  title: 'Unauthorized',
  status: 401,
  detail: 'Authentication is required to access this resource.',
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthSession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, problemDetailInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthSession);
  });

  afterEach(() => controller.verify());

  function signIn(token = 'access-1'): void {
    auth.login({ email: 'sita@example.com', password: 'correct horse' }).subscribe();
    controller.expectOne(LOGIN_URL).flush(session(token));
  }

  it('sends calls to the API without a token while nobody is signed in', () => {
    http.get('/api/v1/listings').subscribe();

    const request = controller.expectOne('/api/v1/listings');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('adds the access token to calls to the API', () => {
    signIn();
    http.get('/api/v1/listings').subscribe();

    const request = controller.expectOne('/api/v1/listings');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush([]);
  });

  it('keeps the token away from other servers and from other paths on this one', () => {
    signIn();
    http.get('https://other.example/api/v1/listings').subscribe();
    http.get('/somewhere-else').subscribe();
    http.get('/api/v10/listings').subscribe();

    for (const url of [
      'https://other.example/api/v1/listings',
      '/somewhere-else',
      '/api/v10/listings',
    ]) {
      const request = controller.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush([]);
    }
  });

  it('keeps the token off the authentication calls', () => {
    signIn();
    http.post('/api/v1/auth/register', {}).subscribe();

    const request = controller.expectOne('/api/v1/auth/register');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('renews an expired token once and repeats the call with the new one', () => {
    signIn();
    let result: unknown;
    http.get('/api/v1/listings').subscribe((value) => (result = value));

    const first = controller.expectOne('/api/v1/listings');
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-1');
    first.flush(problem401, unauthorized);

    controller.expectOne(REFRESH_URL).flush(session('access-2'));

    const retry = controller.expectOne('/api/v1/listings');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush(['listing']);

    expect(result).toEqual(['listing']);
    expect(auth.accessToken()).toBe('access-2');
  });

  it('shares one renewal between calls that fail at the same time', () => {
    signIn();
    const results: unknown[] = [];
    http.get('/api/v1/listings').subscribe((value) => results.push(value));
    http.get('/api/v1/favorites').subscribe((value) => results.push(value));

    controller.expectOne('/api/v1/listings').flush(problem401, unauthorized);
    controller.expectOne('/api/v1/favorites').flush(problem401, unauthorized);
    controller.expectOne(REFRESH_URL).flush(session('access-2'));

    controller.expectOne('/api/v1/listings').flush('A');
    controller.expectOne('/api/v1/favorites').flush('B');
    expect(results).toEqual(['A', 'B']);
  });

  it('signs the person out and reports the 401 when the renewal fails too', () => {
    signIn();
    let caught: unknown;
    http.get('/api/v1/listings').subscribe({ error: (e: unknown) => (caught = e) });

    controller.expectOne('/api/v1/listings').flush(problem401, unauthorized);
    controller
      .expectOne(REFRESH_URL)
      .flush(
        { title: 'Unauthorized', status: 401, detail: 'Your session has expired.' },
        unauthorized,
      );

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).isUnauthorized).toBe(true);
    expect(auth.status()).toBe('anonymous');
    controller.expectNone('/api/v1/listings');
  });

  it('does not renew again when the repeated call fails with 401 as well', () => {
    signIn();
    let caught: unknown;
    http.get('/api/v1/listings').subscribe({ error: (e: unknown) => (caught = e) });

    controller.expectOne('/api/v1/listings').flush(problem401, unauthorized);
    controller.expectOne(REFRESH_URL).flush(session('access-2'));
    controller.expectOne('/api/v1/listings').flush(problem401, unauthorized);

    expect((caught as ApiError).isUnauthorized).toBe(true);
    controller.expectNone(REFRESH_URL);
  });

  it('does not try to renew for a visitor who was never signed in', () => {
    let caught: unknown;
    http.get('/api/v1/listings').subscribe({ error: (e: unknown) => (caught = e) });

    controller.expectOne('/api/v1/listings').flush(problem401, unauthorized);

    expect((caught as ApiError).isUnauthorized).toBe(true);
    controller.expectNone(REFRESH_URL);
  });

  it('does not renew for other failures', () => {
    signIn();
    const statuses: number[] = [];
    http.get('/api/v1/a').subscribe({ error: (e: ApiError) => statuses.push(e.status) });
    http.get('/api/v1/b').subscribe({ error: (e: ApiError) => statuses.push(e.status) });

    controller
      .expectOne('/api/v1/a')
      .flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'Forbidden' });
    controller
      .expectOne('/api/v1/b')
      .flush({ title: 'Internal Server Error', status: 500 }, { status: 500, statusText: 'Error' });

    expect(statuses).toEqual([403, 500]);
    controller.expectNone(REFRESH_URL);
  });

  it('never retries a failed sign-in', () => {
    signIn();
    let caught: unknown;
    http.post('/api/v1/auth/login', {}).subscribe({ error: (e: unknown) => (caught = e) });

    controller
      .expectOne(LOGIN_URL)
      .flush(
        { title: 'Unauthorized', status: 401, detail: 'Invalid email or password.' },
        unauthorized,
      );

    expect((caught as ApiError).message).toBe('Invalid email or password.');
    controller.expectNone(REFRESH_URL);
  });
});
