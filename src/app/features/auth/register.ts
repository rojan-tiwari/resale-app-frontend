import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError, toApiError } from '../../core/models/api-error';
import { User } from '../../core/models/user';
import { AuthApi } from '../../core/services/auth-api';
import {
  emailAddress,
  fieldsMatch,
  maxUtf8Bytes,
  nepalMobile,
  trimmedLength,
} from '../../shared/validators/form-validators';

type FieldName = 'displayName' | 'email' | 'phone' | 'password' | 'confirmPassword';

/** Top-to-bottom order of the fields: the first invalid one receives focus when the form is submitted. */
const FIELD_ORDER: readonly FieldName[] = ['displayName', 'email', 'phone', 'password', 'confirmPassword'];

const REQUIRED_MESSAGE: Record<FieldName, string> = {
  displayName: 'Enter your name.',
  email: 'Enter your email address.',
  phone: 'Enter your mobile number.',
  password: 'Enter a password.',
  confirmPassword: 'Enter your password again.',
};

const PASSWORD_MIN_LENGTH = 8;
/** BCrypt only looks at the first 72 bytes, so the backend refuses anything longer. */
const PASSWORD_MAX_BYTES = 72;

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
  const minlength = errors['minlength'] as { requiredLength: number } | undefined;
  if (minlength) {
    return `Use at least ${minlength.requiredLength} characters.`;
  }
  const maxlength = errors['maxlength'] as { requiredLength: number } | undefined;
  if (maxlength) {
    return `Use at most ${maxlength.requiredLength} characters.`;
  }
  const maxBytes = errors['maxBytes'] as { max: number } | undefined;
  if (maxBytes) {
    return `That password is too long. Use at most ${maxBytes.max} bytes (each Nepali letter counts as 3).`;
  }
  if (errors['nepalMobile']) {
    return 'Enter a Nepali mobile number, like 9812345678.';
  }
  return 'This value is not valid.';
}

