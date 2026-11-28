import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { AuthResponse } from '../../core/models/auth';
import { Login, safeReturnUrl } from './login';

const LOGIN_URL = '/api/v1/auth/login';

const signedIn: AuthResponse = {
  accessToken: 'access-1',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    email: 'sita@example.com',
    displayName: 'Sita Sharma',
    phone: null,
    createdAt: '2026-10-20T08:15:00Z',
    roles: ['ROLE_USER'],
  },
};

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let controller: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const input = (name: string) =>
    root.querySelector<HTMLInputElement>(`#login-${name}`) as HTMLInputElement;
  const errorText = (name: string) =>
    root.querySelector(`#login-${name}-error`)?.textContent?.trim() ?? '';
  const alert = () => root.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  const submitButton = () =>
    root.querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement;

  function type(name: string, value: string): void {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  function fillValidForm(): void {
    type('email', 'sita@example.com');
    type('password', 'correct horse');
  }

  function submit(): void {
    submitButton().click();
    fixture.detectChanges();
  }

  const problem = (status: number, detail: string, title = 'Error') => ({ title, status, detail });

  it('labels both fields and uses the autocomplete hints password managers rely on', () => {
    expect(root.querySelector('h1')?.textContent).toContain('Sign in');
    for (const name of ['email', 'password']) {
      expect(root.querySelector(`label[for="login-${name}"]`)).not.toBeNull();
      expect(errorText(name)).toBe('');
      expect(input(name).getAttribute('aria-invalid')).toBeNull();
    }
    expect(input('email').autocomplete).toBe('username');
    expect(input('password').autocomplete).toBe('current-password');
    expect(input('password').type).toBe('password');
  });

  it('links to the registration page', () => {
    expect(root.querySelector('a[href="/auth/register"]')?.textContent).toContain(
      'Create an account',
    );
  });

  it('explains missing fields, moves focus to the first one and sends nothing', () => {
    submit();

    expect(errorText('email')).toBe('Enter your email address.');
    expect(errorText('password')).toBe('Enter your password.');
    expect(input('email').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('email'));
    controller.expectNone(LOGIN_URL);
  });

  it('rejects an address that is not an email address without calling the server', () => {
    type('email', 'sita@');
    type('password', 'correct horse');
    submit();

    expect(errorText('email')).toBe('Enter a valid email address, like name@example.com.');
    controller.expectNone(LOGIN_URL);
  });

  it('shows a field error only after the field has been visited', () => {
    type('email', 'nope');
    expect(errorText('email')).toBe('');

    input('email').dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(errorText('email')).toBe('Enter a valid email address, like name@example.com.');
  });

  it('sends the trimmed address and the password exactly as typed', () => {
    type('email', '  sita@example.com ');
    type('password', ' pass word  ');
    submit();

    const request = controller.expectOne(LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'sita@example.com', password: ' pass word  ' });
    request.flush(signedIn);
  });

  it('disables the button while the request is in flight and ignores a second submit', () => {
    fillValidForm();
    submit();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain('Signing in');

    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    controller.expectOne(LOGIN_URL).flush(signedIn);
  });

  it('goes to the home page after signing in', () => {
    fillValidForm();
    submit();
    controller.expectOne(LOGIN_URL).flush(signedIn);

    expect(navigate).toHaveBeenCalledWith('/');
    expect(TestBed.inject(AuthSession).user()?.displayName).toBe('Sita Sharma');
  });

  it('returns to the page the person wanted before being asked to sign in', () => {
    fixture.componentRef.setInput('returnUrl', '/listings/new?draft=1');
    fillValidForm();
    submit();
    controller.expectOne(LOGIN_URL).flush(signedIn);

    expect(navigate).toHaveBeenCalledWith('/listings/new?draft=1');
  });

  it('ignores a return address that leads away from the site', () => {
    fixture.componentRef.setInput('returnUrl', 'https://evil.example/phish');
    fillValidForm();
    submit();
    controller.expectOne(LOGIN_URL).flush(signedIn);

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('says the same thing for a wrong password as for an unknown address, clears the password and refocuses it', async () => {
    fillValidForm();
    submit();
    controller
      .expectOne(LOGIN_URL)
      .flush(problem(401, 'Invalid email or password.', 'Unauthorized'), {
        status: 401,
        statusText: 'Unauthorized',
      });
    await fixture.whenStable();

    expect(alert()).toBe('Invalid email or password.');
    expect(input('password').value).toBe('');
    expect(input('email').value).toBe('sita@example.com');
    expect(document.activeElement).toBe(input('password'));
    expect(submitButton().disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(AuthSession).isAuthenticated()).toBe(false);
  });

  it('shows why a suspended account cannot sign in', async () => {
    fillValidForm();
    submit();
    controller
      .expectOne(LOGIN_URL)
      .flush(problem(403, 'This account has been suspended.', 'Forbidden'), {
        status: 403,
        statusText: 'Forbidden',
      });
    await fixture.whenStable();

    expect(alert()).toBe('This account has been suspended.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('maps server-side validation errors onto their fields', async () => {
    fillValidForm();
    submit();
    controller.expectOne(LOGIN_URL).flush(
      {
        title: 'Bad Request',
        status: 400,
        detail: 'One or more fields are invalid.',
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'password', message: 'must not be blank' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(errorText('password')).toBe('must not be blank');
    expect(document.activeElement).toBe(input('password'));
    expect(alert()).toBeNull();
  });

  it('shows an alert when the server cannot be reached, and allows trying again', async () => {
    fillValidForm();
    submit();
    controller
      .expectOne(LOGIN_URL)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();

    expect(alert()).toContain('Cannot reach the server');
    expect(submitButton().disabled).toBe(false);

    submit();
    controller.expectOne(LOGIN_URL).flush(signedIn);
    await fixture.whenStable();

    expect(alert()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});

describe('safeReturnUrl', () => {
  it('accepts paths inside the app', () => {
    expect(safeReturnUrl('/')).toBe('/');
    expect(safeReturnUrl('/listings/42?tab=photos#top')).toBe('/listings/42?tab=photos#top');
  });

  it.each([
    undefined,
    '',
    'listings',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('falls back to the home page for %j', (value) => {
    expect(safeReturnUrl(value)).toBe('/');
  });
});
