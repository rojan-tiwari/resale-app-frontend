import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { toApiError } from '../../core/models/api-error';
import { Toasts } from '../../core/notifications/toasts';
import { FormSupport } from '../../shared/forms/form-support';
import { fieldsMatch, maxUtf8Bytes } from '../../shared/validators/form-validators';
import { ProfileNav } from './profile-nav';

type FieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';

const PASSWORD_MIN_LENGTH = 8;
/** BCrypt only looks at the first 72 bytes, so the backend refuses anything longer. */
const PASSWORD_MAX_BYTES = 72;

/**
 * Changing the password of the signed-in account. The server ends every session when it succeeds (this one too), so the
 * page sends the person to the login page with a message instead of leaving them on a screen that no longer works.
 */
@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, ProfileNav],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-xl">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your account</h1>
        <app-profile-nav class="mt-4" />

        <form
          class="card mt-6 space-y-5 p-6 sm:p-8"
          [formGroup]="form"
          (ngSubmit)="submit()"
          novalidate
        >
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Change your password</h2>
            <p class="mt-1 text-sm text-slate-600">
              After the change you are signed out on all your devices and sign in again with the new
              password.
            </p>
          </div>

          @if (submitError(); as message) {
            <div
              class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              role="alert"
            >
              {{ message }}
            </div>
          }

          <div>
            <label class="field-label" for="password-currentPassword">Current password</label>
            @let currentError = support.errorOf('currentPassword');
            <input
              id="password-currentPassword"
              type="password"
              class="field-input"
              formControlName="currentPassword"
              autocomplete="current-password"
              aria-required="true"
              aria-describedby="password-currentPassword-error"
              [attr.aria-invalid]="currentError ? 'true' : null"
            />
            <p id="password-currentPassword-error" class="field-error" [hidden]="!currentError">
              {{ currentError }}
            </p>
          </div>

          <div>
            <label class="field-label" for="password-newPassword">New password</label>
            @let newError = support.errorOf('newPassword');
            <input
              id="password-newPassword"
              type="password"
              class="field-input"
              formControlName="newPassword"
              autocomplete="new-password"
              aria-required="true"
              aria-describedby="password-newPassword-hint password-newPassword-error"
              [attr.aria-invalid]="newError ? 'true' : null"
            />
            <p id="password-newPassword-hint" class="mt-1.5 text-sm text-slate-600">
              At least {{ passwordMinLength }} characters.
            </p>
            <p id="password-newPassword-error" class="field-error" [hidden]="!newError">
              {{ newError }}
            </p>
          </div>

          <div>
            <label class="field-label" for="password-confirmPassword">Confirm new password</label>
            @let confirmError = support.errorOf('confirmPassword');
            <input
              id="password-confirmPassword"
              type="password"
              class="field-input"
              formControlName="confirmPassword"
              autocomplete="new-password"
              aria-required="true"
              aria-describedby="password-confirmPassword-error"
              [attr.aria-invalid]="confirmError ? 'true' : null"
            />
            <p id="password-confirmPassword-error" class="field-error" [hidden]="!confirmError">
              {{ confirmError }}
            </p>
          </div>

          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Changing…' : 'Change password' }}
          </button>
        </form>
      </div>
    </section>
  `,
})
export class ChangePassword {
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', [Validators.required, maxUtf8Bytes(PASSWORD_MAX_BYTES)]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(PASSWORD_MIN_LENGTH),
          maxUtf8Bytes(PASSWORD_MAX_BYTES),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [fieldsMatch('newPassword', 'confirmPassword')] },
  );

  protected readonly support = new FormSupport<FieldName>(this.form, {
    idPrefix: 'password',
    host: inject<ElementRef<HTMLElement>>(ElementRef),
    order: ['currentPassword', 'newPassword', 'confirmPassword'],
    requiredMessages: {
      currentPassword: 'Enter your current password.',
      newPassword: 'Enter a new password.',
      confirmPassword: 'Enter the new password again.',
    },
    confirmField: 'confirmPassword',
  });

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting() || !this.support.attempt()) {
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);
    this.submitError.set(null);
    this.session
      .changePassword({ currentPassword, newPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toasts.info(
            'Your password was changed and you were signed out everywhere. Sign in with the new password.',
          );
          void this.router.navigateByUrl('/auth/login');
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const failure = toApiError(error);
          // A wrong current password arrives as a field error on `currentPassword`; a rate limit or a network failure does not.
          if (!this.support.showServerErrors(failure)) {
            this.submitError.set(failure.message);
          }
        },
      });
  }
}
