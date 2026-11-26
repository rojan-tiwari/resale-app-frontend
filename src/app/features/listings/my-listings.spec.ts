import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { pageOf, summary } from '../../testing/listing-fixtures';
import { MyListings } from './my-listings';

const mine = (query = 'page=0&size=10') => `/api/v1/listings/mine?${query}`;

describe('MyListings', () => {
  let fixture: ComponentFixture<MyListings>;
  let controller: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyListings],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyListings);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const chip = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('[role="group"] button')).find(
      (b) => b.textContent?.trim() === text,
    );
  const rows = () => Array.from(root.querySelectorAll('ul.space-y-3 > li'));

  it('shows placeholders while the ads load', () => {
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();

    controller.expectOne(mine()).flush(pageOf([]));
  });

  it('lists the ads with their status, price, date and links to view and edit them', () => {
    controller
      .expectOne(mine())
      .flush(
        pageOf([
          summary({ id: 'live', title: 'Live phone', status: 'ACTIVE' }),
          summary({ id: 'sold', title: 'Sold bike', status: 'SOLD', primaryImage: null }),
        ]),
      );
    fixture.detectChanges();

    expect(rows()).toHaveLength(2);
    const first = rows()[0]?.textContent ?? '';
    expect(first).toContain('Live phone');
    expect(first).toContain('Rs. 85,000');
    expect(first).toContain('Live');
    expect(first).toContain('21 Oct 2026');
    expect(rows()[0]?.querySelector('img')).not.toBeNull();
    expect(rows()[1]?.textContent).toContain('No photo');
    expect(root.querySelector('a[href="/listings/live"]')).not.toBeNull();
    // A live ad can be edited, a sold one cannot.
    expect(root.querySelector('a[href="/listings/live/edit"]')?.textContent).toContain('Edit');
    expect(root.querySelector('a[href="/listings/sold/edit"]')).toBeNull();
    expect(root.textContent).toContain('2 ads');
  });

  it('gives the links a name that says which ad they are for', () => {
    controller.expectOne(mine()).flush(pageOf([summary({ id: 'live', title: 'Live phone' })]));
    fixture.detectChanges();

    const names = Array.from(rows()[0]?.querySelectorAll('a.btn') ?? []).map((a) =>
      a.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(names).toEqual(['View Live phone', 'Edit Live phone']);
  });

  it('invites a new seller to post a first ad', () => {
    controller.expectOne(mine()).flush(pageOf([]));
    fixture.detectChanges();

    expect(root.textContent).toContain('You have not posted any ads yet.');
    expect(root.querySelector('a[href="/listings/new"]')).not.toBeNull();
  });

  it('filters by status, starting again from the first page, and says what an empty filter means', () => {
    controller.expectOne(mine()).flush(pageOf([summary()], { totalPages: 3, totalElements: 25 }));
    fixture.detectChanges();
    expect(chip('All')?.getAttribute('aria-pressed')).toBe('true');

    root.querySelector<HTMLButtonElement>('app-pager button:last-of-type')?.click();
    fixture.detectChanges();
    controller
      .expectOne(mine('page=1&size=10'))
      .flush(pageOf([summary()], { page: 1, totalPages: 3, totalElements: 25 }));
    fixture.detectChanges();

    chip('Drafts')?.click();
    fixture.detectChanges();
    controller.expectOne(mine('page=0&size=10&status=DRAFT')).flush(pageOf([]));
    fixture.detectChanges();

    expect(chip('Drafts')?.getAttribute('aria-pressed')).toBe('true');
    expect(chip('All')?.getAttribute('aria-pressed')).toBe('false');
    expect(root.textContent).toContain('You have no ads that are draft.');
    expect(root.querySelector('a[href="/listings/new"].btn-primary')).not.toBeNull(); // the header button, not the "first ad" invitation
  });

  it('offers every status as a filter, including the archive the server hides by default', () => {
    controller.expectOne(mine()).flush(pageOf([]));
    const labels = Array.from(root.querySelectorAll('[role="group"] button')).map((b) =>
      b.textContent?.trim(),
    );

    expect(labels).toEqual([
      'All',
      'Drafts',
      'Live',
      'Reserved',
      'Under review',
      'Sold',
      'Rejected',
      'Archived',
    ]);
  });

  it('pages through many ads', () => {
    controller
      .expectOne(mine())
      .flush(pageOf([summary({ title: 'On page one' })], { totalPages: 2, totalElements: 11 }));
    fixture.detectChanges();
    expect(root.textContent).toContain('Page 1 of 2');
    expect(root.textContent).toContain('11 ads');

    Array.from(root.querySelectorAll<HTMLButtonElement>('app-pager button'))
      .find((b) => b.textContent?.trim() === 'Next')
      ?.click();
    fixture.detectChanges();
    controller
      .expectOne(mine('page=1&size=10'))
      .flush(
        pageOf([summary({ title: 'On page two' })], { page: 1, totalPages: 2, totalElements: 11 }),
      );
    fixture.detectChanges();

    expect(root.textContent).toContain('Page 2 of 2');
    expect(root.textContent).toContain('On page two');
  });

  it('explains a failure and tries again', () => {
    controller
      .expectOne(mine())
      .flush(
        { title: 'Server Error', status: 500, detail: 'The server is busy.' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('The server is busy.');

    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    controller.expectOne(mine()).flush(pageOf([summary({ title: 'Back' })]));
    fixture.detectChanges();

    expect(root.textContent).toContain('Back');
  });

  it('has a "Post an ad" button in the heading row', () => {
    controller.expectOne(mine()).flush(pageOf([summary()]));
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('My ads');
    expect(root.querySelector('a[href="/listings/new"]')?.textContent).toContain('Post an ad');
  });
});
