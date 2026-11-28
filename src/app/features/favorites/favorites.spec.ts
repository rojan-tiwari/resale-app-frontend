import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { FavoriteItem } from '../../core/models/search';
import { Toasts } from '../../core/notifications/toasts';
import { FavoritesStub, provideFavoritesStub } from '../../testing/favorites-stub';
import { pageOf, summary } from '../../testing/listing-fixtures';
import { Favorites } from './favorites';

const item = (id: string, title: string, overrides: Partial<FavoriteItem> = {}): FavoriteItem => ({
  listingId: id,
  savedAt: '2026-11-20T10:00:00Z',
  available: true,
  listing: summary({ id, title }),
  ...overrides,
});

describe('Favorites', () => {
  let fixture: ComponentFixture<Favorites>;
  let controller: HttpTestingController;
  let toasts: Toasts;
  let stub: FavoritesStub;
  let root: HTMLElement;

  const list = (page = 0) => `/api/v1/favorites?page=${page}&size=24`;

  beforeEach(async () => {
    stub = new FavoritesStub();
    await TestBed.configureTestingModule({
      imports: [Favorites],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
        provideFavoritesStub(stub),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(Toasts);
    fixture = TestBed.createComponent(Favorites);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const removeButtons = () => Array.from(root.querySelectorAll<HTMLButtonElement>('li > button'));

  it('shows placeholders while the list loads', () => {
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    controller.expectOne(list()).flush(pageOf([]));
  });

  it('invites the person to browse when nothing is saved', () => {
    controller.expectOne(list()).flush(pageOf([]));
    fixture.detectChanges();

    expect(root.textContent).toContain('You have not saved any ads yet');
    expect(root.querySelector('a[href="/search"]')).not.toBeNull();
  });

  it('shows each saved ad as a card with a button that says which one it removes', () => {
    controller.expectOne(list()).flush(pageOf([item('a', 'Old guitar'), item('b', 'Red bike')]));
    fixture.detectChanges();

    expect(
      Array.from(root.querySelectorAll('app-listing-card h2')).map((h) => h.textContent?.trim()),
    ).toEqual(['Old guitar', 'Red bike']);
    expect(removeButtons().map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Remove Old guitar from favourites',
      'Remove Red bike from favourites',
    ]);
  });

  it('flags a sold ad with its status and says plainly that an ad taken down is gone', () => {
    controller.expectOne(list()).flush(
      pageOf([
        item('sold', 'Sold bike', {
          available: false,
          listing: summary({ id: 'sold', title: 'Sold bike', status: 'SOLD' }),
        }),
        item('gone', 'x', { available: false, listing: null }),
      ]),
    );
    fixture.detectChanges();

    expect(root.querySelector('app-listing-card .badge')?.textContent).toContain('Sold');
    expect(root.textContent).toContain('This ad is no longer available');
    expect(removeButtons().map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Remove Sold bike from favourites',
      'Remove this ad from favourites',
    ]);
    expect(root.querySelectorAll('app-listing-card')).toHaveLength(1);
  });

  it('takes an ad off the list at once, tells the store, and confirms when the server has removed it', () => {
    controller.expectOne(list()).flush(pageOf([item('a', 'Old guitar'), item('b', 'Red bike')]));
    fixture.detectChanges();
    stub.saved.set(new Set(['a', 'b']));

    removeButtons()[0]?.click();
    fixture.detectChanges();

    expect(root.querySelectorAll('app-listing-card')).toHaveLength(1);
    expect(stub.isSaved('a')).toBe(false);
    const call = controller.expectOne('/api/v1/favorites/a');
    expect(call.request.method).toBe('DELETE');
    call.flush(null, { status: 204, statusText: 'No Content' });
    expect(toasts.list().map((t) => t.message)).toEqual(['Removed from your favourites.']);
  });

  it('puts the ad back and says why when the server refuses the removal', () => {
    controller.expectOne(list()).flush(pageOf([item('a', 'Old guitar')]));
    fixture.detectChanges();

    removeButtons()[0]?.click();
    fixture.detectChanges();
    controller
      .expectOne('/api/v1/favorites/a')
      .flush(
        { title: 'Server Error', status: 500, detail: 'Try again later.' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();

    expect(root.querySelectorAll('app-listing-card')).toHaveLength(1);
    expect(toasts.list().map((t) => t.message)).toEqual(['Try again later.']);
  });

  it('pages through many saved ads', () => {
    controller
      .expectOne(list())
      .flush(pageOf([item('a', 'First page')], { totalPages: 2, totalElements: 30 }));
    fixture.detectChanges();
    expect(root.textContent).toContain('Page 1 of 2');

    Array.from(root.querySelectorAll<HTMLButtonElement>('app-pager button'))
      .find((b) => b.textContent?.trim() === 'Next')
      ?.click();
    fixture.detectChanges();
    controller
      .expectOne(list(1))
      .flush(pageOf([item('z', 'Second page')], { page: 1, totalPages: 2, totalElements: 30 }));
    fixture.detectChanges();

    expect(root.querySelector('app-listing-card h2')?.textContent).toContain('Second page');
  });

  it('explains a failure and tries again', () => {
    controller
      .expectOne(list())
      .flush(
        { title: 'Server Error', status: 500, detail: 'The list is unavailable.' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('The list is unavailable.');

    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    controller.expectOne(list()).flush(pageOf([item('a', 'Back again')]));
    fixture.detectChanges();

    expect(root.querySelector('app-listing-card h2')?.textContent).toContain('Back again');
  });
});
