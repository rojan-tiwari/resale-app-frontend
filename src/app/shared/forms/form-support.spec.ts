import { ElementRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ApiError } from '../../core/models/api-error';
import {
  emailAddress,
  fieldsMatch,
  maxUtf8Bytes,
  nepalMobile,
  trimmedLength,
} from '../validators/form-validators';
import { FormSupport, describeValidationErrors } from './form-support';

type Field = 'name' | 'email' | 'phone' | 'password' | 'confirm';

describe('describeValidationErrors', () => {
  it('uses the message of the field for a missing value', () => {
    expect(describeValidationErrors({ required: true }, 'Enter your name.')).toBe(
      'Enter your name.',
    );
  });

  it('describes the common problems in words', () => {
    expect(describeValidationErrors({ email: true }, 'x')).toBe(
      'Enter a valid email address, like name@example.com.',
    );
    expect(describeValidationErrors({ minlength: { requiredLength: 8 } }, 'x')).toBe(
      'Use at least 8 characters.',
    );
    expect(describeValidationErrors({ maxlength: { requiredLength: 80 } }, 'x')).toBe(
      'Use at most 80 characters.',
    );
    expect(describeValidationErrors({ maxBytes: { max: 72, actual: 75 } }, 'x')).toContain(
      'at most 72 bytes',
    );
    expect(describeValidationErrors({ nepalMobile: true }, 'x')).toBe(
      'Enter a Nepali mobile number, like 9812345678.',
    );
    expect(describeValidationErrors({ somethingElse: true }, 'x')).toBe('This value is not valid.');
  });

  it('lets the message of the server win over every other', () => {
    expect(
      describeValidationErrors({ required: true, server: 'Already taken.' }, 'Enter it.'),
    ).toBe('Already taken.');
  });
});

