import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession } from '../auth/auth-session';
import { problemDetailInterceptor } from '../interceptors/problem-detail.interceptor';
import { Toasts } from '../notifications/toasts';
import { FavoritesStore } from './favorites-store';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

describe('FavoritesStore', () => {
  let store: FavoritesStore;
  let controller: HttpTestingController;
  let toasts: Toasts;
  let navigate: ReturnType<typeof vi.fn>;
  const authenticated = signal(false);

  function setUp(): void {
    authenticated.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { isAuthenticated: authenticated } },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(Toasts);
    const router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true) as unknown as ReturnType<
      typeof vi.fn
    >;
    store = TestBed.inject(FavoritesStore);
    TestBed.tick();
  }

  /** Signs in and answers the request for the saved ids. */
  function signIn(ids: string[] = []): void {
    authenticated.set(true);
    TestBed.tick();
    controller.expectOne('/api/v1/favorites/ids').flush(ids);
  }

  const problem = (status: number, detail: string) => ({
    body: { title: 'x', status, detail },
    init: { status, statusText: 'x' },
  });

  beforeEach(setUp);
  afterEach(() => controller.verify());

  describe('loading', () => {
    it('does nothing for a visitor: no request, no hearts filled', () => {
      expect(store.count()).toBe(0);
      expect(store.isSaved(A)).toBe(false);
      expect(store.loaded()).toBe(false);
    });

    it('loads the saved ids once the person is signed in', () => {
      signIn([A, B]);

      expect(store.isSaved(A)).toBe(true);
      expect(store.isSaved(B)).toBe(true);
      expect(store.isSaved('other')).toBe(false);
      expect(store.count()).toBe(2);
      expect(store.loaded()).toBe(true);
    });

    it('forgets everything when the person signs out', () => {
      signIn([A]);

      authenticated.set(false);
      TestBed.tick();

      expect(store.count()).toBe(0);
      expect(store.isSaved(A)).toBe(false);
      expect(store.loaded()).toBe(false);
    });

    it('loads again for the next person who signs in on the same screen', () => {
      signIn([A]);
      authenticated.set(false);
      TestBed.tick();

      signIn([B]);

      expect(store.isSaved(A)).toBe(false);
      expect(store.isSaved(B)).toBe(true);
    });

    it('stays usable, with empty hearts and no message, when the ids cannot be loaded', () => {
      authenticated.set(true);
      TestBed.tick();
      controller
        .expectOne('/api/v1/favorites/ids')
        .flush(problem(500, 'busy').body, problem(500, 'busy').init);

      expect(store.loaded()).toBe(true);
      expect(store.count()).toBe(0);
      expect(toasts.list()).toHaveLength(0);
    });
  });

  describe('saving and removing', () => {
    beforeEach(() => signIn([B]));

    it('fills the heart at once and sends the save', () => {
      store.toggle(A);

      expect(store.isSaved(A)).toBe(true);
      expect(store.isPending(A)).toBe(true);
      const call = controller.expectOne(`/api/v1/favorites/${A}`);
      expect(call.request.method).toBe('POST');
      call.flush({ listingId: A, savedAt: '2026-11-20T10:00:00Z', available: true, listing: null });

      expect(store.isSaved(A)).toBe(true);
      expect(store.isPending(A)).toBe(false);
      expect(store.count()).toBe(2);
    });

    it('empties the heart at once and sends the removal', () => {
      store.toggle(B);

      expect(store.isSaved(B)).toBe(false);
      const call = controller.expectOne(`/api/v1/favorites/${B}`);
      expect(call.request.method).toBe('DELETE');
      call.flush(null, { status: 204, statusText: 'No Content' });

      expect(store.isSaved(B)).toBe(false);
      expect(store.isPending(B)).toBe(false);
    });

    it('ignores clicks while the request is on its way, so a double click cannot save and unsave', () => {
      store.toggle(A);
      store.toggle(A);
      store.toggle(A);

      controller.expectOne(`/api/v1/favorites/${A}`).flush({});
      expect(store.isSaved(A)).toBe(true);
    });

    it('can be toggled again once the answer has come', () => {
      store.toggle(A);
      controller.expectOne(`/api/v1/favorites/${A}`).flush({});

      store.toggle(A);

      expect(store.isSaved(A)).toBe(false);
      expect(controller.expectOne(`/api/v1/favorites/${A}`).request.method).toBe('DELETE');
    });

    it('puts the heart back and says so when the ad is gone (404)', () => {
      store.toggle(A);
      const { body, init } = problem(404, 'Listing with id x was not found.');
      controller.expectOne(`/api/v1/favorites/${A}`).flush(body, init);

      expect(store.isSaved(A)).toBe(false);
      expect(store.isPending(A)).toBe(false);
      expect(toasts.list().map((t) => t.message)).toEqual(['This ad is no longer available.']);
    });

    it('keeps the heart filled, without a message, when it was already saved (409)', () => {
      store.toggle(A);
      const { body, init } = problem(409, 'This ad is already in your favourites.');
      controller.expectOne(`/api/v1/favorites/${A}`).flush(body, init);

      expect(store.isSaved(A)).toBe(true);
      expect(toasts.list()).toHaveLength(0);
    });

    it("puts the heart back and shows the server's reason when the limit is reached (422)", () => {
      store.toggle(A);
      const { body, init } = problem(
        422,
        'You can save at most 500 ads. Remove some you no longer need first.',
      );
      controller.expectOne(`/api/v1/favorites/${A}`).flush(body, init);

      expect(store.isSaved(A)).toBe(false);
      expect(toasts.list().map((t) => t.message)).toEqual([
        'You can save at most 500 ads. Remove some you no longer need first.',
      ]);
    });

    it('fills the heart again when a removal fails', () => {
      store.toggle(B);
      const { body, init } = problem(500, 'Something went wrong.');
      controller.expectOne(`/api/v1/favorites/${B}`).flush(body, init);

      expect(store.isSaved(B)).toBe(true);
      expect(toasts.list().map((t) => t.message)).toEqual(['Something went wrong.']);
    });

    it('forget takes an ad off the set without a request', () => {
      store.forget(B);

      expect(store.isSaved(B)).toBe(false);
      expect(store.count()).toBe(0);
    });
  });

  describe('a visitor who clicks a heart', () => {
    it('is told to sign in and sent to the sign-in page, which brings them back', () => {
      store.toggle(A);

      expect(store.isSaved(A)).toBe(false);
      expect(toasts.list().map((t) => t.message)).toEqual(['Sign in to save ads you like.']);
      expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: expect.any(String) },
      });
    });
  });
});
