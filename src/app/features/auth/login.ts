import { Component, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { ApiError, toApiError } from '../../core/models/api-error';
import { emailAddress } from '../../shared/validators/form-validators';

type FieldName = 'email' | 'password';

/** Top-to-bottom order of the fields: the first invalid one receives focus when the form is submitted. */
const FIELD_ORDER: readonly FieldName[] = ['email', 'password'];

const REQUIRED_MESSAGE: Record<FieldName, string> = {
  email: 'Enter your email address.',
  password: 'Enter your password.',
};

function describe(field: FieldName, errors: ValidationErrors): string {
  const server: unknown = errors['server'];
  if (typeof server === 'string') {
    return server;
  }
  if (errors['required']) {
    return REQUIRED_MESSAGE[field];
  }
  if (errors['email']) {
    return 'Enter a valid email address, like name@example.com.';
  }
  return 'This value is not valid.';
}

/**
 * Where to go after signing in. Only a path inside this app is accepted: a `returnUrl` such as `//evil.example` or
 * `https://evil.example` would turn the login page into an open redirect.
 */
export function safeReturnUrl(value: string | undefined): string {
  const isLocalPath =
    !!value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
  return isLocalPath ? value : '/';
}

/** Sign-in with email and password. The session itself is held by `AuthSession`. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-md">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sign in</h1>
        <p class="mt-2 text-slate-600">
          Welcome back. Sign in to post ads, save favourites and chat with buyers and sellers.
        </p>

        <form
          class="card mt-6 space-y-5 p-6 sm:p-8"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          @if (submitError(); as message) {
            <div
              class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              role="alert"
            >
              {{ message }}
            </div>
          }

          <div>
            <label class="field-label" for="login-email">Email</label>
            @let emailError = errorOf('email');
            <input
              id="login-email"
              type="email"
              class="field-input"
              formControlName="email"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              aria-required="true"
              aria-describedby="login-email-error"
              [attr.aria-invalid]="emailError ? 'true' : null"
            />
            <p id="login-email-error" class="field-error" [hidden]="!emailError">
              {{ emailError }}
            </p>
          </div>

          <div>
            <label class="field-label" for="login-password">Password</label>
            @let passwordError = errorOf('password');
            <input
              id="login-password"
              type="password"
              class="field-input"
              formControlName="password"
              autocomplete="current-password"
              aria-required="true"
              aria-describedby="login-password-error"
              [attr.aria-invalid]="passwordError ? 'true' : null"
            />
            <p id="login-password-error" class="field-error" [hidden]="!passwordError">
              {{ passwordError }}
            </p>
          </div>

          <button type="submit" class="btn btn-primary w-full" [disabled]="submitting()">
            {{ submitting() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-600">
          New to ResaleMarket?
          <a
            routerLink="/auth/register"
            class="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            Create an account
          </a>
        </p>
      </div>
    </section>
  `,
})
export class Login {
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Bound from the `?returnUrl=` query parameter (router input binding): the page the person wanted before being sent here. */
  readonly returnUrl = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, emailAddress]],
    password: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  /** Set by the first submit attempt, so untouched fields also show their errors from then on. */
  private readonly submitted = signal(false);
  /** A problem that does not belong to one field (wrong credentials, suspended account, network failure, ...). */
  protected readonly submitError = signal<string | null>(null);

  /** The message to show for a field, or null while it is untouched or valid. */
  protected errorOf(field: FieldName): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) {
      return null;
    }
    return control.errors ? describe(field, control.errors) : null;
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);
    this.session
      .login({ email: email.trim(), password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
        error: (error: unknown) => this.showFailure(toApiError(error)),
      });
  }

  /** Puts server-side field problems next to their fields; everything else (wrong password, suspended, offline) becomes one alert. */
  private showFailure(error: ApiError): void {
    this.submitting.set(false);

    let placed = false;
    for (const fieldError of error.fieldErrors) {
      const control = (this.form.controls as Record<string, AbstractControl | undefined>)[
        fieldError.field
      ];
      if (control) {
        control.setErrors({ server: fieldError.message });
        control.markAsTouched();
        placed = true;
      }
    }

    if (placed) {
      this.submitError.set(null);
      this.focusFirstInvalidField();
      return;
    }

    this.submitError.set(error.message);
    if (error.isUnauthorized) {
      // The usual slip is the password: clear it and put the cursor there for another try.
      this.form.controls.password.reset('');
      this.host.nativeElement.querySelector<HTMLElement>('#login-password')?.focus();
    }
  }

  private focusFirstInvalidField(): void {
    const first = FIELD_ORDER.find((field) => this.errorOf(field) !== null);
    if (first) {
      this.host.nativeElement.querySelector<HTMLElement>(`#login-${first}`)?.focus();
    }
  }
}
