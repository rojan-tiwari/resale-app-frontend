import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ProfileNav } from './profile-nav';

@Component({ selector: 'app-page', imports: [ProfileNav], template: '<app-profile-nav />' })
class Page {}

describe('ProfileNav', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'profile', component: Page },
          { path: 'profile/password', component: Page },
        ]),
      ],
    });
  });

  const current = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('a[aria-current="page"]')).map((link) =>
      link.textContent?.trim(),
    );

  it('is a labelled navigation with a link to each account page', async () => {
    const harness = await RouterTestingHarness.create('/profile');
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Account');
    expect(root.querySelector('a[href="/profile"]')?.textContent).toContain('Your details');
    expect(root.querySelector('a[href="/profile/password"]')?.textContent).toContain('Password');
  });

  it('marks "Your details" as the current page on /profile, and only that', async () => {
    const harness = await RouterTestingHarness.create('/profile');

    expect(current(harness.routeNativeElement as HTMLElement)).toEqual(['Your details']);
  });

  it('marks "Password" as the current page on /profile/password, and only that', async () => {
    const harness = await RouterTestingHarness.create('/profile/password');

    expect(current(harness.routeNativeElement as HTMLElement)).toEqual(['Password']);
  });
});
