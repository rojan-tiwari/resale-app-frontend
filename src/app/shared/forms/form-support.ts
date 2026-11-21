import { ElementRef, signal } from '@angular/core';
import { FormGroup, ValidationErrors } from '@angular/forms';
import { ApiError } from '../../core/models/api-error';

/**
 * The words for the validation errors every form here can produce. `requiredMessage` is the one thing that differs
 * per field ("Enter your email address."). A message from the server (`server`) always wins: it knows best.
 */
export function describeValidationErrors(
  errors: ValidationErrors,
  requiredMessage: string,
): string {
  const server: unknown = errors['server'];
  if (typeof server === 'string') {
    return server;
  }
  if (errors['required']) {
    return requiredMessage;
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

export interface FormSupportOptions<F extends string> {
  /** The form's element ids are `${idPrefix}-${field}` (`profile-displayName`), so focus can be moved to a field. */
  readonly idPrefix: string;
  /** The component's host element, to look the fields up in. */
  readonly host: ElementRef<HTMLElement>;
  /** The fields from top to bottom: the first invalid one receives focus when the form is submitted. */
  readonly order: readonly F[];
  /** What to say when a required field is empty. Fields that are never required can leave it out. */
  readonly requiredMessages: Readonly<Partial<Record<F, string>>>;
  /** The field that repeats another (a password confirmation): it shows the form-level `mismatch` error. */
  readonly confirmField?: F;
}

/**
 * The plumbing every form page needs, in one place: which message belongs to which field and when to show it, "submit
 * attempted" state, placing the server's field errors next to their fields, and moving focus to the first problem.
 * A page keeps its own form, submit logic and template; this only answers "what should this field say?".
 *
 * Messages stay hidden until a field was touched or a submit was attempted, so people are not scolded while they type.
 */
export class FormSupport<F extends string> {
  /** Set by the first submit attempt, so untouched fields also show their errors from then on. */
  readonly submitted = signal(false);

  constructor(
    private readonly form: FormGroup,
    private readonly options: FormSupportOptions<F>,
  ) {}

  /** The message to show for a field, or null while it is untouched, valid or not yet worth reporting. */
  errorOf(field: F): string | null {
    const control = this.form.get(field);
    if (!control || (!control.touched && !this.submitted())) {
      return null;
    }
    if (control.errors) {
      return describeValidationErrors(
        control.errors,
        this.options.requiredMessages[field] ?? 'This field is required.',
      );
    }
    if (field === this.options.confirmField && this.form.hasError('mismatch')) {
      return 'The passwords do not match.';
    }
    return null;
  }

  /**
   * Call first thing when the form is submitted. Returns true when it is valid and may be sent. Otherwise every problem is
   * shown and focus moves to the first invalid field.
   */
  attempt(): boolean {
    this.submitted.set(true);
    if (this.form.valid) {
      return true;
    }
    this.form.markAllAsTouched();
    this.focusFirstInvalidField();
    return false;
  }

  /**
   * Puts the server's field errors next to their fields and focuses the first. Returns whether any field took one: when
   * none did (a network failure, a rate limit, a refused link) the page shows the message in a general alert instead.
   */
  showServerErrors(error: ApiError): boolean {
    let placed = false;
    for (const fieldError of error.fieldErrors) {
      const control = this.form.get(fieldError.field);
      if (control) {
        control.setErrors({ server: fieldError.message });
        control.markAsTouched();
        placed = true;
      }
    }
    if (placed) {
      this.focusFirstInvalidField();
    }
    return placed;
  }

  /** Puts one message next to a field (for problems the server reports without a field list, such as a 409). */
  showFieldError(field: F, message: string): void {
    const control = this.form.get(field);
    if (control) {
      control.setErrors({ server: message });
      control.markAsTouched();
      this.focusFirstInvalidField();
    }
  }

  focusFirstInvalidField(): void {
    const first = this.options.order.find((field) => this.errorOf(field) !== null);
    if (first) {
      this.focus(first);
    }
  }

  focus(field: F): void {
    this.options.host.nativeElement
      .querySelector<HTMLElement>(`#${this.options.idPrefix}-${field}`)
      ?.focus();
  }
}
