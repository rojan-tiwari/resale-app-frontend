import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { District, Municipality, Province } from '../../core/models/location';
import { User } from '../../core/models/user';
import { Toasts } from '../../core/notifications/toasts';
import { Profile } from './profile';

const ME_URL = '/api/v1/users/me';
const PROVINCES_URL = '/api/v1/locations/provinces';

const provinces: Province[] = [
  { id: 1, name: 'Koshi', slug: 'koshi', nameNe: null },
  { id: 3, name: 'Bagmati', slug: 'bagmati', nameNe: null },
];
const koshiDistricts: District[] = [{ id: 7, provinceId: 1, name: 'Morang', slug: 'morang' }];
const bagmatiDistricts: District[] = [
  { id: 25, provinceId: 3, name: 'Kathmandu', slug: 'kathmandu' },
  { id: 26, provinceId: 3, name: 'Lalitpur', slug: 'lalitpur' },
];
const kathmanduCities: Municipality[] = [
  {
    id: 1,
    districtId: 25,
    name: 'Kathmandu Metropolitan City',
    slug: 'kathmandu',
    type: 'METROPOLITAN',
    major: true,
  },
  { id: 2, districtId: 25, name: 'Kirtipur', slug: 'kirtipur', type: 'MUNICIPALITY', major: false },
];

const account: User = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  email: 'sita@example.com',
  displayName: 'Sita Sharma',
  phone: '+9779812345678',
  showPhone: true,
  bio: 'I sell books',
  provinceId: 3,
  districtId: 25,
  municipalityId: 1,
  createdAt: '2026-10-20T08:15:00Z',
  roles: ['ROLE_USER'],
};

