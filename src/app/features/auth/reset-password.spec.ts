import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { Toasts } from '../../core/notifications/toasts';
import { ResetPassword } from './reset-password';

const RESET_URL = '/api/v1/auth/reset-password';

describe('ResetPassword', () => {
  let controller: HttpTestingController;
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => controller.verify());

  function open(token?: string): { fixture: ComponentFixture<ResetPassword>; root: HTMLElement } {
    const fixture = TestBed.createComponent(ResetPassword);
    if (token !== undefined) {
      fixture.componentRef.setInput('token', token);
    }
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  const field = (root: HTMLElement, name: string) =>
    root.querySelector<HTMLInputElement>(`#reset-${name}`) as HTMLInputElement;
  const errorText = (root: HTMLElement, name: string) =>
    root.querySelector(`#reset-${name}-error`)?.textContent?.trim() ?? '';

  function fill(root: HTMLElement, newPassword: string, confirmPassword = newPassword): void {
    for (const [name, value] of [
      ['newPassword', newPassword],
      ['confirmPassword', confirmPassword],
    ]) {
      field(root, name).value = value;
      field(root, name).dispatchEvent(new Event('input'));
    }
  }

  function submit(fixture: ComponentFixture<ResetPassword>): void {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  describe('without a link token', () => {
    it('shows that the link does not work, and a way to get a new one, instead of a form', () => {
      const { root } = open();

      expect(root.textContent).toContain('This link does not work');
      expect(root.querySelector('a[href="/auth/forgot-password"]')?.textContent).toContain(
        'Get a new link',
      );
      expect(root.querySelector('a[href="/auth/login"]')).not.toBeNull();
      expect(root.querySelector('form')).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('treats an empty token the same way', () => {
      const { root } = open('   ');

      expect(root.textContent).toContain('This link does not work');
    });
  });

  describe('with a link token', () => {
    it('shows the form and takes the secret out of the address bar without adding a history entry', () => {
      const { root } = open('abc123');

      expect(root.querySelector('h1')?.textContent).toContain('Choose a new password');
      expect(field(root, 'newPassword').getAttribute('autocomplete')).toBe('new-password');
      expect(field(root, 'confirmPassword').getAttribute('autocomplete')).toBe('new-password');
      expect(navigate).toHaveBeenCalledWith([], {
        queryParams: { token: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    it('asks for both passwords and sends nothing while they are missing', () => {
      const { fixture, root } = open('abc123');

      submit(fixture);

      expect(errorText(root, 'newPassword')).toBe('Enter a new password.');
      expect(errorText(root, 'confirmPassword')).toBe('Enter the new password again.');
      expect(document.activeElement).toBe(field(root, 'newPassword'));
      controller.expectNone(RESET_URL);
    });

    it('wants at least 8 characters and at most 72 bytes', () => {
      const { fixture, root } = open('abc123');

      fill(root, 'short');
      submit(fixture);
      expect(errorText(root, 'newPassword')).toBe('Use at least 8 characters.');

      fill(root, 'क'.repeat(25)); // 25 characters, 75 bytes
      fixture.detectChanges();
      expect(errorText(root, 'newPassword')).toContain('at most 72 bytes');
      controller.expectNone(RESET_URL);
    });

    it('wants the two passwords to match', () => {
      const { fixture, root } = open('abc123');

      fill(root, 'a brand new password', 'another one entirely');
      submit(fixture);

      expect(errorText(root, 'confirmPassword')).toBe('The passwords do not match.');
      controller.expectNone(RESET_URL);
    });

    it('sends the token and the password exactly as typed, then says so and goes to sign in', () => {
      const { fixture, root } = open('abc123');
      fill(root, '  spaced  password ');
      submit(fixture);

      const request = controller.expectOne(RESET_URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ token: 'abc123', newPassword: '  spaced  password ' });
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(
        TestBed.inject(Toasts)
          .list()
          .map((toast) => toast.message),
      ).toEqual(['Your password was changed. Sign in with your new password.']);
      expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
    });

    it('disables the button while saving and sends once', () => {
      const { fixture, root } = open('abc123');
      fill(root, 'a brand new password');
      submit(fixture);

      expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
      submit(fixture);

      expect(controller.match(RESET_URL)).toHaveLength(1);
    });

    it('offers a new link when this one is refused as used or expired', () => {
      const { fixture, root } = open('abc123');
      fill(root, 'a brand new password');
      submit(fixture);

      controller.expectOne(RESET_URL).flush(
        {
          title: 'Bad Request',
          status: 400,
          detail: 'This password reset link is invalid or has expired. Please request a new one.',
          code: 'INVALID_TOKEN',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();

      expect(root.textContent).toContain('This link does not work');
      expect(root.querySelector('a[href="/auth/forgot-password"]')).not.toBeNull();
      expect(root.querySelector('form')).toBeNull();
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('puts a password rule from the server next to the field and keeps the form', () => {
      const { fixture, root } = open('abc123');
      fill(root, 'a brand new password');
      submit(fixture);

      controller.expectOne(RESET_URL).flush(
        {
          title: 'Bad Request',
          status: 400,
          detail: 'One or more fields are invalid.',
          code: 'VALIDATION_FAILED',
          errors: [{ field: 'newPassword', message: 'must be at least 8 characters' }],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();

      expect(errorText(root, 'newPassword')).toBe('must be at least 8 characters');
      expect(root.querySelector('form')).not.toBeNull();
      expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    });

    it('shows a rate limit in an alert and keeps the form', () => {
      const { fixture, root } = open('abc123');
      fill(root, 'a brand new password');
      submit(fixture);

      controller.expectOne(RESET_URL).flush(
        {
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many attempts. Please try again in 1 hour.',
          code: 'TOO_MANY_REQUESTS',
        },
        { status: 429, statusText: 'Too Many Requests' },
      );
      fixture.detectChanges();

      expect(root.querySelector('form [role="alert"]')?.textContent).toContain(
        'Please try again in 1 hour.',
      );
      expect(root.querySelector('form')).not.toBeNull();
    });
  });
});
