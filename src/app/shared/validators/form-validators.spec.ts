import { FormControl, FormGroup } from '@angular/forms';
import { emailAddress, fieldsMatch, maxUtf8Bytes, nepalMobile, trimmedLength } from './form-validators';

describe('form validators', () => {
  describe('emailAddress', () => {
    it.each(['sita@example.com', 'sita.sharma+ads@mail.example.com.np', '  sita@example.com  '])('accepts %j', (value) => {
      expect(emailAddress(new FormControl(value))).toBeNull();
    });

    it.each(['plain', 'a@b', '@example.com', 'sita@', 'two words@example.com'])('rejects %j', (value) => {
      expect(emailAddress(new FormControl(value))).toEqual({ email: true });
    });

    it('ignores empty values so that `required` stays in charge of them', () => {
      expect(emailAddress(new FormControl(''))).toBeNull();
      expect(emailAddress(new FormControl(null))).toBeNull();
    });
  });

  describe('trimmedLength', () => {
    const validator = trimmedLength(2, 5);

    it('measures the trimmed text, the same way the server does', () => {
      expect(validator(new FormControl('  ab  '))).toBeNull();
      expect(validator(new FormControl(' a '))).toEqual({ minlength: { requiredLength: 2, actualLength: 1 } });
      expect(validator(new FormControl('abcdef'))).toEqual({ maxlength: { requiredLength: 5, actualLength: 6 } });
    });

    it('ignores empty values', () => {
      expect(validator(new FormControl(''))).toBeNull();
    });
  });

  describe('maxUtf8Bytes', () => {
    const validator = maxUtf8Bytes(72);

    it('accepts exactly 72 bytes and rejects 73', () => {
      expect(validator(new FormControl('a'.repeat(72)))).toBeNull();
      expect(validator(new FormControl('a'.repeat(73)))).toEqual({ maxBytes: { max: 72, actual: 73 } });
    });

    it('counts bytes, not characters: a Nepali letter takes 3', () => {
      expect(validator(new FormControl('क'.repeat(24)))).toBeNull();
      expect(validator(new FormControl('क'.repeat(25)))).toEqual({ maxBytes: { max: 72, actual: 75 } });
    });
  });

  describe('nepalMobile', () => {
    it.each(['9812345678', '9712345678', '9612345678', '+9779812345678'])('accepts %j', (value) => {
      expect(nepalMobile(new FormControl(value))).toBeNull();
    });

    it.each(['123', '9512345678', '98123456789', '+9769812345678', '98 12345678', '९८१२३४५६७८'])('rejects %j', (value) => {
      expect(nepalMobile(new FormControl(value))).toEqual({ nepalMobile: true });
    });

    it('is optional', () => {
      expect(nepalMobile(new FormControl(''))).toBeNull();
    });
  });

  describe('fieldsMatch', () => {
    const group = (password: string, confirm: string) =>
      new FormGroup({ password: new FormControl(password), confirm: new FormControl(confirm) }, fieldsMatch('password', 'confirm'));

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
});
