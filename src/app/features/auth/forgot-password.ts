import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/models/api-error';
import { AuthApi } from '../../core/services/auth-api';
import { FormSupport } from '../../shared/forms/form-support';
import { emailAddress } from '../../shared/validators/form-validators';

type FieldName = 'email';

/**
 * "Forgot your password?": asks for an e-mailed reset link. The server answers the same whether or not the address has an
 * account, and so does this page ("if an account exists ..."): it must not become a way to find out who is registered.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-md">
        @if (sentTo(); as email) {
          <div class="card p-6 text-center sm:p-8" role="status">
            <span class="badge badge-success">Check your email</span>
            <h1
              #sentHeading
              tabindex="-1"
              class="mt-4 text-2xl font-bold tracking-tight text-slate-900 focus:outline-none"
            >
              Your reset link is on its way
            </h1>
            <p class="mt-3 text-slate-600">
              If an account exists for
              <strong class="font-semibold break-all text-slate-900">{{ email }}</strong
              >, we have sent a link for choosing a new password. The link can be used once and
              expires soon.
            </p>
            <p class="mt-2 text-sm text-slate-600">
              Nothing there? Look in your spam folder, or ask for a new link.
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a routerLink="/auth/login" class="btn btn-primary">Back to sign in</a>
              <button type="button" class="btn btn-secondary" (click)="askAgain()">
                Use a different email
              </button>
            </div>
          </div>
        } @else {
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Forgot your password?
          </h1>
          <p class="mt-2 text-slate-600">
            Enter the email address of your account and we will send you a link for choosing a new
            password.
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
              <label class="field-label" for="forgot-email">Email</label>
              @let emailError = support.errorOf('email');
              <input
                id="forgot-email"
                type="email"
                class="field-input"
                formControlName="email"
                autocomplete="email"
                autocapitalize="none"
                spellcheck="false"
                aria-required="true"
                aria-describedby="forgot-email-error"
                [attr.aria-invalid]="emailError ? 'true' : null"
              />
              <p id="forgot-email-error" class="field-error" [hidden]="!emailError">
                {{ emailError }}
              </p>
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="submitting()">
              {{ submitting() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-slate-600">
            Remembered it?
            <a
              routerLink="/auth/login"
              class="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Back to sign in
            </a>
          </p>
        }
      </div>
    </section>
  `,
})
export class ForgotPassword {
  private readonly authApi = inject(AuthApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly sentHeading = viewChild<ElementRef<HTMLElement>>('sentHeading');

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, emailAddress, Validators.maxLength(254)]],
  });

  protected readonly support = new FormSupport<FieldName>(this.form, {
    idPrefix: 'forgot',
    host: inject<ElementRef<HTMLElement>>(ElementRef),
    order: ['email'],
    requiredMessages: { email: 'Enter your email address.' },
  });

  protected readonly submitting = signal(false);
  /** A problem that does not belong to the field: too many requests, a network failure, ... */
  protected readonly submitError = signal<string | null>(null);
  /** The address the request was made for, once it was accepted. */
  protected readonly sentTo = signal<string | null>(null);

  protected submit(): void {
    if (this.submitting() || !this.support.attempt()) {
      return;
    }
    const email = this.form.getRawValue().email.trim();
    this.submitting.set(true);
    this.submitError.set(null);
    this.authApi
      .forgotPassword({ email })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.sentTo.set(email);
          // Move focus to the confirmation so screen-reader and keyboard users land on the result.
          afterNextRender(() => this.sentHeading()?.nativeElement.focus(), {
            injector: this.injector,
          });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const failure = toApiError(error);
          if (!this.support.showServerErrors(failure)) {
            this.submitError.set(failure.message);
          }
        },
      });
  }

  protected askAgain(): void {
    this.sentTo.set(null);
    this.form.reset();
    this.support.submitted.set(false);
  }
}