describe('FormSupport', () => {
  let host: HTMLElement;
  let form: FormGroup;
  let support: FormSupport<Field>;

  beforeEach(() => {
    host = document.createElement('div');
    host.innerHTML = (['name', 'email', 'phone', 'password', 'confirm'] as const)
      .map((field) => `<input id="t-${field}" />`)
      .join('');
    document.body.appendChild(host);

    form = new FormGroup(
      {
        name: new FormControl('', [Validators.required, trimmedLength(2, 80)]),
        email: new FormControl('', [Validators.required, emailAddress]),
        phone: new FormControl('', [nepalMobile]),
        password: new FormControl('', [
          Validators.required,
          Validators.minLength(8),
          maxUtf8Bytes(72),
        ]),
        confirm: new FormControl('', [Validators.required]),
      },
      { validators: [fieldsMatch('password', 'confirm')] },
    );
    support = new FormSupport<Field>(form, {
      idPrefix: 't',
      host: new ElementRef(host),
      order: ['name', 'email', 'phone', 'password', 'confirm'],
      requiredMessages: {
        name: 'Enter your name.',
        email: 'Enter your email address.',
        password: 'Enter a password.',
        confirm: 'Enter it again.',
      },
      confirmField: 'confirm',
    });
  });

  afterEach(() => host.remove());

  const control = (name: Field) => form.get(name) as FormControl;
  const fill = (values: Partial<Record<Field, string>>) => {
    form.patchValue({
      name: 'Sita',
      email: 'sita@example.com',
      password: 'correct horse',
      confirm: 'correct horse',
      ...values,
    });
  };
  const focused = () => document.activeElement?.id;

  describe('errorOf', () => {
    it('stays quiet about a field nobody has touched yet', () => {
      expect(support.errorOf('name')).toBeNull();
    });

    it('speaks once the field was touched', () => {
      control('name').markAsTouched();

      expect(support.errorOf('name')).toBe('Enter your name.');
    });

    it('speaks about every field once a submit was attempted', () => {
      support.submitted.set(true);

      expect(support.errorOf('email')).toBe('Enter your email address.');
      expect(support.errorOf('password')).toBe('Enter a password.');
    });

    it('describes the particular problem of a touched field', () => {
      control('email').setValue('nonsense');
      control('email').markAsTouched();
      control('password').setValue('short');
      control('password').markAsTouched();
      control('phone').setValue('123');
      control('phone').markAsTouched();

      expect(support.errorOf('email')).toBe('Enter a valid email address, like name@example.com.');
      expect(support.errorOf('password')).toBe('Use at least 8 characters.');
      expect(support.errorOf('phone')).toBe('Enter a Nepali mobile number, like 9812345678.');
    });

    it('says nothing for a valid field, and falls back for one without its own required message', () => {
      fill({});
      control('name').markAsTouched();
      expect(support.errorOf('name')).toBeNull();

      control('phone').setErrors({ required: true });
      control('phone').markAsTouched();
      expect(support.errorOf('phone')).toBe('This field is required.');
    });

    it('shows the mismatch on the confirmation field only, and only when it has no problem of its own', () => {
      fill({ confirm: 'something else' });
      support.submitted.set(true);

      expect(support.errorOf('confirm')).toBe('The passwords do not match.');
      expect(support.errorOf('password')).toBeNull();

      control('confirm').setValue('');
      expect(support.errorOf('confirm')).toBe('Enter it again.');
    });
  });

  describe('attempt', () => {
    it('lets a valid form through', () => {
      fill({});

      expect(support.attempt()).toBe(true);
      expect(support.submitted()).toBe(true);
    });

    it('stops an invalid form, shows every problem and focuses the first one', () => {
      fill({ name: '', password: 'short', confirm: 'short' });

      expect(support.attempt()).toBe(false);

      expect(support.errorOf('name')).toBe('Enter your name.');
      expect(support.errorOf('password')).toBe('Use at least 8 characters.');
      expect(focused()).toBe('t-name');
    });

    it('focuses the first invalid field in the order given, not the first in the form', () => {
      fill({ email: 'nonsense', password: '' });

      support.attempt();

      expect(focused()).toBe('t-email');
    });
  });

  describe('showServerErrors', () => {
    const fieldError = (field: string, message: string) =>
      new ApiError({ status: 400, title: 't', message: 'm', fieldErrors: [{ field, message }] });

    it('puts the server field errors next to their fields and focuses the first', () => {
      fill({});
      const error = new ApiError({
        status: 400,
        title: 't',
        message: 'm',
        fieldErrors: [
          { field: 'password', message: 'Too common.' },
          { field: 'email', message: 'Already registered.' },
        ],
      });

      expect(support.showServerErrors(error)).toBe(true);

      expect(support.errorOf('email')).toBe('Already registered.');
      expect(support.errorOf('password')).toBe('Too common.');
      expect(focused()).toBe('t-email'); // the first in form order, not in the server's order
    });

    it('reports false when no field took the error, so the page can show it in a general alert', () => {
      const general = new ApiError({ status: 429, title: 't', message: 'Too many attempts.' });

      expect(support.showServerErrors(general)).toBe(false);
      expect(support.showServerErrors(fieldError('unknownField', 'x'))).toBe(false);
    });

    it('clears a server error once the person edits the field', () => {
      fill({});
      support.showServerErrors(fieldError('email', 'Already registered.'));
      expect(support.errorOf('email')).toBe('Already registered.');

      control('email').setValue('other@example.com');

      expect(support.errorOf('email')).toBeNull();
    });
  });

  it('puts a single message next to a field and focuses it', () => {
    fill({});

    support.showFieldError('email', 'Already registered.');

    expect(support.errorOf('email')).toBe('Already registered.');
    expect(focused()).toBe('t-email');
  });

  it('moves focus to a field by name, and ignores a field that is not in the page', () => {
    support.focus('password');
    expect(focused()).toBe('t-password');

    host.querySelector('#t-confirm')?.remove();
    expect(() => support.focus('confirm')).not.toThrow();
  });
});
