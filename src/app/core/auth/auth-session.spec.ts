import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { problemDetailInterceptor } from '../interceptors/problem-detail.interceptor';
import { ApiError } from '../models/api-error';
import { AuthResponse } from '../models/auth';
import { User } from '../models/user';
import { AuthSession } from './auth-session';

const LOGIN_URL = '/api/v1/auth/login';
const REFRESH_URL = '/api/v1/auth/refresh';
const LOGOUT_URL = '/api/v1/auth/logout';

const sita: User = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  email: 'sita@example.com',
  displayName: 'Sita Sharma',
  phone: null,
  createdAt: '2026-10-20T08:15:00Z',
  roles: ['ROLE_USER'],
};

const session = (accessToken: string): AuthResponse => ({
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: sita,
});

const expired = {
  body: {
    title: 'Unauthorized',
    status: 401,
    detail: 'Your session has expired. Please sign in again.',
    code: 'UNAUTHORIZED',
  },
  init: { status: 401, statusText: 'Unauthorized' },
};

describe('AuthSession', () => {
  let auth: AuthSession;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthSession);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('starts without knowing who is signed in', () => {
    expect(auth.status()).toBe('unknown');
    expect(auth.user()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  describe('login', () => {
    it('posts the credentials and keeps the access token and the user in memory', () => {
      let signedIn: User | undefined;
      auth
        .login({ email: 'sita@example.com', password: ' pass word ' })
        .subscribe((user) => (signedIn = user));

      const request = controller.expectOne(LOGIN_URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ email: 'sita@example.com', password: ' pass word ' });
      request.flush(session('access-1'));

      expect(signedIn).toEqual(sita);
      expect(auth.status()).toBe('authenticated');
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.user()).toEqual(sita);
      expect(auth.accessToken()).toBe('access-1');
    });

    it('changes nothing when the credentials are wrong, and passes the error on', () => {
      let caught: unknown;
      auth
        .login({ email: 'sita@example.com', password: 'wrong' })
        .subscribe({ error: (e: unknown) => (caught = e) });

      controller
        .expectOne(LOGIN_URL)
        .flush(
          { title: 'Unauthorized', status: 401, detail: 'Invalid email or password.' },
          expired.init,
        );

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).message).toBe('Invalid email or password.');
      expect(auth.status()).toBe('unknown');
      expect(auth.accessToken()).toBeNull();
    });

    it('never writes the token to web storage or a cookie', () => {
      auth.login({ email: 'sita@example.com', password: 'correct horse' }).subscribe();
      controller.expectOne(LOGIN_URL).flush(session('secret-access-token'));

      for (const storage of [localStorage, sessionStorage]) {
        expect(storage.length).toBe(0);
        expect(JSON.stringify(storage)).not.toContain('secret-access-token');
      }
      expect(document.cookie).not.toContain('secret-access-token');
    });
  });

  describe('restore', () => {
    it('asks the server once, with the custom header, and signs in when the cookie holds a session', () => {
      auth.restore();
      auth.restore();

      const request = controller.expectOne(REFRESH_URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
      request.flush(session('restored'));

      expect(auth.status()).toBe('authenticated');
      expect(auth.user()).toEqual(sita);
      expect(auth.accessToken()).toBe('restored');
    });

    it('settles on anonymous when there is no session', () => {
      auth.restore();
      controller.expectOne(REFRESH_URL).flush(expired.body, expired.init);

      expect(auth.status()).toBe('anonymous');
      expect(auth.user()).toBeNull();
      expect(auth.accessToken()).toBeNull();
    });

    it('settles on anonymous when the server cannot be reached', () => {
      auth.restore();
      controller
        .expectOne(REFRESH_URL)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(auth.status()).toBe('anonymous');
    });
  });

  describe('refresh', () => {
    function signIn(token = 'access-1'): void {
      auth.login({ email: 'sita@example.com', password: 'correct horse' }).subscribe();
      controller.expectOne(LOGIN_URL).flush(session(token));
    }

    it('shares one request between overlapping callers and gives each the new token', () => {
      signIn();
      const tokens: string[] = [];

      auth.refresh().subscribe((token) => tokens.push(token));
      auth.refresh().subscribe((token) => tokens.push(token));
      controller.expectOne(REFRESH_URL).flush(session('access-2'));

      expect(tokens).toEqual(['access-2', 'access-2']);
      expect(auth.accessToken()).toBe('access-2');
    });

    it('sends a new request once the previous one has finished', () => {
      signIn();

      auth.refresh().subscribe();
      controller.expectOne(REFRESH_URL).flush(session('access-2'));
      auth.refresh().subscribe();
      controller.expectOne(REFRESH_URL).flush(session('access-3'));

      expect(auth.accessToken()).toBe('access-3');
    });

    it('signs the person out when the session is over', () => {
      signIn();
      let caught: unknown;

      auth.refresh().subscribe({ error: (e: unknown) => (caught = e) });
      controller.expectOne(REFRESH_URL).flush(expired.body, expired.init);

      expect((caught as ApiError).isUnauthorized).toBe(true);
      expect(auth.status()).toBe('anonymous');
      expect(auth.user()).toBeNull();
      expect(auth.accessToken()).toBeNull();
    });

    it('keeps the session when the server merely cannot be reached', () => {
      signIn();

      auth.refresh().subscribe({ error: () => undefined });
      controller
        .expectOne(REFRESH_URL)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(auth.status()).toBe('authenticated');
      expect(auth.accessToken()).toBe('access-1');
    });
  });

  describe('logout', () => {
    it('clears the session at once and tells the server', () => {
      auth.login({ email: 'sita@example.com', password: 'correct horse' }).subscribe();
      controller.expectOne(LOGIN_URL).flush(session('access-1'));
      let finished = false;

      auth.logout().subscribe({ complete: () => (finished = true) });

      expect(auth.status()).toBe('anonymous');
      expect(auth.user()).toBeNull();
      expect(auth.accessToken()).toBeNull();
      const request = controller.expectOne(LOGOUT_URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
      request.flush(null, { status: 204, statusText: 'No Content' });
      expect(finished).toBe(true);
    });

    it('ignores a failing server call', () => {
      auth.login({ email: 'sita@example.com', password: 'correct horse' }).subscribe();
      controller.expectOne(LOGIN_URL).flush(session('access-1'));
      let failed = false;

      auth.logout().subscribe({ error: () => (failed = true) });
      controller
        .expectOne(LOGOUT_URL)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(failed).toBe(false);
      expect(auth.status()).toBe('anonymous');
    });
  });

  describe('whenResolved', () => {
    it('waits for the answer, then emits, and starts the restore itself', () => {
      let resolved = false;
      auth.whenResolved().subscribe(() => (resolved = true));
      expect(resolved).toBe(false);

      controller.expectOne(REFRESH_URL).flush(expired.body, expired.init);

      expect(resolved).toBe(true);
    });

    it('emits immediately once the session is known', () => {
      auth.restore();
      controller.expectOne(REFRESH_URL).flush(session('access-1'));
      let resolved = false;

      auth.whenResolved().subscribe(() => (resolved = true));

      expect(resolved).toBe(true);
    });
  });
});
