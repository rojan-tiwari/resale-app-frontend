import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthSession } from './core/auth/auth-session';

describe('App shell and routing', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    // The login and registration routes wait for the start-up session check, so answer it: nobody is signed in.
    TestBed.inject(AuthSession).restore();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/refresh')
      .flush({ title: 'Unauthorized', status: 401 }, { status: 401, statusText: 'Unauthorized' });
  });

  it('renders the landmarks: skip link, header, main and footer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main');
    expect(root.querySelector('app-header nav[aria-label="Primary"]')).not.toBeNull();
    expect(root.querySelector('main#main')).not.toBeNull();
    expect(root.querySelector('app-footer')).not.toBeNull();
  });

  it('lazy-loads the home page at "/"', async () => {
    const harness = await RouterTestingHarness.create();
    const home = await harness.navigateByUrl('/');

    expect(home).toBeTruthy();
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Buy and sell');
  });

  it('shows the not-found page for unknown URLs', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/this/does/not/exist');

    expect(TestBed.inject(Router).url).toBe('/this/does/not/exist');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('This page could not be found');
  });

  it('lazy-loads the registration page at "/auth/register"', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/auth/register');

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toContain('Create your account');
    expect(page.querySelector('form')).not.toBeNull();
  });

  it('lazy-loads the login page at "/auth/login"', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/auth/login');

    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toContain('Sign in');
    expect(page.querySelector('form')).not.toBeNull();
  });

  it('sends a signed-in person away from the login page', async () => {
    TestBed.inject(AuthSession).login({ email: 'sita@example.com', password: 'correct horse' }).subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({
        accessToken: 'access-1',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { id: '1', email: 'sita@example.com', displayName: 'Sita Sharma', phone: null, createdAt: '2026-10-20T08:15:00Z', roles: ['ROLE_USER'] },
      });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/auth/login');

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('offers a "Create account" call to action in the header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('app-header a[href="/auth/register"]');
    expect(link?.textContent).toContain('Create account');
  });
});
