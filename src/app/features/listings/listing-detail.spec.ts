import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { Listing } from '../../core/models/listing';
import { Toasts } from '../../core/notifications/toasts';
import { provideFavoritesStub } from '../../testing/favorites-stub';
import {
  LISTING_ID,
  SELLER_ID,
  listing as listingFixture,
  pageOf,
  photo,
  summary,
} from '../../testing/listing-fixtures';
import { ListingDetail } from './listing-detail';

const url = (id = LISTING_ID) => `/api/v1/listings/${id}`;
const similarUrl = (id = LISTING_ID) => `${url(id)}/similar?limit=8`;
const othersUrl = (sellerId = SELLER_ID) => `/api/v1/users/${sellerId}/listings?size=9`;

describe('ListingDetail', () => {
  let fixture: ComponentFixture<ListingDetail>;
  let controller: HttpTestingController;
  let toasts: Toasts;
  let root: HTMLElement;
  const signedInAs = signal<{ id: string } | null>(null);

  beforeEach(async () => {
    signedInAs.set(null);
    await TestBed.configureTestingModule({
      imports: [ListingDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { user: signedInAs } },
        provideFavoritesStub(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(Toasts);
    fixture = TestBed.createComponent(ListingDetail);
    root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('id', LISTING_ID);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  /** Answers the ad, and for a live one the two lists below it (empty unless given). */
  function loaded(
    ad: Listing = listingFixture(),
    related: { similar?: unknown[]; others?: unknown[] } = {},
  ): void {
    controller.expectOne(url()).flush(ad);
    fixture.detectChanges();
    if (ad.status === 'ACTIVE' || ad.status === 'RESERVED') {
      controller.expectOne(similarUrl()).flush(related.similar ?? []);
      controller.expectOne(othersUrl(ad.seller.id)).flush(pageOf(related.others ?? []));
      fixture.detectChanges();
    }
  }

  const button = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.trim().startsWith(text),
    );
  const manage = () => root.querySelector('#owner-heading');
  const alertText = () =>
    Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent?.trim())
      .join(' | ');

  function expectCall(method: string, address: string): TestRequest {
    const call = controller.expectOne(address);
    expect(call.request.method).toBe(method);
    return call;
  }

  // --- what everyone sees ----------------------------------------------------------------------------------------------

  describe('a live ad, as a visitor', () => {
    it('shows a placeholder while it loads', () => {
      expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(root.querySelector('h1')).toBeNull();

      loaded();
      expect(root.querySelector('[aria-busy="true"]')).toBeNull();
    });

    it('shows the title, the price in rupees, how firm it is, and the facts', () => {
      loaded(
        listingFixture({ title: 'Old guitar', price: 125000, priceType: 'FIXED', viewCount: 41 }),
      );

      expect(root.querySelector('h1')?.textContent).toContain('Old guitar');
      expect(root.textContent).toContain('Rs. 1,25,000');
      expect(root.textContent).toContain('Fixed price');
      const facts = root.querySelector('dl')?.textContent ?? '';
      expect(facts).toContain('Like new');
      expect(facts).toContain('Baneshwor, Kathmandu, Bagmati');
      expect(facts).toContain('21 Oct 2026');
      expect(facts).toContain('41');
    });

    it('shows the category trail and the description with its line breaks kept', () => {
      loaded();

      expect(root.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).toContain(
        'Mobiles & Tablets',
      );
      expect(root.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).toContain(
        'Mobile Phones',
      );
      const description = Array.from(root.querySelectorAll('p')).find((p) =>
        p.textContent?.includes('Battery health 91%.'),
      );
      expect(description?.className).toContain('whitespace-pre-line');
    });

    it('shows the photos in a gallery', () => {
      loaded(listingFixture({ images: [photo('a', 0), photo('b', 1)] }));

      expect(
        root.querySelector('app-image-gallery img[alt^="iPhone 13"]')?.getAttribute('src'),
      ).toContain('/images/a');
      expect(root.querySelectorAll('app-image-gallery ul button')).toHaveLength(2);
    });

    it('shows the seller with a link to their profile, and a phone number only when it is public', () => {
      loaded();
      const link = root.querySelector('#seller-heading')?.parentElement?.querySelector('a');
      expect(link?.getAttribute('href')).toBe(`/users/${SELLER_ID}`);
      expect(link?.textContent).toContain('Sita Sharma');
      expect(root.textContent).toContain('Member since 20 Oct 2026');
      expect(root.querySelector('a[href^="tel:"]')).toBeNull();

      const seller = listingFixture().seller;
      fixture.componentRef.setInput('id', 'second');
      fixture.detectChanges();
      controller
        .expectOne(url('second'))
        .flush(listingFixture({ id: 'second', seller: { ...seller, phone: '+9779812345678' } }));
      fixture.detectChanges();
      controller.expectOne(similarUrl('second')).flush([]);
      controller.expectOne(othersUrl()).flush(pageOf([]));
      fixture.detectChanges();
      expect(root.querySelector('a[href="tel:+9779812345678"]')?.textContent).toContain(
        '+9779812345678',
      );
    });

    it('shows no management panel, no status badge and no email address', () => {
      loaded(listingFixture({ allowedStatuses: [] }));

      expect(manage()).toBeNull();
      expect(root.querySelector('a[href$="/edit"]')).toBeNull();
      expect(root.textContent).not.toContain('@');
    });

    it('puts the title in the page title', () => {
      loaded(listingFixture({ title: 'Old guitar' }));

      expect(TestBed.inject(Title).getTitle()).toBe('Old guitar · ResaleMarket');
    });

    it('shows a featured badge', () => {
      loaded(listingFixture({ featured: true }));

      expect(root.querySelector('article .badge-brand')?.textContent).toContain('Featured');
    });
  });

  describe('more ads', () => {
    it('shows more ads from the same seller (without this one) and similar ads', () => {
      loaded(listingFixture(), {
        others: [
          summary({ id: LISTING_ID, title: 'This very ad' }),
          summary({ id: 'o1', title: 'Seller other' }),
        ],
        similar: [summary({ id: 's1', title: 'Similar one' })],
      });

      const others = root.querySelector('#others-heading')?.parentElement;
      expect(root.querySelector('#others-heading')?.textContent).toContain('More from Sita Sharma');
      expect(others?.textContent).toContain('Seller other');
      expect(others?.textContent).not.toContain('This very ad');
      expect(root.querySelector('#similar-heading')?.parentElement?.textContent).toContain(
        'Similar one',
      );
    });

    it('leaves out a section that has nothing to show', () => {
      loaded(listingFixture(), { others: [summary({ id: LISTING_ID })], similar: [] });

      expect(root.querySelector('#others-heading')).toBeNull();
      expect(root.querySelector('#similar-heading')).toBeNull();
    });

    it('shows skeletons while they load, and keeps the ad when one of them fails, with a way to retry', () => {
      controller.expectOne(url()).flush(listingFixture());
      fixture.detectChanges();
      expect(root.querySelectorAll('app-listing-list [aria-busy="true"]')).toHaveLength(2);

      controller
        .expectOne(similarUrl())
        .flush(
          { title: 'Server Error', status: 500, detail: 'Similar ads are unavailable.' },
          { status: 500, statusText: 'Server Error' },
        );
      controller
        .expectOne(othersUrl())
        .flush(pageOf([summary({ id: 'o1', title: 'Seller other' })]));
      fixture.detectChanges();

      expect(root.querySelector('h1')?.textContent).toContain('iPhone 13');
      expect(alertText()).toContain('Similar ads are unavailable.');
      expect(root.textContent).toContain('Seller other');

      root.querySelector<HTMLButtonElement>('app-listing-list [role="alert"] button')?.click();
      fixture.detectChanges();
      controller.expectOne(similarUrl()).flush([summary({ id: 's1', title: 'Similar one' })]);
      controller.expectOne(othersUrl()).flush(pageOf([]));
      fixture.detectChanges();
      expect(root.textContent).toContain('Similar one');
    });

    it('does not ask for them for an ad that is not live', () => {
      signedInAs.set({ id: SELLER_ID });
      loaded(listingFixture({ status: 'DRAFT', allowedStatuses: ['ACTIVE', 'ARCHIVED'] }));

      expect(root.querySelector('#similar-heading')).toBeNull();
    });
  });

  describe('when the ad cannot be shown', () => {
    it('says it is not available for a 404, with a way home', () => {
      controller
        .expectOne(url())
        .flush(
          { title: 'Not Found', status: 404, code: 'NOT_FOUND', detail: 'x' },
          { status: 404, statusText: 'Not Found' },
        );
      fixture.detectChanges();

      expect(root.querySelector('h1')?.textContent).toContain('This ad is not available');
      expect(root.querySelector('a[href="/"]')).not.toBeNull();
      expect(root.querySelector('button')).toBeNull();
    });

    it('offers to try again after another failure', () => {
      controller
        .expectOne(url())
        .flush(
          { title: 'Server Error', status: 500, detail: 'The server is busy.' },
          { status: 500, statusText: 'Server Error' },
        );
      fixture.detectChanges();
      expect(alertText()).toContain('The server is busy.');

      button('Try again')?.click();
      fixture.detectChanges();
      loaded();

      expect(root.querySelector('h1')?.textContent).toContain('iPhone 13');
    });

    it('loads another ad when the address changes, and forgets the first one at once', () => {
      loaded(listingFixture({ title: 'First ad' }));

      fixture.componentRef.setInput('id', 'other');
      fixture.detectChanges();
      expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(root.textContent).not.toContain('First ad');
      controller
        .expectOne(url('other'))
        .flush(
          listingFixture({ id: 'other', title: 'Second ad', status: 'SOLD', allowedStatuses: [] }),
        );
      fixture.detectChanges();

      expect(root.querySelector('h1')?.textContent).toContain('Second ad');
    });
  });

  // --- the seller's own view -----------------------------------------------------------------------------------------------

  describe('as the seller', () => {
    beforeEach(() => signedInAs.set({ id: SELLER_ID }));

    it('shows the status and the edit link, and only the moves the server allows', () => {
      loaded(
        listingFixture({ status: 'ACTIVE', allowedStatuses: ['RESERVED', 'SOLD', 'ARCHIVED'] }),
      );

      expect(manage()?.textContent).toContain('Manage your ad');
      expect(root.querySelector('article .badge-success')?.textContent).toContain('Live');
      expect(root.querySelector(`a[href="/listings/${LISTING_ID}/edit"]`)?.textContent).toContain(
        'Edit ad',
      );
      const buttons = Array.from(
        root.querySelectorAll('#owner-heading ~ div button, #owner-heading ~ div a'),
      ).map((el) => el.textContent?.trim());
      expect(buttons).toEqual(['Edit ad', 'Mark as reserved', 'Mark as sold', 'Take down']);
    });

    it('never offers a move that only administrators make', () => {
      loaded(listingFixture({ status: 'ACTIVE', allowedStatuses: ['RESERVED', 'REJECTED'] }));

      expect(button('Mark as reserved')).toBeDefined();
      expect(root.textContent).not.toContain('Rejected');
      expect(button('Reject')).toBeUndefined();
    });

    it('offers to publish a draft, and tells the seller it is private', () => {
      loaded(listingFixture({ status: 'DRAFT', allowedStatuses: ['ACTIVE', 'ARCHIVED'] }));

      expect(root.querySelector('[role="status"]')?.textContent).toContain(
        'This ad is a draft. Only you can see it.',
      );
      expect(button('Publish ad')).toBeDefined();
      expect(button('Delete draft')).toBeDefined();
    });

    it('offers "Submit for review" when approval is required', () => {
      loaded(listingFixture({ status: 'DRAFT', allowedStatuses: ['PENDING_REVIEW', 'ARCHIVED'] }));

      expect(button('Submit for review')).toBeDefined();
      expect(button('Publish ad')).toBeUndefined();
    });

    it('explains an ad waiting for review, with no edit link while it is frozen', () => {
      loaded(listingFixture({ status: 'PENDING_REVIEW', allowedStatuses: ['DRAFT'] }));

      expect(root.querySelector('[role="status"]')?.textContent).toContain('waiting for approval');
      expect(button('Withdraw from review')).toBeDefined();
      expect(root.querySelector('a[href$="/edit"]')).toBeNull();
    });

    it('shows the reason a moderator gave for rejecting an ad, in an alert-coloured notice, with a way to fix it', () => {
      loaded(
        listingFixture({
          status: 'REJECTED',
          rejectionReason: 'The photos show a different item.',
          allowedStatuses: ['DRAFT', 'ARCHIVED'],
        }),
      );

      const notice = root.querySelector('[role="status"]');
      expect(notice?.textContent).toContain('This ad was rejected');
      expect(notice?.textContent).toContain('Reason: The photos show a different item.');
      expect(button('Move back to draft')).toBeDefined();
    });

    it('offers to restore an archived ad as a draft, and a sold ad can only be taken down', () => {
      loaded(listingFixture({ status: 'ARCHIVED', allowedStatuses: ['DRAFT'] }));
      expect(button('Restore as draft')).toBeDefined();
      expect(root.querySelector('[role="status"]')?.textContent).toContain('taken down');

      fixture.componentRef.setInput('id', 'sold');
      fixture.detectChanges();
      controller
        .expectOne(url('sold'))
        .flush(listingFixture({ id: 'sold', status: 'SOLD', allowedStatuses: ['ARCHIVED'] }));
      fixture.detectChanges();
      expect(button('Take down')).toBeDefined();
      expect(button('Mark as sold')).toBeUndefined();
    });

    it('makes a reserved ad available again', () => {
      loaded(
        listingFixture({ status: 'RESERVED', allowedStatuses: ['ACTIVE', 'SOLD', 'ARCHIVED'] }),
      );

      expect(button('Make available again')).toBeDefined();
      expect(root.querySelector('article .badge-brand')?.textContent).toContain('Reserved');
    });

    it('makes an easy move straight away and shows the new state', () => {
      loaded(
        listingFixture({ status: 'ACTIVE', allowedStatuses: ['RESERVED', 'SOLD', 'ARCHIVED'] }),
      );

      button('Mark as reserved')?.click();
      fixture.detectChanges();
      const call = expectCall('PATCH', `${url()}/status`);
      expect(call.request.body).toEqual({ status: 'RESERVED', reason: null });
      call.flush(
        listingFixture({ status: 'RESERVED', allowedStatuses: ['ACTIVE', 'SOLD', 'ARCHIVED'] }),
      );
      fixture.detectChanges();
      controller.expectOne(similarUrl()).flush([]);
      controller.expectOne(othersUrl()).flush(pageOf([]));
      fixture.detectChanges();

      expect(root.querySelector('article .badge-brand')?.textContent).toContain('Reserved');
      expect(button('Make available again')).toBeDefined();
      expect(toasts.list().map((t) => t.message)).toEqual(['The ad is marked as reserved.']);
    });

    it('asks first before a move that is hard to take back, and does nothing on "Cancel"', () => {
      loaded(
        listingFixture({ status: 'ACTIVE', allowedStatuses: ['RESERVED', 'SOLD', 'ARCHIVED'] }),
      );

      button('Mark as sold')?.click();
      fixture.detectChanges();

      const dialog = root.querySelector('[role="alertdialog"]');
      expect(dialog?.textContent).toContain(
        'Mark this ad as sold? It will no longer be shown to others.',
      );
      controller.expectNone(`${url()}/status`);

      button('Cancel')?.click();
      fixture.detectChanges();
      expect(root.querySelector('[role="alertdialog"]')).toBeNull();
      expect(button('Mark as sold')).toBeDefined();
      controller.expectNone(`${url()}/status`);
    });

    it('sends the move once it is confirmed', () => {
      loaded(
        listingFixture({ status: 'ACTIVE', allowedStatuses: ['RESERVED', 'SOLD', 'ARCHIVED'] }),
      );
      button('Mark as sold')?.click();
      fixture.detectChanges();

      button('Yes, mark as sold')?.click();
      fixture.detectChanges();
      expect(button('Please wait…')?.disabled).toBe(true);
      const call = expectCall('PATCH', `${url()}/status`);
      expect(call.request.body).toEqual({ status: 'SOLD', reason: null });
      call.flush(
        listingFixture({
          status: 'SOLD',
          allowedStatuses: ['ARCHIVED'],
          soldAt: '2026-11-01T00:00:00Z',
        }),
      );
      fixture.detectChanges();

      expect(root.querySelector('[role="alertdialog"]')).toBeNull();
      expect(root.querySelector('article .badge-neutral')?.textContent).toContain('Sold');
      expect(root.querySelector('[role="status"]')?.textContent).toContain('marked as sold');
      expect(toasts.list().map((t) => t.message)).toEqual(['The ad is marked as sold.']);
    });

    it("shows the server's refusal and keeps the ad as it was", () => {
      loaded(listingFixture({ status: 'DRAFT', allowedStatuses: ['ACTIVE', 'ARCHIVED'] }));

      button('Publish ad')?.click();
      fixture.detectChanges();
      expectCall('PATCH', `${url()}/status`).flush(
        {
          title: 'Unprocessable Content',
          status: 422,
          code: 'BUSINESS_RULE_VIOLATION',
          detail: 'Add at least one photo before publishing the listing.',
        },
        { status: 422, statusText: 'Unprocessable Content' },
      );
      fixture.detectChanges();

      expect(alertText()).toContain('Add at least one photo before publishing the listing.');
      expect(button('Publish ad')?.disabled).toBe(false);
      expect(root.querySelector('[role="status"]')?.textContent).toContain('This ad is a draft');
      expect(toasts.list()).toHaveLength(0);
    });

    it('does not send a second request while one is under way', () => {
      loaded(listingFixture({ status: 'DRAFT', allowedStatuses: ['ACTIVE', 'ARCHIVED'] }));

      button('Publish ad')?.click();
      fixture.detectChanges();
      button('Publish ad')?.click();
      fixture.detectChanges();

      controller.expectOne(`${url()}/status`);
    });

    it("is not shown the seller's controls when it is someone else's ad, even if signed in", () => {
      signedInAs.set({ id: '99999999-0000-0000-0000-000000000000' });
      loaded(listingFixture({ allowedStatuses: [] }));

      expect(manage()).toBeNull();
    });
  });
});
