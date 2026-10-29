import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { User } from '../../core/models/user';
import { Register } from './register';

const REGISTER_URL = '/api/v1/auth/register';

const created: User = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  email: 'sita@example.com',
  displayName: 'Sita Sharma',
  phone: null,
  createdAt: '2026-10-20T08:15:00Z',
  roles: ['ROLE_USER'],
};

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let controller: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Register);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const input = (name: string) => root.querySelector<HTMLInputElement>(`#register-${name}`) as HTMLInputElement;
  const errorText = (name: string) => root.querySelector(`#register-${name}-error`)?.textContent?.trim() ?? '';
  const submitButton = () => root.querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement;

  function type(name: string, value: string): void {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  function fillValidForm(overrides: Partial<Record<string, string>> = {}): void {
    const values: Record<string, string> = {
      displayName: 'Sita Sharma',
      email: 'sita@example.com',
      phone: '',
      password: 'correct horse',
      confirmPassword: 'correct horse',
      ...overrides,
    };
    Object.entries(values).forEach(([name, value]) => type(name, value));
  }

  function submit(): void {
    submitButton().click();
    fixture.detectChanges();
  }

  it('links to the sign-in page for people who already have an account', () => {
    const link = root.querySelector<HTMLAnchorElement>('a[href="/auth/login"]');

    expect(link?.textContent).toContain('Sign in');
  });

  it('has a label for every field and starts without any error', () => {
    for (const name of ['displayName', 'email', 'phone', 'password', 'confirmPassword']) {
      expect(root.querySelector(`label[for="register-${name}"]`)).not.toBeNull();
      expect(errorText(name)).toBe('');
      expect(input(name).getAttribute('aria-invalid')).toBeNull();
    }
    expect(input('email').autocomplete).toBe('email');
    expect(input('password').autocomplete).toBe('new-password');
    expect(input('password').type).toBe('password');
  });

  it('explains every missing required field, moves focus to the first one and sends nothing', () => {
    submit();

    expect(errorText('displayName')).toBe('Enter your name.');
    expect(errorText('email')).toBe('Enter your email address.');
    expect(errorText('password')).toBe('Enter a password.');
    expect(errorText('confirmPassword')).toBe('Enter your password again.');
    expect(errorText('phone')).toBe('');
    expect(input('displayName').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('displayName'));
    controller.expectNone(REGISTER_URL);
  });

  it('shows a field error only after the field has been visited', () => {
    type('email', 'nope');
    expect(errorText('email')).toBe('');

    input('email').dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(errorText('email')).toBe('Enter a valid email address, like name@example.com.');
  });

  it('validates the email, phone and password rules without calling the server', () => {
    fillValidForm({ email: 'a@b', phone: '12345', password: 'short', confirmPassword: 'short' });
    submit();

    expect(errorText('email')).toBe('Enter a valid email address, like name@example.com.');
    expect(errorText('phone')).toBe('Enter a Nepali mobile number, like 9812345678.');
    expect(errorText('password')).toBe('Use at least 8 characters.');
    controller.expectNone(REGISTER_URL);
  });

  it('rejects a password beyond the 72-byte BCrypt limit even when it has fewer than 72 characters', () => {
    const nepali = 'क'.repeat(25);
    fillValidForm({ password: nepali, confirmPassword: nepali });
    submit();

    expect(errorText('password')).toContain('too long');
    controller.expectNone(REGISTER_URL);
  });

  it('reports a confirmation that differs from the password', () => {
    fillValidForm({ confirmPassword: 'something else' });
    submit();

    expect(errorText('confirmPassword')).toBe('The passwords do not match.');
    expect(document.activeElement).toBe(input('confirmPassword'));
    controller.expectNone(REGISTER_URL);
  });

  it('sends trimmed text, the untouched password and a null phone when none was entered', () => {
    fillValidForm({ displayName: '  Sita Sharma ', email: ' sita@example.com ', password: ' pass word  ', confirmPassword: ' pass word  ' });
    submit();

    const request = controller.expectOne(REGISTER_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'sita@example.com',
      password: ' pass word  ',
      displayName: 'Sita Sharma',
      phone: null,
    });
    request.flush(created, { status: 201, statusText: 'Created' });
  });

  it('sends the phone number when one was entered', () => {
    fillValidForm({ phone: '9812345678' });
    submit();

    const request = controller.expectOne(REGISTER_URL);
    expect(request.request.body.phone).toBe('9812345678');
    request.flush({ ...created, phone: '+9779812345678' }, { status: 201, statusText: 'Created' });
  });

  it('disables the button while the request is in flight and ignores a second submit', () => {
    fillValidForm();
    submit();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain('Creating account');

    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    controller.expectOne(REGISTER_URL).flush(created, { status: 201, statusText: 'Created' });
  });

  it('confirms the new account, clears the form and moves focus to the confirmation', async () => {
    fillValidForm();
    submit();
    controller.expectOne(REGISTER_URL).flush(created, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(root.querySelector('form')).toBeNull();
    const heading = root.querySelector('h1') as HTMLElement;
    expect(heading.textContent).toContain('Welcome, Sita Sharma!');
    expect(root.textContent).toContain('sita@example.com');
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    expect(root.querySelector('a[href="/"]')?.textContent).toContain('Continue to home');
    expect(root.querySelector('a[href="/auth/login"]')?.textContent).toContain('Sign in');
    expect(document.activeElement).toBe(heading);
  });

  it('shows a duplicate email next to the email field and lets the user correct it', async () => {
    fillValidForm();
    submit();
    controller
      .expectOne(REGISTER_URL)
      .flush(
        { title: 'Conflict', status: 409, detail: 'An account with this email address already exists.', code: 'CONFLICT' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(errorText('email')).toBe('An account with this email address already exists.');
    expect(input('email').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('email'));
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(submitButton().disabled).toBe(false);
    expect(input('displayName').value).toBe('Sita Sharma');

    // Editing the field clears the server message again.
    type('email', 'sita.other@example.com');
    fixture.detectChanges();
    expect(errorText('email')).toBe('');
  });

  it('maps server-side validation errors onto their fields', async () => {
    fillValidForm();
    submit();
    controller.expectOne(REGISTER_URL).flush(
      {
        title: 'Bad Request',
        status: 400,
        detail: 'One or more fields are invalid.',
        code: 'VALIDATION_FAILED',
        errors: [
          { field: 'phone', message: 'must be a Nepali mobile number such as 9812345678' },
          { field: 'displayName', message: 'must be between 2 and 80 characters' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(errorText('phone')).toBe('must be a Nepali mobile number such as 9812345678');
    expect(errorText('displayName')).toBe('must be between 2 and 80 characters');
    expect(document.activeElement).toBe(input('displayName'));
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a general alert when the server cannot be reached, and allows trying again', async () => {
    fillValidForm();
    submit();
    controller.expectOne(REGISTER_URL).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Cannot reach the server');
    expect(submitButton().disabled).toBe(false);

    submit();
    controller.expectOne(REGISTER_URL).flush(created, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toContain('Welcome');
  });

  it('shows the server message for unexpected failures', async () => {
    fillValidForm();
    submit();
    controller
      .expectOne(REGISTER_URL)
      .flush(
        { title: 'Internal Server Error', status: 500, detail: 'An unexpected error occurred. Please try again later.' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('An unexpected error occurred');
  });
});
