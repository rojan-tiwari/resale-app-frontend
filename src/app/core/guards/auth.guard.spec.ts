import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable } from 'rxjs';
import { AuthSession } from '../auth/auth-session';
import { authGuard, guestGuard } from './auth.guard';

const REFRESH_URL = '/api/v1/auth/refresh';

const signedInResponse = {
  accessToken: 'access-1',
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
};

describe('route guards', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  /** Runs a guard the way the router does and collects what it answers. */
  function run(guard: CanActivateFn, url: string): { answers: (boolean | UrlTree)[] } {
    const answers: (boolean | UrlTree)[] = [];
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    result.subscribe((answer) => answers.push(answer));
    return { answers };
  }

  const signedOut = () =>
    controller.expectOne(REFRESH_URL).flush({}, { status: 401, statusText: 'Unauthorized' });
  const signedIn = () => controller.expectOne(REFRESH_URL).flush(signedInResponse);
  const serialize = (tree: boolean | UrlTree) =>
    TestBed.inject(Router).serializeUrl(tree as UrlTree);

  describe('authGuard', () => {
    it('waits until the session has been restored instead of bouncing a signed-in person', () => {
      const { answers } = run(authGuard, '/dashboard');
      expect(answers).toEqual([]);

      signedIn();

      expect(answers).toEqual([true]);
    });

    it('lets a signed-in person through', () => {
      TestBed.inject(AuthSession).restore();
      signedIn();

      expect(run(authGuard, '/dashboard').answers).toEqual([true]);
    });

    it('sends a visitor to the login page and remembers where they wanted to go', () => {
      const { answers } = run(authGuard, '/listings/new?draft=1');
      signedOut();

      expect(answers).toHaveLength(1);
      expect(serialize(answers[0])).toBe('/auth/login?returnUrl=%2Flistings%2Fnew%3Fdraft%3D1');
    });
  });

  describe('guestGuard', () => {
    it('lets a visitor see the login and registration pages', () => {
      const { answers } = run(guestGuard, '/auth/login');
      signedOut();

      expect(answers).toEqual([true]);
    });

    it('sends a signed-in person home', () => {
      const { answers } = run(guestGuard, '/auth/login');
      signedIn();

      expect(answers).toHaveLength(1);
      expect(serialize(answers[0])).toBe('/');
    });
  });
});
