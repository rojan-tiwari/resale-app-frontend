import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthSession } from '../../core/auth/auth-session';
import { LocationPreference } from '../../core/location/location-preference';
import { LocationPicker } from './location-picker';

const provinces = [
  { id: 3, name: 'Bagmati', slug: 'bagmati', nameNe: null },
  { id: 4, name: 'Gandaki', slug: 'gandaki', nameNe: null },
];
const bagmatiDistricts = [
  { id: 29, provinceId: 3, name: 'Lalitpur', slug: 'lalitpur' },
  { id: 30, provinceId: 3, name: 'Kathmandu', slug: 'kathmandu' },
];

describe('LocationPicker', () => {
  let fixture: ComponentFixture<LocationPicker>;
  let controller: HttpTestingController;
  let preference: LocationPreference;
  let root: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LocationPicker],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { user: signal(null) } },
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    preference = TestBed.inject(LocationPreference);
    fixture = TestBed.createComponent(LocationPicker);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const trigger = () => root.querySelector('button[aria-controls]') as HTMLButtonElement;
  const panel = () => root.querySelector('#location-picker-panel');
  const select = (id: string) => root.querySelector(`#${id}`) as HTMLSelectElement;
  const button = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('#location-picker-panel button')).find(
      (b) => b.textContent?.trim() === text,
    );

  function open(): void {
    trigger().click();
    fixture.detectChanges();
    controller.expectOne('/api/v1/locations/provinces').flush(provinces);
    fixture.detectChanges();
  }

  function choose(id: string, label: string): void {
    const element = select(id);
    element.selectedIndex = Array.from(element.options).findIndex(
      (option) => option.textContent?.trim() === label,
    );
    element.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('shows "All of Nepal" until a place is chosen, and starts closed', () => {
    expect(trigger().textContent).toContain('All of Nepal');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull();
  });

  it('opens a labelled panel with the provinces', () => {
    open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('label[for="place-province"]')?.textContent).toContain('Province');
    expect(Array.from(select('place-province').options).map((o) => o.textContent?.trim())).toEqual([
      'Choose a province',
      'Bagmati',
      'Gandaki',
    ]);
    expect(button('Show ads here')?.disabled).toBe(true);
  });

  it('loads the districts of the chosen province and takes the chosen district as the place', () => {
    open();

    choose('place-province', 'Bagmati');
    controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmatiDistricts);
    fixture.detectChanges();
    expect(button('Show ads here')?.disabled).toBe(true);
    choose('place-district', 'Kathmandu');
    expect(button('Show ads here')?.disabled).toBe(false);
    button('Show ads here')?.click();
    fixture.detectChanges();

    expect(preference.place()).toEqual({
      provinceId: 3,
      districtId: 30,
      districtName: 'Kathmandu',
    });
    expect(trigger().textContent).toContain('Kathmandu');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('goes back to all of Nepal', () => {
    preference.choose({ provinceId: 3, districtId: 30, districtName: 'Kathmandu' });
    fixture.detectChanges();
    expect(trigger().textContent).toContain('Kathmandu');
    trigger().click();
    fixture.detectChanges();
    controller.expectOne('/api/v1/locations/provinces').flush(provinces);
    controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmatiDistricts);
    fixture.detectChanges();

    button('All of Nepal')?.click();
    fixture.detectChanges();

    expect(preference.place()).toBeNull();
    expect(trigger().textContent).toContain('All of Nepal');
    expect(panel()).toBeNull();
  });

  it('shows the place already chosen, province and district selected, when it opens', () => {
    preference.choose({ provinceId: 3, districtId: 30, districtName: 'Kathmandu' });
    trigger().click();
    fixture.detectChanges();
    controller.expectOne('/api/v1/locations/provinces').flush(provinces);
    controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmatiDistricts);
    fixture.detectChanges();

    expect(select('place-province').selectedOptions[0]?.textContent?.trim()).toBe('Bagmati');
    expect(select('place-district').selectedOptions[0]?.textContent?.trim()).toBe('Kathmandu');
  });

  it('changing the province empties the district', () => {
    open();
    choose('place-province', 'Bagmati');
    controller.expectOne('/api/v1/locations/provinces/3/districts').flush(bagmatiDistricts);
    fixture.detectChanges();
    choose('place-district', 'Kathmandu');

    choose('place-province', 'Gandaki');
    controller
      .expectOne('/api/v1/locations/provinces/4/districts')
      .flush([{ id: 40, provinceId: 4, name: 'Kaski', slug: 'kaski' }]);
    fixture.detectChanges();

    expect(select('place-district').selectedOptions[0]?.textContent?.trim()).toBe(
      'Choose a district',
    );
    expect(button('Show ads here')?.disabled).toBe(true);
  });

  it('closes on Escape and returns focus to the button, and closes on a click elsewhere', () => {
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());

    open2();
    document.body.click();
    fixture.detectChanges();
    expect(panel()).toBeNull();

    function open2(): void {
      trigger().click();
      fixture.detectChanges();
    }
  });

  it('says when the provinces cannot be loaded', () => {
    trigger().click();
    fixture.detectChanges();
    controller
      .expectOne('/api/v1/locations/provinces')
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'The provinces could not be loaded',
    );
  });
});
