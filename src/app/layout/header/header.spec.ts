import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { Header } from './header';

const sita = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  email: 'sita.sharma@example.com',
  displayName: 'Sita Sharma',
  phone: null,
  createdAt: '2026-10-20T08:15:00Z',
  roles: ['ROLE_USER'],
};

describe('Header account area', () => {
  let fixture: ComponentFixture<Header>;
  let controller: HttpTestingController;
  let session: AuthSession;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    fixture = TestBed.createComponent(Header);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const link = (href: string) => root.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
  const trigger = () =>
    root.querySelector<HTMLButtonElement>('app-user-menu button[aria-controls]');
  const panel = () => root.querySelector('#user-menu-panel');

  function startAnonymous(): void {
    session.restore();
    controller
      .expectOne('/api/v1/auth/refresh')
      .flush({ title: 'Unauthorized', status: 401 }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
  }

  function startSignedIn(): void {
    session.restore();
    controller
      .expectOne('/api/v1/auth/refresh')
      .flush({ accessToken: 'access-1', tokenType: 'Bearer', expiresIn: 900, user: sita });
    fixture.detectChanges();
  }

  it('shows a neutral placeholder, and neither sign-in nor account links, until the session is known', () => {
    expect(link('/auth/login')).toBeNull();
    expect(link('/auth/register')).toBeNull();
    expect(trigger()).toBeNull();
    expect(root.querySelector('.skeleton')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('offers "Sign in" and "Create account" to a visitor', () => {
    startAnonymous();

    expect(link('/auth/login')?.textContent).toContain('Sign in');
    expect(link('/auth/register')?.textContent).toContain('Create account');
    expect(trigger()).toBeNull();
    expect(root.querySelector('.skeleton')).toBeNull();
  });

  it('shows the user menu instead of the sign-in links to a signed-in person', () => {
    startSignedIn();

    expect(link('/auth/login')).toBeNull();
    expect(link('/auth/register')).toBeNull();
    expect(trigger()?.textContent).toContain('Sita Sharma');
    expect(trigger()?.textContent).toContain('S');
  });

  describe('user menu', () => {
    beforeEach(() => startSignedIn());

    it('starts closed and announces that state', () => {
      expect(trigger()?.getAttribute('aria-expanded')).toBe('false');
      expect(panel()).toBeNull();
    });

    it('opens on click and shows the name, the email and "Sign out"', () => {
      trigger()?.click();
      fixture.detectChanges();

      expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
      expect(panel()?.textContent).toContain('Sita Sharma');
      expect(panel()?.textContent).toContain('sita.sharma@example.com');
      expect(panel()?.querySelector('button')?.textContent).toContain('Sign out');
    });

    it('closes on a second click of the button', () => {
      trigger()?.click();
      fixture.detectChanges();
      trigger()?.click();
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });

    it('closes on Escape and returns focus to the button', () => {
      trigger()?.click();
      fixture.detectChanges();
      (panel()?.querySelector('button') as HTMLElement).focus();

      (panel() as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();

      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(trigger());
    });

    it('closes on Escape even when the browser did not focus the clicked button (Safari)', () => {
      trigger()?.click();
      fixture.detectChanges();
      (document.activeElement as HTMLElement | null)?.blur();

      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });

    it('closes when the person clicks elsewhere on the page', () => {
      trigger()?.click();
      fixture.detectChanges();

      document.body.click();
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });

    it('closes when keyboard focus moves out of the menu', () => {
      trigger()?.click();
      fixture.detectChanges();
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      trigger()?.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }),
      );
      fixture.detectChanges();
      outside.remove();

      expect(panel()).toBeNull();
    });

    it('stays open while focus moves within the menu', () => {
      trigger()?.click();
      fixture.detectChanges();

      trigger()?.dispatchEvent(
        new FocusEvent('focusout', {
          bubbles: true,
          relatedTarget: panel()?.querySelector('button'),
        }),
      );
      fixture.detectChanges();

      expect(panel()).not.toBeNull();
    });

    it('signs out, tells the server, returns to the home page and shows the sign-in links again', () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      trigger()?.click();
      fixture.detectChanges();

      (panel()?.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();

      controller
        .expectOne('/api/v1/auth/logout')
        .flush(null, { status: 204, statusText: 'No Content' });
      expect(session.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith('/');
      expect(panel()).toBeNull();
      expect(trigger()).toBeNull();
      expect(link('/auth/login')).not.toBeNull();
    });
  });
});
