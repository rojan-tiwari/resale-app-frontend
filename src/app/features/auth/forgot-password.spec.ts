import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { ForgotPassword } from './forgot-password';

const FORGOT_URL = '/api/v1/auth/forgot-password';

describe('ForgotPassword', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let controller: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ForgotPassword);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const email = () => root.querySelector<HTMLInputElement>('#forgot-email') as HTMLInputElement;
  const emailError = () => root.querySelector('#forgot-email-error')?.textContent?.trim() ?? '';
  const submitButton = () =>
    root.querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement;
  const alert = () => root.querySelector('form [role="alert"]');

  function typeEmail(value: string): void {
    email().value = value;
    email().dispatchEvent(new Event('input'));
  }

  function submit(): void {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('asks for an email address and links back to sign in', () => {
    expect(root.querySelector('h1')?.textContent).toContain('Forgot your password?');
    expect(email().getAttribute('autocomplete')).toBe('email');
    expect(root.querySelector('label[for="forgot-email"]')?.textContent).toContain('Email');
    expect(root.querySelector('a[href="/auth/login"]')).not.toBeNull();
  });

  it('asks for an address when it is empty, focuses the field and sends nothing', () => {
    submit();

    expect(emailError()).toBe('Enter your email address.');
    expect(email().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(email());
    controller.expectNone(FORGOT_URL);
  });

  it('rejects something that is not an address', () => {
    typeEmail('nonsense');

    submit();

    expect(emailError()).toBe('Enter a valid email address, like name@example.com.');
    controller.expectNone(FORGOT_URL);
  });

  it('sends the trimmed address, and shows a confirmation that does not say whether the account exists', () => {
    typeEmail('  sita@example.com ');
    submit();

    const request = controller.expectOne(FORGOT_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'sita@example.com' });
    request.flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();

    const confirmation = root.querySelector('[role="status"]');
    expect(confirmation?.textContent).toContain('Your reset link is on its way');
    expect(confirmation?.textContent).toContain('sita@example.com');
    // It must read the same for an unknown address: "if", never "we found your account".
    expect(confirmation?.textContent).toContain('If an account exists');
    expect(root.querySelector('form')).toBeNull();
  });

  it('moves focus to the confirmation, so screen-reader users land on the result', async () => {
    typeEmail('sita@example.com');
    submit();
    controller.expectOne(FORGOT_URL).flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(root.querySelector('h1'));
  });

  it('lets the person try a different address', () => {
    typeEmail('wrong@example.com');
    submit();
    controller.expectOne(FORGOT_URL).flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('[role="status"] button')?.click();
    fixture.detectChanges();

    expect(root.querySelector('form')).not.toBeNull();
    expect(email().value).toBe('');
    expect(emailError()).toBe('');
  });

  it('disables the button while the request is on its way, and sends once', () => {
    typeEmail('sita@example.com');
    submit();

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain('Sending');
    submit();

    expect(controller.match(FORGOT_URL)).toHaveLength(1);
  });

  it('shows how long to wait when asked too often, and keeps the form', () => {
    typeEmail('sita@example.com');
    submit();

    controller
      .expectOne(FORGOT_URL)
      .flush(
        {
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many attempts. Please try again in 42 minutes.',
          code: 'TOO_MANY_REQUESTS',
        },
        { status: 429, statusText: 'Too Many Requests' },
      );
    fixture.detectChanges();

    expect(alert()?.textContent).toContain('Please try again in 42 minutes.');
    expect(root.querySelector('form')).not.toBeNull();
    expect(submitButton().disabled).toBe(false);
  });

  it('puts a field error from the server next to the field', () => {
    typeEmail('sita@example.com');
    submit();

    controller.expectOne(FORGOT_URL).flush(
      {
        title: 'Bad Request',
        status: 400,
        detail: 'One or more fields are invalid.',
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', message: 'must be a valid email address' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(emailError()).toBe('must be a valid email address');
    expect(alert()).toBeNull();
  });

  it('says so when the server cannot be reached', () => {
    typeEmail('sita@example.com');
    submit();

    controller.expectOne(FORGOT_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(alert()?.textContent).toContain('Cannot reach the server');
  });
});
