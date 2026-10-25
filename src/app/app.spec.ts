import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App shell and routing', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
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

  it('offers a "Create account" call to action in the header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('app-header a[href="/auth/register"]');
    expect(link?.textContent).toContain('Create account');
  });
});
