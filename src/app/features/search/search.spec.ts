import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { Category } from '../../core/models/category';
import { provideFavoritesStub } from '../../testing/favorites-stub';
import { pageOf, summary } from '../../testing/listing-fixtures';
import { Search } from './search';

const phones: Category = {
  id: 15,
  parentId: 1,
  name: 'Mobile Phones',
  slug: 'mobile-phones',
  icon: null,
  description: null,
  children: [],
};
const tablets: Category = {
  id: 16,
  parentId: 1,
  name: 'Tablets',
  slug: 'tablets',
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
    children: [phones, tablets],
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
const provinces = [
  { id: 3, name: 'Bagmati', slug: 'bagmati', nameNe: null },
  { id: 4, name: 'Gandaki', slug: 'gandaki', nameNe: null },
];
const bagmati = [
  { id: 29, provinceId: 3, name: 'Lalitpur', slug: 'lalitpur' },
  { id: 30, provinceId: 3, name: 'Kathmandu', slug: 'kathmandu' },
];
const kathmanduCities = [
  {
    id: 1,
    districtId: 30,
    name: 'Kathmandu',
    slug: 'kathmandu',
    type: 'METROPOLITAN',
    major: true,
  },
];

const SEARCH = '/api/v1/listings';

describe('Search', () => {
  let harness: RouterTestingHarness;
  let controller: HttpTestingController;
  let router: Router;
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'search', component: Search },
            { path: 'categories/:slug', component: Search },
            { path: 'categories/:slug/:sub', component: Search },
          ],
          withComponentInputBinding(),
        ),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
        provideFavoritesStub(),
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    controller.verify();
    vi.useRealTimers();
  });

  // --- helpers ---------------------------------------------------------------------------------------------------------

  /** Opens an address and answers the lists the page asks for (categories, provinces); the search itself is answered by the test. */
  async function open(url: string, tree: Category[] = categories): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, Search);
    root = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();
    controller.expectOne('/api/v1/categories').flush(tree);
    controller.expectOne('/api/v1/locations/provinces').flush(provinces);
    harness.detectChanges();
  }

  const searchRequest = (query: string) => controller.expectOne(`${SEARCH}${query}`);
  const field = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`) as T;
  const cardTitles = () =>
    Array.from(root.querySelectorAll('app-listing-card h2')).map((h) => h.textContent?.trim());
  const text = () => root.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.replace(/\s+/g, ' ').trim().startsWith(label),
    );

  function type(id: string, value: string): void {
    const input = field<HTMLInputElement>(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  function choose(id: string, label: string): void {
    const select = field<HTMLSelectElement>(id);
    select.selectedIndex = Array.from(select.options).findIndex(
      (option) => option.textContent?.trim() === label,
    );
    select.dispatchEvent(new Event('change'));
    harness.detectChanges();
  }

  function tick(box: HTMLInputElement | HTMLSelectElement, checked: boolean): void {
    (box as HTMLInputElement).checked = checked;
    box.dispatchEvent(new Event('change'));
    harness.detectChanges();
  }

  /** Lets the page's wait after a filter change pass, and the navigation it causes finish. */
  async function applyFilters(): Promise<void> {
    await vi.advanceTimersByTimeAsync(400);
    harness.detectChanges();
  }

  // --- reading the address ----------------------------------------------------------------------------------------------

  describe('the address is the search', () => {
    it('runs the search the address describes and shows the filters it contains', async () => {
      await open(
        '/search?q=phone&minPrice=5000&maxPrice=90000&condition=GOOD&condition=FAIR&negotiable=true&postedWithinDays=7&sort=priceAsc&page=1',
      );

      searchRequest(
        '?q=phone&minPrice=5000&maxPrice=90000&condition=GOOD&condition=FAIR&negotiable=true&postedWithinDays=7&sort=priceAsc&page=1&size=24',
      ).flush(
        pageOf([summary({ id: 'a', title: 'Samsung phone' })], {
          page: 1,
          totalPages: 3,
          totalElements: 49,
        }),
      );
      harness.detectChanges();

      expect(field<HTMLInputElement>('filter-minPrice').value).toBe('5000');
      expect(field<HTMLInputElement>('filter-maxPrice').value).toBe('90000');
      expect(field<HTMLInputElement>('filter-condition-GOOD')?.checked).toBe(true);
      expect(field<HTMLInputElement>('filter-condition-NEW')?.checked).toBe(false);
      expect(field<HTMLInputElement>('filter-negotiable')?.checked).toBe(true);
      expect(
        field<HTMLSelectElement>('filter-postedWithinDays').selectedOptions[0]?.textContent,
      ).toContain('Last 7 days');
      expect(field<HTMLSelectElement>('filter-sort').value).toBe('priceAsc');
      expect(root.querySelector('h1')?.textContent).toContain('Results for “phone”');
      expect(text()).toContain('49 ads found');
      expect(cardTitles()).toEqual(['Samsung phone']);
      expect(text()).toContain('Page 2 of 3');
    });

    it('ignores nonsense in the address instead of failing, and still searches', async () => {
      await open('/search?minPrice=abc&categoryId=-4&sort=cheapest&condition=BROKEN&page=-2');

      searchRequest('?size=24').flush(pageOf([summary()]));
      harness.detectChanges();

      expect(cardTitles()).toHaveLength(1);
    });

    it('titles the page with what was searched', async () => {
      await open('/search?q=laptop');
      searchRequest('?q=laptop&size=24').flush(pageOf([]));
      harness.detectChanges();

      expect(TestBed.inject(Title).getTitle()).toBe('Results for “laptop” · ResaleMarket');
    });

    it('searches everything when the address has nothing, newest first, and says "All ads"', async () => {
      await open('/search');
      searchRequest('?size=24').flush(pageOf([summary()], { totalElements: 1 }));
      harness.detectChanges();

      expect(root.querySelector('h1')?.textContent).toContain('All ads');
      expect(text()).toContain('1 ad found');
      expect(field<HTMLSelectElement>('filter-sort').value).toBe('newest');
    });

    it('follows the address when it changes (a link, the back button, the header search)', async () => {
      await open('/search?q=phone');
      searchRequest('?q=phone&size=24').flush(pageOf([summary({ title: 'A phone' })]));
      harness.detectChanges();

      await router.navigateByUrl('/search?q=bike&maxPrice=2000');
      harness.detectChanges();
      searchRequest('?q=bike&maxPrice=2000&size=24').flush(pageOf([summary({ title: 'A bike' })]));
      harness.detectChanges();

      expect(cardTitles()).toEqual(['A bike']);
      expect(field<HTMLInputElement>('filter-maxPrice').value).toBe('2000');
      expect(root.querySelector('h1')?.textContent).toContain('Results for “bike”');
    });
  });

  // --- writing the address ----------------------------------------------------------------------------------------------

  describe('filters write the address', () => {
    it('rewrites the address after the person stops changing a filter, keeping the keyword, and searches again from the first page', async () => {
      await open('/search?q=phone&page=2');
      searchRequest('?q=phone&page=2&size=24').flush(
        pageOf([summary()], { page: 2, totalPages: 4, totalElements: 80 }),
      );
      harness.detectChanges();

      type('filter-minPrice', '1000');
      type('filter-minPrice', '10000');
      expect(router.url).toBe('/search?q=phone&page=2'); // nothing yet: the person is still typing
      await applyFilters();

      expect(router.url).toBe('/search?q=phone&minPrice=10000');
      searchRequest('?q=phone&minPrice=10000&size=24').flush(
        pageOf([summary({ title: 'Dearer phone' })]),
      );
      harness.detectChanges();
      expect(cardTitles()).toEqual(['Dearer phone']);
    });

    it('writes conditions, negotiable, the posted filter and the sort', async () => {
      await open('/search');
      searchRequest('?size=24').flush(pageOf([]));
      harness.detectChanges();

      tick(field<HTMLInputElement>('filter-condition-LIKE_NEW'), true);
      tick(field<HTMLInputElement>('filter-condition-FOR_PARTS'), true);
      tick(field<HTMLInputElement>('filter-negotiable'), true);
      choose('filter-postedWithinDays', 'Last 3 days');
      choose('filter-sort', 'Price: high to low');
      await applyFilters();

      expect(router.url).toBe(
        '/search?postedWithinDays=3&condition=LIKE_NEW&condition=FOR_PARTS&negotiable=true&sort=priceDesc',
      );
      searchRequest(
        '?condition=LIKE_NEW&condition=FOR_PARTS&negotiable=true&postedWithinDays=3&sort=priceDesc&size=24',
      ).flush(pageOf([]));
    });

    it('leaves a filter out of the address again when it is cleared', async () => {
      await open('/search?minPrice=500');
      searchRequest('?minPrice=500&size=24').flush(pageOf([]));
      harness.detectChanges();

      type('filter-minPrice', '');
      await applyFilters();

      expect(router.url).toBe('/search');
      searchRequest('?size=24').flush(pageOf([]));
    });

    it('does not search while the lowest price is above the highest, and says so', async () => {
      await open('/search');
      searchRequest('?size=24').flush(pageOf([]));
      harness.detectChanges();

      type('filter-minPrice', '9000');
      type('filter-maxPrice', '100');
      await applyFilters();

      expect(text()).toContain('The lowest price is above the highest.');
      expect(field('filter-minPrice').getAttribute('aria-invalid')).toBe('true');
      expect(router.url).toBe('/search');
      controller.expectNone((request) => request.url === SEARCH);

      type('filter-maxPrice', '20000');
      await applyFilters();
      expect(router.url).toBe('/search?minPrice=9000&maxPrice=20000');
      searchRequest('?minPrice=9000&maxPrice=20000&size=24').flush(pageOf([]));
    });

    it('refuses a price below zero', async () => {
      await open('/search');
      searchRequest('?size=24').flush(pageOf([]));
      harness.detectChanges();

      type('filter-minPrice', '-5');
      await applyFilters();

      expect(text()).toContain('A price cannot be below 0.');
      expect(router.url).toBe('/search');
    });

    it('goes to another page of results with a new address, keeping everything else', async () => {
      await open('/search?q=phone&minPrice=100');
      searchRequest('?q=phone&minPrice=100&size=24').flush(
        pageOf([summary()], { totalPages: 3, totalElements: 60 }),
      );
      harness.detectChanges();

      button('Next')?.click();
      await vi.advanceTimersByTimeAsync(0);
      harness.detectChanges();

      expect(router.url).toBe('/search?q=phone&minPrice=100&page=1');
      searchRequest('?q=phone&minPrice=100&page=1&size=24').flush(
        pageOf([summary({ title: 'Second page' })], { page: 1, totalPages: 3, totalElements: 60 }),
      );
      harness.detectChanges();
      expect(cardTitles()).toEqual(['Second page']);
    });

    it('offers "Best match" only when there is a keyword', async () => {
      await open('/search');
      searchRequest('?size=24').flush(pageOf([]));
      harness.detectChanges();
      expect(
        Array.from(field<HTMLSelectElement>('filter-sort').options).map((o) =>
          o.textContent?.trim(),
        ),
      ).toEqual(['Newest', 'Price: low to high', 'Price: high to low']);

      await router.navigateByUrl('/search?q=phone');
      harness.detectChanges();
      searchRequest('?q=phone&size=24').flush(pageOf([]));
      harness.detectChanges();

      expect(
        Array.from(field<HTMLSelectElement>('filter-sort').options).map((o) =>
          o.textContent?.trim(),
        ),
      ).toEqual(['Best match', 'Newest', 'Price: low to high', 'Price: high to low']);
      expect(field<HTMLSelectElement>('filter-sort').value).toBe('relevance');
    });
  });

  // --- the pickers -------------------------------------------------------------------------------------------------------

  describe('category and location pickers', () => {
    it('offers the subcategories of the chosen category and writes both to the address', async () => {
      await open('/search');
      searchRequest('?size=24').flush(pageOf([]));
      harness.detectChanges();
      expect(root.querySelector('#filter-subcategoryId')).toBeNull();

      choose('filter-categoryId', 'Mobiles & Tablets');
      expect(
        Array.from(field<HTMLSelectElement>('filter-subcategoryId').options).map((o) =>
          o.textContent?.trim(),
        ),
      ).toEqual(['All subcategories', 'Mobile Phones', 'Tablets']);
      choose('filter-subcategoryId', 'Tablets');
      await applyFilters();

      expect(router.url).toBe('/search?categoryId=1&subcategoryId=16');
      searchRequest('?categoryId=1&subcategoryId=16&size=24').flush(pageOf([]));
    });

    it('shows the category and subcategory of the address as chosen', async () => {
      await open('/search?categoryId=1&subcategoryId=15');
      searchRequest('?categoryId=1&subcategoryId=15&size=24').flush(pageOf([]));
      harness.detectChanges();

      expect(
        field<HTMLSelectElement>('filter-categoryId').selectedOptions[0]?.textContent?.trim(),
      ).toBe('Mobiles & Tablets');
      expect(
        field<HTMLSelectElement>('filter-subcategoryId').selectedOptions[0]?.textContent?.trim(),
      ).toBe('Mobile Phones');
    });

    it('loads districts and cities as the place is narrowed, and clears what is below when a parent changes', async () => {
      await open('/search');
      searchRequest('?size=24').flush(pageOf([]));
      harness.detectChanges();

      choose('filter-provinceId', 'Bagmati');
      controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmati);
      harness.detectChanges();
      choose('filter-districtId', 'Kathmandu');
      controller.expectOne('/api/v1/locations/districts/30/municipalities').flush(kathmanduCities);
      harness.detectChanges();
      choose('filter-municipalityId', 'Kathmandu');
      await applyFilters();

      expect(router.url).toBe('/search?provinceId=3&districtId=30&municipalityId=1');
      searchRequest('?provinceId=3&districtId=30&municipalityId=1&size=24').flush(pageOf([]));
      harness.detectChanges();

      choose('filter-provinceId', 'All of Nepal');
      await applyFilters();
      expect(router.url).toBe('/search');
      searchRequest('?size=24').flush(pageOf([]));
      harness.detectChanges();
      expect(root.querySelector('#filter-districtId')).toBeNull();
    });

    it('shows a place from the address with its district and city selected', async () => {
      await open('/search?provinceId=3&districtId=30&municipalityId=1');
      controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmati);
      controller.expectOne('/api/v1/locations/districts/30/municipalities').flush(kathmanduCities);
      searchRequest('?provinceId=3&districtId=30&municipalityId=1&size=24').flush(pageOf([]));
      harness.detectChanges();

      expect(
        field<HTMLSelectElement>('filter-provinceId').selectedOptions[0]?.textContent?.trim(),
      ).toBe('Bagmati');
      expect(
        field<HTMLSelectElement>('filter-districtId').selectedOptions[0]?.textContent?.trim(),
      ).toBe('Kathmandu');
      expect(
        field<HTMLSelectElement>('filter-municipalityId').selectedOptions[0]?.textContent?.trim(),
      ).toBe('Kathmandu');
    });
  });

  // --- states --------------------------------------------------------------------------------------------------------------

  describe('states', () => {
    it('shows placeholders, announced as busy, until the first results arrive', async () => {
      await open('/search');

      expect(root.querySelector('[aria-label="Loading results"]')).not.toBeNull();
      expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(text()).toContain('Searching…');
      searchRequest('?size=24').flush(pageOf([summary()]));
      harness.detectChanges();

      expect(root.querySelector('[aria-label="Loading results"]')).toBeNull();
      expect(root.querySelector('[aria-busy="true"]')).toBeNull();
    });

    it('keeps the earlier results, dimmed, while the next search runs, instead of flashing empty', async () => {
      await open('/search?q=phone');
      searchRequest('?q=phone&size=24').flush(pageOf([summary({ title: 'First answer' })]));
      harness.detectChanges();

      await router.navigateByUrl('/search?q=phone&maxPrice=100');
      harness.detectChanges();

      expect(cardTitles()).toEqual(['First answer']);
      expect(root.querySelector('ul.opacity-60')).not.toBeNull();
      expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
      searchRequest('?q=phone&maxPrice=100&size=24').flush(
        pageOf([summary({ title: 'Second answer' })]),
      );
      harness.detectChanges();
      expect(cardTitles()).toEqual(['Second answer']);
      expect(root.querySelector('ul.opacity-60')).toBeNull();
    });

    it('only shows the answer to the latest search when two are in flight', async () => {
      await open('/search?q=phone');
      const first = searchRequest('?q=phone&size=24');

      await router.navigateByUrl('/search?q=bike');
      harness.detectChanges();
      const second = searchRequest('?q=bike&size=24');
      second.flush(pageOf([summary({ title: 'Bike' })]));
      harness.detectChanges();

      expect(first.cancelled).toBe(true);
      expect(cardTitles()).toEqual(['Bike']);
    });

    it('says nothing matched, and offers to clear the filters or the words', async () => {
      await open('/search?q=zzz&minPrice=999999');
      searchRequest('?q=zzz&minPrice=999999&size=24').flush(pageOf([]));
      harness.detectChanges();

      expect(text()).toContain('No ads match your search');
      expect(text()).toContain('0 ads found');

      button('Clear filters')?.click();
      await vi.advanceTimersByTimeAsync(0);
      harness.detectChanges();
      expect(router.url).toBe('/search?q=zzz');
      searchRequest('?q=zzz&size=24').flush(pageOf([]));
      harness.detectChanges();

      button('Clear the search words')?.click();
      await vi.advanceTimersByTimeAsync(0);
      harness.detectChanges();
      expect(router.url).toBe('/search');
      searchRequest('?size=24').flush(pageOf([summary()]));
    });

    it('explains a failure, keeps the filters, and tries again', async () => {
      await open('/search?q=phone');
      searchRequest('?q=phone&size=24').flush(
        {
          title: 'Bad Request',
          status: 400,
          detail: 'The lowest price cannot be above the highest price.',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      harness.detectChanges();

      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'The lowest price cannot be above the highest price.',
      );
      expect(text()).toContain('The search could not be run');

      button('Try again')?.click();
      harness.detectChanges();
      searchRequest('?q=phone&size=24').flush(pageOf([summary({ title: 'Found it' })]));
      harness.detectChanges();

      expect(root.querySelector('[role="alert"]')).toBeNull();
      expect(cardTitles()).toEqual(['Found it']);
    });

    it('announces the number of results to screen readers and formats big numbers the Nepali way', async () => {
      await open('/search');
      searchRequest('?size=24').flush(
        pageOf([summary()], { totalElements: 1234567, totalPages: 51446 }),
      );
      harness.detectChanges();

      const status = root.querySelector('[role="status"]');
      expect(status?.getAttribute('aria-live')).toBe('polite');
      expect(status?.textContent).toContain('12,34,567 ads found');
    });
  });

  // --- phones --------------------------------------------------------------------------------------------------------------

  describe('on a phone', () => {
    it('hides the filters behind a button that says how many are set, and shows them when pressed', async () => {
      await open('/search?minPrice=100&negotiable=true&condition=NEW');
      searchRequest('?minPrice=100&condition=NEW&negotiable=true&size=24').flush(pageOf([]));
      harness.detectChanges();

      const toggle = root.querySelector<HTMLButtonElement>(
        'button[aria-controls="filters-panel"]',
      ) as HTMLButtonElement;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.textContent?.replace(/\s+/g, ' ')).toContain('Filters 3');
      expect(field('filters-panel').className).toContain('hidden');

      toggle.click();
      harness.detectChanges();

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(field('filters-panel').className).not.toContain('hidden');
    });

    it('offers "Clear filters" only when there are filters', async () => {
      await open('/search?q=phone');
      searchRequest('?q=phone&size=24').flush(pageOf([summary()]));
      harness.detectChanges();
      expect(root.querySelector('#filters-panel')?.textContent).not.toContain('Clear filters');

      await router.navigateByUrl('/search?q=phone&minPrice=5');
      harness.detectChanges();
      searchRequest('?q=phone&minPrice=5&size=24').flush(pageOf([summary()]));
      harness.detectChanges();

      expect(root.querySelector('#filters-panel')?.textContent).toContain('Clear filters');
    });
  });

  // --- category pages ------------------------------------------------------------------------------------------------------

  describe('category pages', () => {
    it('is the search with the category chosen: the heading, the breadcrumb and the subcategories as links', async () => {
      await open('/categories/mobiles-tablets');
      searchRequest('?categoryId=1&size=24').flush(
        pageOf([summary({ title: 'A phone' })], { totalElements: 5 }),
      );
      harness.detectChanges();

      expect(root.querySelector('h1')?.textContent).toContain('Mobiles & Tablets');
      expect(TestBed.inject(Title).getTitle()).toBe('Mobiles & Tablets · ResaleMarket');
      expect(
        root.querySelector('nav[aria-label="Breadcrumb"]')?.textContent?.replace(/\s+/g, ' '),
      ).toContain('Home›Mobiles & Tablets');
      expect(
        Array.from(root.querySelectorAll('ul[aria-label="Subcategories"] a')).map((a) => [
          a.textContent?.trim(),
          a.getAttribute('href'),
        ]),
      ).toEqual([
        ['Mobile Phones', '/categories/mobiles-tablets/mobile-phones'],
        ['Tablets', '/categories/mobiles-tablets/tablets'],
      ]);
      expect(text()).toContain('5 ads found');
      expect(cardTitles()).toEqual(['A phone']);
    });

    it('does not offer the category pickers, because the route has chosen the category', async () => {
      await open('/categories/mobiles-tablets');
      searchRequest('?categoryId=1&size=24').flush(pageOf([]));
      harness.detectChanges();

      expect(root.querySelector('#filter-categoryId')).toBeNull();
      expect(root.querySelector('#filter-subcategoryId')).toBeNull();
    });

    it('is a subcategory page with its own heading and a way back to the category', async () => {
      await open('/categories/mobiles-tablets/mobile-phones');
      searchRequest('?categoryId=1&subcategoryId=15&size=24').flush(pageOf([]));
      harness.detectChanges();

      expect(root.querySelector('h1')?.textContent).toContain('Mobile Phones');
      expect(
        root.querySelector('nav[aria-label="Breadcrumb"] a[href="/categories/mobiles-tablets"]'),
      ).not.toBeNull();
      expect(root.querySelector('ul[aria-label="Subcategories"]')).toBeNull();
    });

    it('keeps the other filters working and in the address, with the category in the path', async () => {
      await open('/categories/mobiles-tablets?q=samsung');
      searchRequest('?q=samsung&categoryId=1&size=24').flush(pageOf([]));
      harness.detectChanges();

      type('filter-maxPrice', '30000');
      await applyFilters();

      expect(router.url).toBe('/categories/mobiles-tablets?q=samsung&maxPrice=30000');
      searchRequest('?q=samsung&categoryId=1&maxPrice=30000&size=24').flush(pageOf([]));
    });

    it('waits for the category tree before searching, and shows placeholders meanwhile', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/categories/vehicles', Search);
      root = harness.routeNativeElement as HTMLElement;
      harness.detectChanges();

      controller.expectNone((request) => request.url === SEARCH);
      expect(root.querySelector('[aria-label="Loading results"]')).not.toBeNull();
      controller.expectOne('/api/v1/categories').flush(categories);
      controller.expectOne('/api/v1/locations/provinces').flush(provinces);
      harness.detectChanges();
      searchRequest('?categoryId=2&size=24').flush(pageOf([]));
    });

    it('says the category was not found for an unknown slug or subcategory, with a way on, and runs no search', async () => {
      await open('/categories/no-such-thing');
      harness.detectChanges();

      expect(root.querySelector('[role="alert"] h1')?.textContent).toContain('Category not found');
      expect(root.querySelector('a[href="/categories"]')).not.toBeNull();
      controller.expectNone((request) => request.url === SEARCH);

      await router.navigateByUrl('/categories/mobiles-tablets/no-such-sub');
      harness.detectChanges();
      controller.expectOne('/api/v1/locations/provinces').flush(provinces); // a different route: the page is built again
      expect(root.querySelector('[role="alert"] h1')?.textContent).toContain('Category not found');
      controller.expectNone((request) => request.url === SEARCH);
    });
  });
});
