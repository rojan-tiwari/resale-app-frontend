import { FormControl, FormGroup } from '@angular/forms';
import {
  emailAddress,
  fieldsMatch,
  maxDecimals,
  maxUtf8Bytes,
  nepalMobile,
  trimmedLength,
} from './form-validators';

describe('form validators', () => {
  describe('emailAddress', () => {
    it.each(['sita@example.com', 'sita.sharma+ads@mail.example.com.np', '  sita@example.com  '])(
      'accepts %j',
      (value) => {
        expect(emailAddress(new FormControl(value))).toBeNull();
      },
    );

    it.each(['plain', 'a@b', '@example.com', 'sita@', 'two words@example.com'])(
      'rejects %j',
      (value) => {
        expect(emailAddress(new FormControl(value))).toEqual({ email: true });
      },
    );

    it('ignores empty values so that `required` stays in charge of them', () => {
      expect(emailAddress(new FormControl(''))).toBeNull();
      expect(emailAddress(new FormControl(null))).toBeNull();
    });
  });

  describe('trimmedLength', () => {
    const validator = trimmedLength(2, 5);

    it('measures the trimmed text, the same way the server does', () => {
      expect(validator(new FormControl('  ab  '))).toBeNull();
      expect(validator(new FormControl(' a '))).toEqual({
        minlength: { requiredLength: 2, actualLength: 1 },
      });
      expect(validator(new FormControl('abcdef'))).toEqual({
        maxlength: { requiredLength: 5, actualLength: 6 },
      });
    });

    it('ignores empty values', () => {
      expect(validator(new FormControl(''))).toBeNull();
    });
  });

  describe('maxUtf8Bytes', () => {
    const validator = maxUtf8Bytes(72);

    it('accepts exactly 72 bytes and rejects 73', () => {
      expect(validator(new FormControl('a'.repeat(72)))).toBeNull();
      expect(validator(new FormControl('a'.repeat(73)))).toEqual({
        maxBytes: { max: 72, actual: 73 },
      });
    });

    it('counts bytes, not characters: a Nepali letter takes 3', () => {
      expect(validator(new FormControl('क'.repeat(24)))).toBeNull();
      expect(validator(new FormControl('क'.repeat(25)))).toEqual({
        maxBytes: { max: 72, actual: 75 },
      });
    });
  });

  describe('nepalMobile', () => {
    it.each(['9812345678', '9712345678', '9612345678', '+9779812345678'])('accepts %j', (value) => {
      expect(nepalMobile(new FormControl(value))).toBeNull();
    });

    it.each(['123', '9512345678', '98123456789', '+9769812345678', '98 12345678', '९८१२३४५६७८'])(
      'rejects %j',
      (value) => {
        expect(nepalMobile(new FormControl(value))).toEqual({ nepalMobile: true });
      },
    );

    it('is optional', () => {
      expect(nepalMobile(new FormControl(''))).toBeNull();
    });
  });

  describe('fieldsMatch', () => {
    const group = (password: string, confirm: string) =>
      new FormGroup(
        { password: new FormControl(password), confirm: new FormControl(confirm) },
        fieldsMatch('password', 'confirm'),
      );

    it('flags differing values', () => {
      expect(group('secret-1', 'secret-2').errors).toEqual({ mismatch: true });
    });

    it('accepts equal values', () => {
      expect(group('secret-1', 'secret-1').errors).toBeNull();
    });

    it('stays quiet until the confirmation has been filled in', () => {
      expect(group('secret-1', '').errors).toBeNull();
    });

    it('re-evaluates when the first field changes', () => {
      const form = group('secret-1', 'secret-1');
      form.controls.password.setValue('changed');
      expect(form.errors).toEqual({ mismatch: true });
    });
  });

  describe('maxDecimals', () => {
    const check = (value: unknown) => maxDecimals(2)(new FormControl(value));

    it('accepts whole numbers and up to two decimals', () => {
      for (const value of [0, 1, 1250, 1250.5, 1250.55, 0.01, 10.1, 19.99, 99999999.99]) {
        expect(check(value), String(value)).toBeNull();
      }
    });

    it('does not reject a correctly typed value because of floating-point noise', () => {
      // 1.005 * 100 is 100.49999999999999 in floating point; 10.1 * 100 is 1010.0000000000001: both must be judged on what was typed.
      expect(check(10.1)).toBeNull();
      expect(check(4.35)).toBeNull();
      expect(check(1.15)).toBeNull();
    });

    it('rejects a third decimal', () => {
      expect(check(1.005)).toEqual({ decimals: { max: 2 } });
      expect(check(10.123)).toEqual({ decimals: { max: 2 } });
      expect(check(0.001)).toEqual({ decimals: { max: 2 } });
    });

    it('ignores empty and non-numeric values so it can be combined with required', () => {
      for (const value of [null, undefined, '', 'abc', NaN, Infinity]) {
        expect(check(value), String(value)).toBeNull();
      }
    });
  });
});
