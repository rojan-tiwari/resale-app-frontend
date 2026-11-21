import { Component, DestroyRef, ElementRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Toasts } from '../../core/notifications/toasts';
import { toApiError } from '../../core/models/api-error';
import { AuthApi } from '../../core/services/auth-api';
import { FormSupport } from '../../shared/forms/form-support';
import { fieldsMatch, maxUtf8Bytes } from '../../shared/validators/form-validators';

type FieldName = 'newPassword' | 'confirmPassword';

const PASSWORD_MIN_LENGTH = 8;
/** BCrypt only looks at the first 72 bytes, so the backend refuses anything longer. */
const PASSWORD_MAX_BYTES = 72;

/**
 * The page the link in the reset e-mail opens (`/auth/reset-password?token=...`): choose a new password. The token is
 * taken out of the address bar as soon as the page has read it, so it does not stay in the browser history or travel in a
 * `Referer` header. A link that is missing, used up or expired shows a way to ask for a new one instead of a form.
 */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-md">
        @if (linkProblem()) {
          <div class="card p-6 text-center sm:p-8" role="alert">
            <span class="badge badge-danger">Link not valid</span>
            <h1 class="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              This link does not work
            </h1>
            <p class="mt-3 text-slate-600">
              It may have expired, or it was already used. Reset links work once and only for a
              short time.
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a routerLink="/auth/forgot-password" class="btn btn-primary">Get a new link</a>
              <a routerLink="/auth/login" class="btn btn-secondary">Back to sign in</a>
            </div>
          </div>
        } @else {
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Choose a new password
          </h1>
          <p class="mt-2 text-slate-600">
            You will be signed out everywhere and can sign in again with the new password.
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
              <label class="field-label" for="reset-newPassword">New password</label>
              @let passwordError = support.errorOf('newPassword');
              <input
                id="reset-newPassword"
                type="password"
                class="field-input"
                formControlName="newPassword"
                autocomplete="new-password"
                aria-required="true"
                aria-describedby="reset-newPassword-hint reset-newPassword-error"
                [attr.aria-invalid]="passwordError ? 'true' : null"
              />
              <p id="reset-newPassword-hint" class="mt-1.5 text-sm text-slate-600">
                At least {{ passwordMinLength }} characters.
              </p>
              <p id="reset-newPassword-error" class="field-error" [hidden]="!passwordError">
                {{ passwordError }}
              </p>
            </div>

            <div>
              <label class="field-label" for="reset-confirmPassword">Confirm new password</label>
              @let confirmError = support.errorOf('confirmPassword');
              <input
                id="reset-confirmPassword"
                type="password"
                class="field-input"
                formControlName="confirmPassword"
                autocomplete="new-password"
                aria-required="true"
                aria-describedby="reset-confirmPassword-error"
                [attr.aria-invalid]="confirmError ? 'true' : null"
              />
              <p id="reset-confirmPassword-error" class="field-error" [hidden]="!confirmError">
                {{ confirmError }}
              </p>
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="submitting()">
              {{ submitting() ? 'Saving…' : 'Change password' }}
            </button>
          </form>
        }
      </div>
    </section>
  `,
})
export class ResetPassword implements OnInit {
  private readonly authApi = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the `?token=` query parameter (router input binding). Read once, in `ngOnInit`, then removed from the address. */
  readonly token = input<string>();

  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
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
    idPrefix: 'reset',
    host: inject<ElementRef<HTMLElement>>(ElementRef),
    order: ['newPassword', 'confirmPassword'],
    requiredMessages: {
      newPassword: 'Enter a new password.',
      confirmPassword: 'Enter the new password again.',
    },
    confirmField: 'confirmPassword',
  });

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  /** The link is missing, unknown, used or expired: there is nothing to submit. */
  protected readonly linkProblem = signal(false);
  private resetToken: string | null = null;

  ngOnInit(): void {
    const token = this.token()?.trim();
    if (!token) {
      this.linkProblem.set(true);
      return;
    }
    this.resetToken = token;
    // Take the secret out of the address bar and the history; the page keeps it in memory.
    void this.router.navigate([], {
      queryParams: { token: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected submit(): void {
    if (this.submitting() || this.resetToken === null || !this.support.attempt()) {
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.authApi
      .resetPassword({ token: this.resetToken, newPassword: this.form.getRawValue().newPassword })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toasts.success('Your password was changed. Sign in with your new password.');
          void this.router.navigateByUrl('/auth/login');
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const failure = toApiError(error);
          if (failure.isInvalidToken) {
            this.linkProblem.set(true);
          } else if (!this.support.showServerErrors(failure)) {
            this.submitError.set(failure.message);
          }
        },
      });
  }
}
