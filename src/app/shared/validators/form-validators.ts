import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Reusable form validators. They mirror the backend's Bean Validation rules so people get immediate feedback,
 * but they are a convenience only: the server validates everything again and its answer always wins.
 * Each validator ignores empty values, so combine it with `Validators.required` where a value is mandatory.
 */

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Nepali mobile number (96, 97 or 98 prefix), with or without +977. Same rule as the backend `NepalPhone`. */
export const NEPAL_MOBILE_PATTERN = /^(\+977)?9[678][0-9]{8}$/;

const utf8 = new TextEncoder();

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/** A plausible email address (`name@domain.tld`). Surrounding whitespace is ignored because it is trimmed on submit. */
export function emailAddress(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (isEmpty(value) || typeof value !== 'string') {
    return null;
  }
  return EMAIL_PATTERN.test(value.trim()) ? null : { email: true };
}

/**
 * Length limits measured after trimming, because that is what is sent to the server. Reports the same
 * `minlength` / `maxlength` errors as Angular's built-in validators.
 */
export function trimmedLength(min: number, max: number): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (isEmpty(value) || typeof value !== 'string') {
      return null;
    }
    const actualLength = value.trim().length;
    if (actualLength < min) {
      return { minlength: { requiredLength: min, actualLength } };
    }
    return actualLength > max ? { maxlength: { requiredLength: max, actualLength } } : null;
  };
}

/**
 * At most `max` bytes in UTF-8. The backend limits passwords to 72 bytes (BCrypt's limit); a Nepali letter takes
 * 3 bytes, so counting characters would let a long Devanagari password through.
 */
export function maxUtf8Bytes(max: number): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (isEmpty(value) || typeof value !== 'string') {
      return null;
    }
    const actual = utf8.encode(value).length;
    return actual > max ? { maxBytes: { max, actual } } : null;
  };
}

/** An optional Nepali mobile number such as `9812345678`. */
export function nepalMobile(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (isEmpty(value) || typeof value !== 'string') {
    return null;
  }
  return NEPAL_MOBILE_PATTERN.test(value.trim()) ? null : { nepalMobile: true };
}

/**
 * Form-group validator: two fields must hold the same value (e.g. password and its confirmation).
 * Sets `mismatch` on the group, and only once the second field has been filled in.
 */
export function fieldsMatch(field: string, confirmField: string): ValidatorFn {
  return (group) => {
    const confirmValue: unknown = group.get(confirmField)?.value;
    if (isEmpty(confirmValue)) {
      return null;
    }
    return group.get(field)?.value === confirmValue ? null : { mismatch: true };
  };
}
