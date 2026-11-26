import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '../auth/auth-session';
import { LocationPreference } from './location-preference';

const KEY = 'resalemarket.place';
const kathmandu = { provinceId: 3, districtId: 30, districtName: 'Kathmandu' };

describe('LocationPreference', () => {
  let controller: HttpTestingController;
  const user = signal<{ provinceId: number | null; districtId: number | null } | null>(null);

  function create(): LocationPreference {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { user } },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    const preference = TestBed.inject(LocationPreference);
    TestBed.tick();
    return preference;
  }

  beforeEach(() => {
    localStorage.clear();
    user.set(null);
  });

  afterEach(() => {
    controller.verify();
    vi.restoreAllMocks();
  });

  it('starts with no place: all of Nepal', () => {
    expect(create().place()).toBeNull();
  });

  it('remembers a chosen place in this browser', () => {
    const first = create();

    first.choose(kathmandu);

    expect(first.place()).toEqual(kathmandu);
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({ place: kathmandu });
    expect(create().place()).toEqual(kathmandu); // a new page load
  });

  it('remembers "all of Nepal" too', () => {
    const first = create();
    first.choose(kathmandu);

    first.clear();

    expect(first.place()).toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({ place: null });
  });

  it('ignores stored text that is not a place', () => {
    for (const junk of [
      'not json',
      '{}',
      '{"place":{"provinceId":"x"}}',
      '{"place":5}',
      'null',
      '[]',
    ]) {
      localStorage.setItem(KEY, junk);
      expect(create().place(), junk).toBeNull();
    }
  });

  it('works without storage: the choice lasts until the page is closed', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const preference = create();

    preference.choose(kathmandu);

    expect(preference.place()).toEqual(kathmandu);
  });

  describe('a signed-in person who has not chosen', () => {
    it('gets the district of their profile, once its name is known', () => {
      user.set({ provinceId: 3, districtId: 30 });
      const preference = create();

      controller.expectOne('/api/v1/locations/provinces/3/districts').flush([
        { id: 29, provinceId: 3, name: 'Lalitpur', slug: 'lalitpur' },
        { id: 30, provinceId: 3, name: 'Kathmandu', slug: 'kathmandu' },
      ]);

      expect(preference.place()).toEqual(kathmandu);
      expect(localStorage.getItem(KEY)).toBeNull(); // not a choice of theirs: a later change of the profile is followed
    });

    it('is left alone when the profile has no district', () => {
      user.set({ provinceId: 3, districtId: null });

      expect(create().place()).toBeNull();
    });

    it('keeps their own choice over the profile, including "all of Nepal"', () => {
      user.set({ provinceId: 3, districtId: 30 });
      localStorage.setItem(KEY, JSON.stringify({ place: null }));

      expect(create().place()).toBeNull(); // no request: the controller would fail the test if there was one
      localStorage.setItem(
        KEY,
        JSON.stringify({ place: { provinceId: 4, districtId: 40, districtName: 'Kaski' } }),
      );
      expect(create().place()?.districtName).toBe('Kaski');
    });

    it('is not preselected when the list of districts cannot be loaded', () => {
      user.set({ provinceId: 3, districtId: 30 });
      const preference = create();

      controller
        .expectOne('/api/v1/locations/provinces/3/districts')
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(preference.place()).toBeNull();
    });

    it('does not override a choice made while the district name was being loaded', () => {
      user.set({ provinceId: 3, districtId: 30 });
      const preference = create();

      preference.choose({ provinceId: 4, districtId: 40, districtName: 'Kaski' });
      controller
        .expectOne('/api/v1/locations/provinces/3/districts')
        .flush([{ id: 30, provinceId: 3, name: 'Kathmandu', slug: 'kathmandu' }]);

      expect(preference.place()?.districtName).toBe('Kaski');
    });
  });
});
