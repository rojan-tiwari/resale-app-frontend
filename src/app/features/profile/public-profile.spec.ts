import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { PublicUser } from '../../core/models/user';
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

  it('shows a placeholder while the profile loads', () => {
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(root.querySelector('h1')).toBeNull();

    controller.expectOne(url()).flush(member);
  });

  it('shows the name, since when they are a member (in Nepal time), the place and the bio', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('Sita Sharma');
    expect(root.textContent).toContain('Member since 20 Oct 2026');
    expect(root.textContent).toContain('Kathmandu Metropolitan City, Kathmandu, Bagmati');
    expect(root.textContent).toContain('I sell books.');
    expect(root.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows no phone line unless the owner agreed to show the number', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();

    expect(root.textContent).not.toContain('Phone');
    expect(root.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('shows the phone number as a call link when it is public', () => {
    controller.expectOne(url()).flush({ ...member, phone: '+9779812345678' });
    fixture.detectChanges();

    const phone = root.querySelector<HTMLAnchorElement>('a[href^="tel:"]');
    expect(phone?.getAttribute('href')).toBe('tel:+9779812345678');
    expect(phone?.textContent).toContain('+9779812345678');
  });

  it('never shows an email address, whatever the server sends', () => {
    controller.expectOne(url()).flush({ ...member, email: 'secret@example.com' });
    fixture.detectChanges();

    expect(root.textContent).not.toContain('secret@example.com');
  });

  it('does not say the same place twice when a municipality is named like its district', () => {
    controller
      .expectOne(url())
      .flush({
        ...member,
        location: { province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu' },
      });
    fixture.detectChanges();

    expect(root.textContent).toContain('Kathmandu, Bagmati');
    expect(root.textContent).not.toContain('Kathmandu, Kathmandu');
  });

  it('leaves out the place and the bio when there are none', () => {
    controller
      .expectOne(url())
      .flush({
        ...member,
        bio: null,
        location: { province: null, district: null, municipality: null },
      });
    fixture.detectChanges();

    expect(root.textContent).not.toContain('Place');
    expect(root.textContent).not.toContain('About');
  });

  it('puts the name in the page title', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();

    expect(TestBed.inject(Title).getTitle()).toBe('Sita Sharma · ResaleMarket');
  });

  it('says the member was not found, for a 404, with a way home', () => {
    controller
      .expectOne(url())
      .flush(
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
    controller
      .expectOne(url())
      .flush(
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
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('Sita Sharma');
  });

  it('loads another member when the id in the address changes', () => {
    controller.expectOne(url()).flush(member);
    fixture.detectChanges();

    const other = '11111111-2222-3333-4444-555555555555';
    fixture.componentRef.setInput('id', other);
    fixture.detectChanges();
    controller.expectOne(url(other)).flush({ ...member, id: other, displayName: 'Ram Thapa' });
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('Ram Thapa');
  });
});