/** Account registration. Creates the account only; signing in is a separate step (the success message links to it). */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-md">
        @if (registered(); as user) {
          <div class="card p-6 text-center sm:p-8" role="status">
            <span class="badge badge-success">Account created</span>
            <h1
              #successHeading
              tabindex="-1"
              class="mt-4 text-2xl font-bold tracking-tight text-slate-900 focus:outline-none"
            >
              Welcome, {{ user.displayName }}!
            </h1>
            <p class="mt-3 text-slate-600">
              Your account for <strong class="font-semibold break-all text-slate-900">{{ user.email }}</strong> is ready.
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a routerLink="/auth/login" class="btn btn-primary">Sign in</a>
              <a routerLink="/" class="btn btn-secondary">Continue to home</a>
            </div>
          </div>
        } @else {
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Create your account</h1>
          <p class="mt-2 text-slate-600">Buy, sell and chat with people near you. It takes less than a minute.</p>

          <form class="card mt-6 space-y-5 p-6 sm:p-8" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            @if (submitError(); as message) {
              <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
                {{ message }}
              </div>
            }

            <div>
              <label class="field-label" for="register-displayName">Display name</label>
              @let nameError = errorOf('displayName');
              <input
                id="register-displayName"
                type="text"
                class="field-input"
                formControlName="displayName"
                autocomplete="name"
                aria-required="true"
                aria-describedby="register-displayName-hint register-displayName-error"
                [attr.aria-invalid]="nameError ? 'true' : null"
              />
              <p id="register-displayName-hint" class="mt-1.5 text-sm text-slate-600">Shown on your ads and messages.</p>
              <p id="register-displayName-error" class="field-error" [hidden]="!nameError">{{ nameError }}</p>
            </div>

            <div>
              <label class="field-label" for="register-email">Email</label>
              @let emailError = errorOf('email');
              <input
                id="register-email"
                type="email"
                class="field-input"
                formControlName="email"
                autocomplete="email"
                autocapitalize="none"
                spellcheck="false"
                aria-required="true"
                aria-describedby="register-email-error"
                [attr.aria-invalid]="emailError ? 'true' : null"
              />
              <p id="register-email-error" class="field-error" [hidden]="!emailError">{{ emailError }}</p>
            </div>

            <div>
              <label class="field-label" for="register-phone">Mobile number <span class="font-normal text-slate-600">(optional)</span></label>
              @let phoneError = errorOf('phone');
              <input
                id="register-phone"
                type="tel"
                inputmode="numeric"
                class="field-input"
                formControlName="phone"
                autocomplete="tel-national"
                placeholder="9812345678"
                aria-describedby="register-phone-hint register-phone-error"
                [attr.aria-invalid]="phoneError ? 'true' : null"
              />
              <p id="register-phone-hint" class="mt-1.5 text-sm text-slate-600">
                Stays private unless you choose to show it on your ads.
              </p>
              <p id="register-phone-error" class="field-error" [hidden]="!phoneError">{{ phoneError }}</p>
            </div>

            <div>
              <label class="field-label" for="register-password">Password</label>
              @let passwordError = errorOf('password');
              <input
                id="register-password"
                type="password"
                class="field-input"
                formControlName="password"
                autocomplete="new-password"
                aria-required="true"
                aria-describedby="register-password-hint register-password-error"
                [attr.aria-invalid]="passwordError ? 'true' : null"
              />
              <p id="register-password-hint" class="mt-1.5 text-sm text-slate-600">At least {{ passwordMinLength }} characters.</p>
              <p id="register-password-error" class="field-error" [hidden]="!passwordError">{{ passwordError }}</p>
            </div>

            <div>
              <label class="field-label" for="register-confirmPassword">Confirm password</label>
              @let confirmError = errorOf('confirmPassword');
              <input
                id="register-confirmPassword"
                type="password"
                class="field-input"
                formControlName="confirmPassword"
                autocomplete="new-password"
                aria-required="true"
                aria-describedby="register-confirmPassword-error"
                [attr.aria-invalid]="confirmError ? 'true' : null"
              />
              <p id="register-confirmPassword-error" class="field-error" [hidden]="!confirmError">{{ confirmError }}</p>
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="submitting()">
              {{ submitting() ? 'Creating account…' : 'Create account' }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-slate-600">
            Already have an account?
            <a routerLink="/auth/login" class="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">
              Sign in
            </a>
          </p>
        }
      </div>
    </section>
  `,
})
export class Register {
  private readonly authApi = inject(AuthApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly successHeading = viewChild<ElementRef<HTMLElement>>('successHeading');

  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      displayName: ['', [Validators.required, trimmedLength(2, 80)]],
      email: ['', [Validators.required, emailAddress, Validators.maxLength(254)]],
      phone: ['', [nepalMobile]],
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), maxUtf8Bytes(PASSWORD_MAX_BYTES)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [fieldsMatch('password', 'confirmPassword')] },
  );

  protected readonly submitting = signal(false);
  /** Set by the first submit attempt, so untouched fields also show their errors from then on. */
  private readonly submitted = signal(false);
  /** A problem that does not belong to one field (network failure, server error, ...). */
  protected readonly submitError = signal<string | null>(null);
  protected readonly registered = signal<User | null>(null);

  /** The message to show for a field, or null while it is untouched, valid or not yet worth reporting. */
  protected errorOf(field: FieldName): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) {
      return null;
    }
    if (control.errors) {
      return describe(field, control.errors);
    }
    if (field === 'confirmPassword' && this.form.hasError('mismatch')) {
      return 'The passwords do not match.';
    }
    return null;
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

    const { displayName, email, phone, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);
    this.authApi
      .register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        phone: phone.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.form.reset();
          this.submitting.set(false);
          this.registered.set(user);
          // Move focus to the confirmation so screen-reader and keyboard users land on the result.
          afterNextRender(() => this.successHeading()?.nativeElement.focus(), { injector: this.injector });
        },
        error: (error: unknown) => this.showFailure(toApiError(error)),
      });
  }

  /** Puts server-side problems next to the fields they belong to; anything else becomes a general message. */
  private showFailure(error: ApiError): void {
    this.submitting.set(false);

    let placed = false;
    const place = (field: string, message: string): void => {
      const control = (this.form.controls as Record<string, AbstractControl | undefined>)[field];
      if (control) {
        control.setErrors({ server: message });
        control.markAsTouched();
        placed = true;
      }
    };

    if (error.status === 409) {
      // The only unique value on this form is the email address.
      place('email', error.message);
    } else {
      error.fieldErrors.forEach((fieldError) => place(fieldError.field, fieldError.message));
    }

    this.submitError.set(placed ? null : error.message);
    if (placed) {
      this.focusFirstInvalidField();
    }
  }

  private focusFirstInvalidField(): void {
    const first = FIELD_ORDER.find((field) => this.errorOf(field) !== null);
    if (first) {
      this.host.nativeElement.querySelector<HTMLElement>(`#register-${first}`)?.focus();
    }
  }
}
