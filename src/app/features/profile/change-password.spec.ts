import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { Toasts } from '../../core/notifications/toasts';
import { ChangePassword } from './change-password';

const CHANGE_URL = '/api/v1/users/me/password';

describe('ChangePassword', () => {
  let fixture: ComponentFixture<ChangePassword>;
  let controller: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangePassword],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ChangePassword);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const field = (name: string) =>
    root.querySelector<HTMLInputElement>(`#password-${name}`) as HTMLInputElement;
  const errorText = (name: string) =>
    root.querySelector(`#password-${name}-error`)?.textContent?.trim() ?? '';
  const alert = () => root.querySelector('form [role="alert"]');
  const button = () =>
    root.querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement;

  function fill(current: string, next: string, confirm = next): void {
    for (const [name, value] of [
      ['currentPassword', current],
      ['newPassword', next],
      ['confirmPassword', confirm],
    ]) {
      field(name).value = value;
      field(name).dispatchEvent(new Event('input'));
    }
  }

  function submit(): void {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('shows the account navigation', () => {
    expect(root.querySelector('app-profile-nav a[href="/profile"]')?.textContent).toContain(
      'Your details',
    );
    expect(
      root.querySelector('app-profile-nav a[href="/profile/password"]')?.textContent,
    ).toContain('Password');
  });

  it('labels the three fields and tells the browser which one is the current password', () => {
    expect(field('currentPassword').getAttribute('autocomplete')).toBe('current-password');
    expect(field('newPassword').getAttribute('autocomplete')).toBe('new-password');
    expect(field('confirmPassword').getAttribute('autocomplete')).toBe('new-password');
    for (const name of ['currentPassword', 'newPassword', 'confirmPassword']) {
      expect(root.querySelector(`label[for="password-${name}"]`)).not.toBeNull();
    }
  });

  it('asks for every password and focuses the first empty one', () => {
    submit();

    expect(errorText('currentPassword')).toBe('Enter your current password.');
    expect(errorText('newPassword')).toBe('Enter a new password.');
    expect(errorText('confirmPassword')).toBe('Enter the new password again.');
    expect(document.activeElement).toBe(field('currentPassword'));
    controller.expectNone(CHANGE_URL);
  });

  it('wants a new password of at least 8 characters that is entered twice', () => {
    fill('old password', 'short');
    submit();
    expect(errorText('newPassword')).toBe('Use at least 8 characters.');

    fill('old password', 'a brand new password', 'something different');
    fixture.detectChanges();
    expect(errorText('confirmPassword')).toBe('The passwords do not match.');
    controller.expectNone(CHANGE_URL);
  });

  it('sends both passwords as typed, then tells the person they were signed out everywhere and goes to sign in', () => {
    const session = TestBed.inject(AuthSession);
    fill(' old password ', 'a brand new password');
    submit();

    const request = controller.expectOne(CHANGE_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      currentPassword: ' old password ',
      newPassword: 'a brand new password',
    });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(session.status()).toBe('anonymous');
    expect(
      TestBed.inject(Toasts)
        .list()
        .map((toast) => toast.message),
    ).toEqual([
      'Your password was changed and you were signed out everywhere. Sign in with the new password.',
    ]);
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });

  it('puts "not your current password" next to that field, stays on the page and does not sign out', () => {
    fill('wrong password', 'a brand new password');
    submit();

    controller.expectOne(CHANGE_URL).flush(
      {
        title: 'Bad Request',
        status: 400,
        detail: 'One or more fields are invalid.',
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'currentPassword', message: 'This is not your current password.' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(errorText('currentPassword')).toBe('This is not your current password.');
    expect(field('currentPassword').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field('currentPassword'));
    expect(alert()).toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(button().disabled).toBe(false);
  });

  it('shows a rate limit in an alert', () => {
    fill('old password', 'a brand new password');
    submit();

    controller.expectOne(CHANGE_URL).flush(
      {
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many attempts. Please try again in 15 minutes.',
        code: 'TOO_MANY_REQUESTS',
      },
      { status: 429, statusText: 'Too Many Requests' },
    );
    fixture.detectChanges();

    expect(alert()?.textContent).toContain('Please try again in 15 minutes.');
  });

  it('disables the button while changing and sends once', () => {
    fill('old password', 'a brand new password');
    submit();

    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Changing');
    submit();

    expect(controller.match(CHANGE_URL)).toHaveLength(1);
  });
});
