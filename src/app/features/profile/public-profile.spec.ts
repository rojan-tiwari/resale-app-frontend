import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { PublicUser } from '../../core/models/user';
import { pageOf, summary } from '../../testing/listing-fixtures';
import { PublicProfile } from './public-profile';

const ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const member: PublicUser = {
  id: ID,
  displayName: 'Sita Sharma',
  bio: 'I sell books.\nSecond line.',
  memberSince: '2026-10-20T08:15:00Z',
  location: {
    province: 'Bagmati',
    district: 'Kathmandu',
    municipality: 'Kathmandu Metropolitan City',
  },
  phone: null,
};

describe('PublicProfile', () => {
  let fixture: ComponentFixture<PublicProfile>;
  let controller: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicProfile],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicProfile);
    root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('id', ID);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const url = (id = ID) => `/api/v1/users/${id}`;
  const adsUrl = (id = ID, page = 0) => `/api/v1/users/${id}/listings?page=${page}&size=12`;

  /** The member loads, which makes the page ask for their ads: answer both (no ads, unless a test says otherwise). */
  function loadMember(body: object, id = ID): void {
    controller.expectOne(url(id)).flush(body);
    fixture.detectChanges();
    controller.expectOne(adsUrl(id)).flush(pageOf([]));
    fixture.detectChanges();
  }

  it('shows a placeholder while the profile loads', () => {
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(root.querySelector('h1')).toBeNull();

    controller.expectOne(url()).flush(member);
  });

  it('shows the name, since when they are a member (in Nepal time), the place and the bio', () => {
    loadMember(member);

    expect(root.querySelector('h1')?.textContent).toContain('Sita Sharma');
    expect(root.textContent).toContain('Member since 20 Oct 2026');
    expect(root.textContent).toContain('Kathmandu Metropolitan City, Kathmandu, Bagmati');
    expect(root.textContent).toContain('I sell books.');
    expect(root.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows no phone line unless the owner agreed to show the number', () => {
    loadMember(member);

    expect(root.textContent).not.toContain('Phone');
    expect(root.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('shows the phone number as a call link when it is public', () => {
    loadMember({ ...member, phone: '+9779812345678' });

    const phone = root.querySelector<HTMLAnchorElement>('a[href^="tel:"]');
    expect(phone?.getAttribute('href')).toBe('tel:+9779812345678');
    expect(phone?.textContent).toContain('+9779812345678');
  });

  it('never shows an email address, whatever the server sends', () => {
    loadMember({ ...member, email: 'secret@example.com' });

    expect(root.textContent).not.toContain('secret@example.com');
  });

  it('does not say the same place twice when a municipality is named like its district', () => {
    loadMember({
      ...member,
      location: { province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu' },
    });

    expect(root.textContent).toContain('Kathmandu, Bagmati');
    expect(root.textContent).not.toContain('Kathmandu, Kathmandu');
  });

  it('leaves out the place and the bio when there are none', () => {
    loadMember({
      ...member,
      bio: null,
      location: { province: null, district: null, municipality: null },
    });

    expect(root.textContent).not.toContain('Place');
    expect(root.textContent).not.toContain('About');
  });

  it('puts the name in the page title', () => {
    loadMember(member);

    expect(TestBed.inject(Title).getTitle()).toBe('Sita Sharma · ResaleMarket');
  });

  it('says the member was not found, for a 404, with a way home', () => {
    controller.expectOne(url()).flush(
      {
        title: 'Not Found',
        status: 404,
        detail: "User with id 'x' was not found.",
        code: 'NOT_FOUND',
      },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Member not found');
    expect(root.querySelector('a[href="/"]')).not.toBeNull();
    expect(root.querySelector('button')).toBeNull();
  });

  it('offers to try again after another failure', () => {
    controller.expectOne(url()).flush(
      {
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500, statusText: 'Internal Server Error' },
    );
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'An unexpected error occurred',
    );

    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    loadMember(member);

    expect(root.querySelector('h1')?.textContent).toContain('Sita Sharma');
  });

  it('loads another member when the id in the address changes', () => {
    loadMember(member);

    const other = '11111111-2222-3333-4444-555555555555';
    fixture.componentRef.setInput('id', other);
    fixture.detectChanges();
    loadMember({ ...member, id: other, displayName: 'Ram Thapa' }, other);

    expect(root.querySelector('h1')?.textContent).toContain('Ram Thapa');
  });

  // --- the member's ads --------------------------------------------------------------------------------------------

  const adsHeading = () => root.querySelector('#member-ads-heading');

  it('shows the ads of the member below the profile', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();
    controller
      .expectOne(adsUrl())
      .flush(
        pageOf([
          summary({ id: 'a1', title: 'iPhone 13' }),
          summary({ id: 'a2', title: 'Old guitar' }),
        ]),
      );
    fixture.detectChanges();

    expect(adsHeading()?.textContent).toContain('Ads by Sita Sharma');
    const titles = Array.from(root.querySelectorAll('app-listing-card h3 a')).map((a) =>
      a.textContent?.trim(),
    );
    expect(titles).toEqual(['iPhone 13', 'Old guitar']);
    expect(root.querySelector('app-listing-card a[href="/listings/a1"]')).not.toBeNull();
  });

  it('shows skeletons while the ads load, and a friendly line when there are none', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();
    expect(root.querySelector('app-listing-list [aria-busy="true"]')).not.toBeNull();

    controller.expectOne(adsUrl()).flush(pageOf([]));
    fixture.detectChanges();

    expect(root.querySelector('app-listing-list [aria-busy="true"]')).toBeNull();
    expect(root.textContent).toContain('This member has no live ads right now.');
  });

  it('keeps the profile when the ads cannot be loaded, and retries them', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();
    controller
      .expectOne(adsUrl())
      .flush(
        { title: 'Internal Server Error', status: 500, detail: 'Try again later.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('Sita Sharma');
    expect(root.querySelector('app-listing-list [role="alert"]')?.textContent).toContain(
      'Try again later.',
    );

    root.querySelector<HTMLButtonElement>('app-listing-list [role="alert"] button')?.click();
    fixture.detectChanges();
    controller.expectOne(adsUrl()).flush(pageOf([summary({ title: 'Back again' })]));
    fixture.detectChanges();

    expect(root.querySelector('app-listing-card')?.textContent).toContain('Back again');
  });

  it('pages through many ads', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();
    controller
      .expectOne(adsUrl())
      .flush(pageOf([summary({ id: 'a1' })], { totalPages: 2, totalElements: 13 }));
    fixture.detectChanges();
    expect(root.textContent).toContain('Page 1 of 2');

    Array.from(root.querySelectorAll<HTMLButtonElement>('app-pager button'))
      .find((button) => button.textContent?.trim() === 'Next')
      ?.click();
    fixture.detectChanges();
    controller.expectOne(adsUrl(ID, 1)).flush(
      pageOf([summary({ id: 'a13', title: 'Thirteenth' })], {
        page: 1,
        totalPages: 2,
        totalElements: 13,
      }),
    );
    fixture.detectChanges();

    expect(root.textContent).toContain('Page 2 of 2');
    expect(root.querySelector('app-listing-card')?.textContent).toContain('Thirteenth');
  });

  it('does not ask for the ads of a member that does not exist', () => {
    controller
      .expectOne(url())
      .flush(
        { title: 'Not Found', status: 404, code: 'NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();

    expect(adsHeading()).toBeNull();
    controller.expectNone(adsUrl());
  });
});