describe('Profile', () => {
  let fixture: ComponentFixture<Profile>;
  let controller: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Profile);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => controller.verify());

  const input = (name: string) =>
    root.querySelector<HTMLInputElement>(`#profile-${name}`) as HTMLInputElement;
  const select = (name: string) =>
    root.querySelector<HTMLSelectElement>(`#profile-${name}`) as HTMLSelectElement;
  const errorText = (name: string) =>
    root.querySelector(`#profile-${name}-error`)?.textContent?.trim() ?? '';
  const alert = () => root.querySelector('form [role="alert"]');
  const saveButton = () =>
    root.querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement;
  const chosen = (name: string) => select(name).selectedOptions[0]?.textContent?.trim();
  const optionLabels = (name: string) =>
    Array.from(select(name).options).map((option) => option.textContent?.trim());

  /** Starts the page and answers everything it asks for, for an account with a saved place. */
  function openWith(user: User = account): void {
    fixture.detectChanges();
    controller.expectOne(ME_URL).flush(user);
    controller.expectOne(PROVINCES_URL).flush(provinces);
    if (user.provinceId !== null) {
      controller
        .expectOne(`/api/v1/locations/provinces/${user.provinceId}/districts`)
        .flush(user.provinceId === 3 ? bagmatiDistricts : koshiDistricts);
    }
    if (user.districtId !== null) {
      controller
        .expectOne(`/api/v1/locations/districts/${user.districtId}/municipalities`)
        .flush(kathmanduCities);
    }
    fixture.detectChanges();
  }

  function type(name: string, value: string): void {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function choose(name: string, label: string): void {
    const option = Array.from(select(name).options).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!option) {
      throw new Error(`No option "${label}" in ${name}: ${optionLabels(name).join(', ')}`);
    }
    select(name).value = option.value;
    select(name).dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function save(): void {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  const saved = (overrides: Partial<User> = {}): User => ({ ...account, ...overrides });

  describe('loading', () => {
    it('shows a placeholder, not an empty form, while the profile loads', () => {
      fixture.detectChanges();

      expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(root.querySelector('form')).toBeNull();

      controller.expectOne(ME_URL).flush(account);
      controller.expectOne(PROVINCES_URL).flush(provinces);
      controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmatiDistricts);
      controller.expectOne('/api/v1/locations/districts/25/municipalities').flush(kathmanduCities);
    });

    it('says what went wrong and offers to try again, then shows the form', () => {
      fixture.detectChanges();
      controller.expectOne(ME_URL).flush(
        {
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred. Please try again later.',
        },
        { status: 500, statusText: 'Internal Server Error' },
      );
      controller.expectOne(PROVINCES_URL).flush(provinces);
      fixture.detectChanges();

      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'Your profile could not be loaded',
      );
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'An unexpected error occurred',
      );
      expect(root.querySelector('form')).toBeNull();

      root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
      fixture.detectChanges();
      controller
        .expectOne(ME_URL)
        .flush({ ...account, provinceId: null, districtId: null, municipalityId: null });
      controller.expectOne(PROVINCES_URL).flush(provinces);
      fixture.detectChanges();

      expect(root.querySelector('form')).not.toBeNull();
    });

    it('shows the account navigation', () => {
      openWith();

      expect(root.querySelector('app-profile-nav a[href="/profile"]')?.textContent).toContain(
        'Your details',
      );
      expect(
        root.querySelector('app-profile-nav a[href="/profile/password"]')?.textContent,
      ).toContain('Password');
    });
  });

  describe('the form', () => {
    it('is filled from the account, with the phone number as people type it', () => {
      openWith();

      expect(input('displayName').value).toBe('Sita Sharma');
      expect(input('phone').value).toBe('9812345678');
      expect(input('showPhone').checked).toBe(true);
      expect((root.querySelector('#profile-bio') as HTMLTextAreaElement).value).toBe(
        'I sell books',
      );
      expect(root.querySelector('#profile-bio-count')?.textContent).toContain(
        '12 of 500 characters',
      );
      expect(chosen('provinceId')).toBe('Bagmati');
      expect(chosen('districtId')).toBe('Kathmandu');
      expect(chosen('municipalityId')).toBe('Kathmandu Metropolitan City');
    });

    it('shows the e-mail address and a link to the public profile, which cannot be edited here', () => {
      openWith();

      expect(root.textContent).toContain('sita@example.com');
      expect(root.textContent).toContain('Member since 20 Oct 2026');
      expect(root.querySelector(`a[href="/users/${account.id}"]`)).not.toBeNull();
    });

    it('labels every field', () => {
      openWith();

      for (const name of [
        'displayName',
        'phone',
        'showPhone',
        'bio',
        'provinceId',
        'districtId',
        'municipalityId',
      ]) {
        expect(root.querySelector(`label[for="profile-${name}"]`), name).not.toBeNull();
      }
    });

    it('starts with nothing chosen for an account without phone, bio or place', () => {
      openWith({
        ...account,
        phone: null,
        showPhone: false,
        bio: null,
        provinceId: null,
        districtId: null,
        municipalityId: null,
      });

      expect(input('phone').value).toBe('');
      expect(chosen('provinceId')).toBe('Not set');
      expect(chosen('districtId')).toBe('Not set');
      expect(select('districtId').disabled).toBe(true);
      expect(select('municipalityId').disabled).toBe(true);
    });
  });

  describe('showing the phone number', () => {
    beforeEach(() => openWith({ ...account, phone: null, showPhone: false }));

    it('cannot be ticked without a phone number', () => {
      expect(input('showPhone').disabled).toBe(true);
      expect(input('showPhone').checked).toBe(false);
    });

    it('can be ticked once a number is typed, and is switched off again when the number is removed', () => {
      type('phone', '9812345678');
      expect(input('showPhone').disabled).toBe(false);

      input('showPhone').click();
      fixture.detectChanges();
      expect(input('showPhone').checked).toBe(true);

      type('phone', '');
      expect(input('showPhone').disabled).toBe(true);
      expect(input('showPhone').checked).toBe(false);
    });
  });

  describe('the place', () => {
    it('lists the districts of the province and the cities of the district that are saved', () => {
      openWith();

      expect(optionLabels('districtId')).toEqual(['Not set', 'Kathmandu', 'Lalitpur']);
      expect(optionLabels('municipalityId')).toEqual([
        'Not set',
        'Kathmandu Metropolitan City',
        'Kirtipur',
      ]);
    });

    it('loads the districts of a newly chosen province and empties the choices below it', () => {
      openWith();

      choose('provinceId', 'Koshi');
      controller.expectOne('/api/v1/locations/provinces/1/districts').flush(koshiDistricts);
      fixture.detectChanges();

      expect(optionLabels('districtId')).toEqual(['Not set', 'Morang']);
      expect(chosen('districtId')).toBe('Not set');
      expect(optionLabels('municipalityId')).toEqual(['Not set']);
      expect(chosen('municipalityId')).toBe('Not set');
      expect(select('municipalityId').disabled).toBe(true);
    });

    it('loads the cities of a newly chosen district', () => {
      openWith();

      choose('districtId', 'Lalitpur');
      controller.expectOne('/api/v1/locations/districts/26/municipalities').flush([]);
      fixture.detectChanges();

      expect(optionLabels('municipalityId')).toEqual(['Not set']);
      expect(chosen('municipalityId')).toBe('Not set');
    });

    it('clears the whole place when the province is set back to "Not set"', () => {
      openWith();

      choose('provinceId', 'Not set');
      fixture.detectChanges();

      expect(optionLabels('districtId')).toEqual(['Not set']);
      expect(select('districtId').disabled).toBe(true);
      expect(select('municipalityId').disabled).toBe(true);
    });

    it('says so when a list cannot be loaded, and the rest of the form still works', () => {
      fixture.detectChanges();
      controller
        .expectOne(ME_URL)
        .flush({ ...account, provinceId: null, districtId: null, municipalityId: null });
      controller
        .expectOne(PROVINCES_URL)
        .flush(
          { title: 'Internal Server Error', status: 500 },
          { status: 500, statusText: 'Internal Server Error' },
        );
      fixture.detectChanges();

      expect(root.querySelector('fieldset [role="alert"]')?.textContent).toContain(
        'list of provinces could not be loaded',
      );
      expect(input('displayName')).not.toBeNull();
    });
  });

  describe('saving', () => {
    beforeEach(() => openWith());

    it('sends the whole profile trimmed, with the place as ids, and shows a message', () => {
      const session = TestBed.inject(AuthSession);
      const updateUser = vi.spyOn(session, 'updateUser');
      type('displayName', '  Sita S. Sharma ');
      type('phone', ' 9812345678 ');
      (root.querySelector('#profile-bio') as HTMLTextAreaElement).value = '  New bio  ';
      (root.querySelector('#profile-bio') as HTMLTextAreaElement).dispatchEvent(new Event('input'));

      save();

      const request = controller.expectOne(ME_URL);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        displayName: 'Sita S. Sharma',
        phone: '9812345678',
        showPhone: true,
        bio: 'New bio',
        provinceId: 3,
        districtId: 25,
        municipalityId: 1,
      });
      const result = saved({ displayName: 'Sita S. Sharma', bio: 'New bio' });
      request.flush(result);
      controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmatiDistricts);
      controller.expectOne('/api/v1/locations/districts/25/municipalities').flush(kathmanduCities);
      fixture.detectChanges();

      expect(updateUser).toHaveBeenCalledWith(result);
      expect(
        TestBed.inject(Toasts)
          .list()
          .map((toast) => toast.message),
      ).toEqual(['Your profile was saved.']);
      expect(input('displayName').value).toBe('Sita S. Sharma');
    });

    it('sends null for an empty phone and bio and for a place that was cleared, and never shows a missing number', () => {
      type('phone', '');
      type('displayName', 'Sita Sharma');
      (root.querySelector('#profile-bio') as HTMLTextAreaElement).value = '   ';
      (root.querySelector('#profile-bio') as HTMLTextAreaElement).dispatchEvent(new Event('input'));
      choose('provinceId', 'Not set');

      save();

      const request = controller.expectOne(ME_URL);
      expect(request.request.body).toEqual({
        displayName: 'Sita Sharma',
        phone: null,
        showPhone: false,
        bio: null,
        provinceId: null,
        districtId: null,
        municipalityId: null,
      });
      request.flush(
        saved({
          phone: null,
          showPhone: false,
          bio: null,
          provinceId: null,
          districtId: null,
          municipalityId: null,
        }),
      );
    });

    it('asks for a name and sends nothing while it is missing', () => {
      type('displayName', '');

      save();

      expect(errorText('displayName')).toBe('Enter your name.');
      expect(document.activeElement).toBe(input('displayName'));
      controller.expectNone(ME_URL);
    });

    it('does not accept a name of only spaces, which counts as too short', () => {
      type('displayName', '   ');

      save();

      expect(errorText('displayName')).toBe('Use at least 2 characters.');
      controller.expectNone(ME_URL);
    });

    it('rejects a phone number that is not a Nepali mobile number', () => {
      type('phone', '12345');

      save();

      expect(errorText('phone')).toBe('Enter a Nepali mobile number, like 9812345678.');
      controller.expectNone(ME_URL);
    });

    it('rejects a bio that is too long', () => {
      (root.querySelector('#profile-bio') as HTMLTextAreaElement).value = 'b'.repeat(501);
      (root.querySelector('#profile-bio') as HTMLTextAreaElement).dispatchEvent(new Event('input'));

      save();

      expect(errorText('bio')).toBe('Use at most 500 characters.');
      expect(root.querySelector('#profile-bio-count')?.textContent).toContain(
        '501 of 500 characters',
      );
      controller.expectNone(ME_URL);
    });

    it('puts a field error from the server next to the field', () => {
      save();

      controller.expectOne(ME_URL).flush(
        {
          title: 'Bad Request',
          status: 400,
          detail: 'One or more fields are invalid.',
          code: 'VALIDATION_FAILED',
          errors: [
            { field: 'districtId', message: 'This district is not in the chosen province.' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();

      expect(errorText('districtId')).toBe('This district is not in the chosen province.');
      expect(select('districtId').getAttribute('aria-invalid')).toBe('true');
      expect(alert()).toBeNull();
      expect(TestBed.inject(Toasts).list()).toEqual([]);
    });

    it('shows a conflict with another device in an alert and keeps what was typed', () => {
      type('displayName', 'Typed Name');
      save();

      controller.expectOne(ME_URL).flush(
        {
          title: 'Conflict',
          status: 409,
          detail: 'The resource was modified by someone else. Reload it and try again.',
          code: 'CONCURRENT_MODIFICATION',
        },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      expect(alert()?.textContent).toContain('modified by someone else');
      expect(input('displayName').value).toBe('Typed Name');
      expect(saveButton().disabled).toBe(false);
    });

    it('disables the button while saving and sends once', () => {
      save();

      expect(saveButton().disabled).toBe(true);
      expect(saveButton().textContent).toContain('Saving');
      save();

      expect(controller.match(ME_URL)).toHaveLength(1);
    });
  });
});
