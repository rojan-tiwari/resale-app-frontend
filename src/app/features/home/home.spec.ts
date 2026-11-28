import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { LocationPreference } from '../../core/location/location-preference';
import { Category } from '../../core/models/category';
import { provideFavoritesStub } from '../../testing/favorites-stub';
import { pageOf, summary } from '../../testing/listing-fixtures';
import { Home } from './home';

const phones: Category = {
  id: 15,
  parentId: 1,
  name: 'Mobile Phones',
  slug: 'mobile-phones',
  icon: null,
  description: null,
  children: [],
};
const categories: Category[] = [
  {
    id: 1,
    parentId: null,
    name: 'Mobiles & Tablets',
    slug: 'mobiles-tablets',
    icon: null,
    description: null,
    children: [phones],
  },
  {
    id: 2,
    parentId: null,
    name: 'Vehicles',
    slug: 'vehicles',
    icon: null,
    description: null,
    children: [],
  },
];

type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let controller: HttpTestingController;
  let preference: LocationPreference;
  let root: HTMLElement;
  const status = signal<SessionStatus>('anonymous');

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
        provideFavoritesStub(),
        { provide: AuthSession, useValue: { status, user: signal(null) } },
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    preference = TestBed.inject(LocationPreference);
  });

  afterEach(() => controller.verify());

  /** Builds the page and lets it start loading. A test sets up what the page depends on (the place, the session) before calling this. */
  function open(initial: SessionStatus = 'anonymous'): void {
    status.set(initial);
    fixture = TestBed.createComponent(Home);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  const featured = () => controller.expectOne('/api/v1/listings/featured?limit=8');
  const recent = () => controller.expectOne('/api/v1/listings/recent?limit=8');
  const recommended = () => controller.expectOne('/api/v1/listings/recommended?limit=8');
  const heading = (text: string) =>
    Array.from(root.querySelectorAll('h2')).find((h) => h.textContent?.includes(text));
  const titlesIn = (headingText: string) =>
    Array.from(
      heading(headingText)?.closest('section')?.querySelectorAll('app-listing-card h3') ?? [],
    ).map((h) => h.textContent?.trim());

  /** Answers everything the page asks for when it opens: nothing featured, nothing popular, unless given. */
  function answer(
    options: {
      featured?: unknown[];
      recent?: unknown[];
      recommended?: { basis: string; listings: unknown[] };
    } = {},
  ): void {
    controller.expectOne('/api/v1/categories').flush(categories);
    featured().flush(options.featured ?? []);
    recent().flush(options.recent ?? []);
    recommended().flush(options.recommended ?? { basis: 'POPULAR', listings: [] });
    fixture.detectChanges();
  }

  it('asks for what it shows: categories, featured, recent and recommended ads', () => {
    open();
    answer();

    expect(root.querySelector('h1')?.textContent).toContain('Buy and sell pre-loved things');
  });

  it('shows the categories as links to their pages', () => {
    open();
    answer();

    const links = Array.from(root.querySelectorAll('#home-categories ~ ul a')).map((a) => [
      a.querySelector('span:last-child')?.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Mobiles & Tablets', '/categories/mobiles-tablets'],
      ['Vehicles', '/categories/vehicles'],
    ]);
  });

  it('has the calls to action', () => {
    open();
    answer();

    expect(root.querySelectorAll('a[href="/listings/new"]').length).toBeGreaterThanOrEqual(2);
    expect(root.querySelector('a[href="/search"]')?.textContent).toContain('Browse all ads');
  });

  it('shows each section as skeletons first, then its ads', () => {
    open();
    controller.expectOne('/api/v1/categories').flush(categories);
    expect(root.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
    featured().flush([summary({ id: 'f1', title: 'Featured phone' })]);
    recent().flush([
      summary({ id: 'r1', title: 'Recent bike' }),
      summary({ id: 'r2', title: 'Recent sofa' }),
    ]);
    recommended().flush({
      basis: 'POPULAR',
      listings: [summary({ id: 'p1', title: 'Popular camera' })],
    });
    fixture.detectChanges();

    expect(titlesIn('Featured ads')).toEqual(['Featured phone']);
    expect(titlesIn('Recently posted')).toEqual(['Recent bike', 'Recent sofa']);
    expect(titlesIn('Popular right now')).toEqual(['Popular camera']);
  });

  it('leaves out featured and recommended when there is nothing to show, but always shows "recent"', () => {
    open();
    answer();

    expect(heading('Featured ads')).toBeUndefined();
    expect(heading('Popular right now')).toBeUndefined();
    expect(heading('Recommended for you')).toBeUndefined();
    expect(heading('Recently posted')).toBeDefined();
    expect(root.textContent).toContain('No ads have been posted yet. Be the first!');
  });

  it('names the recommendations by the rule that picked them', () => {
    open();
    answer({
      recommended: {
        basis: 'FAVOURITE_CATEGORIES',
        listings: [summary({ title: 'Like the ones you saved' })],
      },
    });

    expect(heading('Recommended for you')).toBeDefined();
    expect(root.textContent).toContain('New ads in the categories of the ads you saved.');
    expect(heading('Popular right now')).toBeUndefined();
  });

  it('keeps the other sections when one fails, and tries only that one again', () => {
    open();
    controller.expectOne('/api/v1/categories').flush(categories);
    featured().flush([]);
    recent().flush(
      { title: 'Server Error', status: 500, detail: 'Recent ads are unavailable.' },
      { status: 500, statusText: 'Server Error' },
    );
    recommended().flush({ basis: 'POPULAR', listings: [summary({ title: 'Popular camera' })] });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Recent ads are unavailable.',
    );
    expect(titlesIn('Popular right now')).toEqual(['Popular camera']);

    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    recent().flush([summary({ title: 'Back again' })]);
    fixture.detectChanges();
    expect(titlesIn('Recently posted')).toEqual(['Back again']);
  });

  describe('near you', () => {
    const NEAR_KTM = '/api/v1/listings?districtId=30&sort=newest&size=8';
    const kathmandu = { provinceId: 3, districtId: 30, districtName: 'Kathmandu' };

    it('invites the person to choose a place, with no request, while none is chosen', () => {
      open();
      answer();

      expect(heading('See ads near you')).toBeDefined();
      expect(root.textContent).toContain('Choose your district with the location button');
    });

    it('shows the ads of the chosen district, newest first, and links to the whole search', () => {
      preference.choose(kathmandu);
      open();
      answer();
      controller
        .expectOne(NEAR_KTM)
        .flush(pageOf([summary({ id: 'n1', title: 'Phone in Kathmandu' })]));
      fixture.detectChanges();

      expect(titlesIn('Near Kathmandu')).toEqual(['Phone in Kathmandu']);
      expect(root.querySelector('a[href="/search?provinceId=3&districtId=30"]')).not.toBeNull();
      expect(heading('See ads near you')).toBeUndefined();
    });

    it('follows the place when it is changed, and goes back to the invitation for all of Nepal', () => {
      preference.choose(kathmandu);
      open();
      answer();
      controller.expectOne(NEAR_KTM).flush(pageOf([summary()]));
      fixture.detectChanges();

      preference.choose({ provinceId: 4, districtId: 40, districtName: 'Kaski' });
      fixture.detectChanges();
      controller
        .expectOne('/api/v1/listings?districtId=40&sort=newest&size=8')
        .flush(pageOf([summary({ title: 'Phone in Pokhara' })]));
      fixture.detectChanges();
      expect(titlesIn('Near Kaski')).toEqual(['Phone in Pokhara']);

      preference.clear();
      fixture.detectChanges();
      expect(heading('Near Kaski')).toBeUndefined();
      expect(heading('See ads near you')).toBeDefined();
    });

    it('hides the section when the district has no ads', () => {
      preference.choose(kathmandu);
      open();
      answer();
      controller.expectOne(NEAR_KTM).flush(pageOf([]));
      fixture.detectChanges();

      expect(heading('Near Kathmandu')).toBeUndefined();
    });
  });

  describe('recommended', () => {
    it('waits until it is known whether the person is signed in', () => {
      open('unknown');
      controller.expectOne('/api/v1/categories').flush([]);
      featured().flush([]);
      recent().flush([]);
      controller.expectNone('/api/v1/listings/recommended?limit=8');

      status.set('authenticated');
      fixture.detectChanges();

      recommended().flush({ basis: 'FAVOURITE_CATEGORIES', listings: [] });
    });

    it('is asked for again when the person signs in or out, because the answer depends on who they are', () => {
      open();
      answer();

      status.set('authenticated');
      fixture.detectChanges();
      recommended().flush({
        basis: 'FAVOURITE_CATEGORIES',
        listings: [summary({ title: 'For you' })],
      });
      fixture.detectChanges();
      expect(titlesIn('Recommended for you')).toEqual(['For you']);

      status.set('anonymous');
      fixture.detectChanges();
      recommended().flush({ basis: 'POPULAR', listings: [summary({ title: 'For everyone' })] });
      fixture.detectChanges();
      expect(titlesIn('Popular right now')).toEqual(['For everyone']);
    });
  });
});
