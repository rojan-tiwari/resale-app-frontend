import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { Category } from '../../core/models/category';
import { Listing, ListingStatus } from '../../core/models/listing';
import { Toasts } from '../../core/notifications/toasts';
import { SELLER_ID, listing as listingFixture, photo } from '../../testing/listing-fixtures';
import { ListingForm } from './listing-form';

const ID = '0b8f0a54-6a52-4d3c-9f43-0a3d4a8d6c11';

const categories: Category[] = [
  {
    id: 1,
    parentId: null,
    name: 'Mobiles & Tablets',
    slug: 'mobiles-tablets',
    icon: null,
    description: null,
    children: [
      {
        id: 15,
        parentId: 1,
        name: 'Mobile Phones',
        slug: 'mobile-phones',
        icon: null,
        description: null,
        children: [],
      },
      {
        id: 16,
        parentId: 1,
        name: 'Tablets',
        slug: 'tablets',
        icon: null,
        description: null,
        children: [],
      },
    ],
  },
  {
    id: 14,
    parentId: null,
    name: 'Other',
    slug: 'other',
    icon: null,
    description: null,
    children: [],
  },
];
const provinces = [{ id: 3, name: 'Bagmati', slug: 'bagmati', nameNe: null }];
const districts = [{ id: 30, provinceId: 3, name: 'Kathmandu', slug: 'kathmandu' }];
const municipalities = [
  {
    id: 1,
    districtId: 30,
    name: 'Kathmandu',
    slug: 'kathmandu',
    type: 'METROPOLITAN',
    major: true,
  },
];

const me = { id: SELLER_ID, roles: ['ROLE_USER'] };

function jpeg(name: string): File {
  return new File([new Uint8Array(100)], name, { type: 'image/jpeg' });
}

/** The ad as the server answers after saving the details: a draft that can be published (or sent to review). */
function draft(overrides: Partial<Listing> = {}): Listing {
  const allowed: ListingStatus[] = ['ACTIVE', 'ARCHIVED'];
  return listingFixture({ status: 'DRAFT', images: [], allowedStatuses: allowed, ...overrides });
}

describe('ListingForm', () => {
  let fixture: ComponentFixture<ListingForm>;
  let controller: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;
  let toasts: Toasts;
  let root: HTMLElement;
  let previews = 0;

  beforeEach(async () => {
    previews = 0;
    // jsdom has no object URLs: stand in for them, and count how many are given back.
    URL.createObjectURL = vi.fn(() => `blob:preview-${++previews}`);
    URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ListingForm],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([problemDetailInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { user: signal(me) } },
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(Toasts);
    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => controller.verify());

  // --- helpers ---------------------------------------------------------------------------------------------------------

  function open(id?: string): void {
    fixture = TestBed.createComponent(ListingForm);
    root = fixture.nativeElement as HTMLElement;
    if (id !== undefined) {
      fixture.componentRef.setInput('id', id);
    }
    fixture.detectChanges();
  }

  /** Answers the requests the form makes when it opens. */
  function loaded(existing: Listing | null = null): void {
    controller.expectOne('/api/v1/categories').flush(categories);
    controller.expectOne('/api/v1/locations/provinces').flush(provinces);
    if (existing !== null) {
      controller.expectOne(`/api/v1/listings/${ID}`).flush(existing);
    }
    fixture.detectChanges();
  }

  /** Opens an existing ad for its seller and answers the places it needs. */
  function openExisting(existing: Listing): void {
    open(ID);
    loaded(existing);
    controller.expectOne('/api/v1/locations/provinces/3/districts').flush(districts);
    controller.expectOne('/api/v1/locations/districts/30/municipalities').flush(municipalities);
    fixture.detectChanges();
  }

  const field = <T extends HTMLElement>(name: string) =>
    root.querySelector<T>(`#listing-${name}`) as T;

  function type(name: string, value: string): void {
    const element = field<HTMLInputElement | HTMLTextAreaElement>(name);
    element.value = value;
    element.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function choose(name: string, optionText: string): void {
    const select = field<HTMLSelectElement>(name);
    const index = Array.from(select.options).findIndex(
      (option) => option.textContent?.trim() === optionText,
    );
    expect(index, `${optionText} in ${name}`).toBeGreaterThanOrEqual(0);
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  /** Fills every required field with valid values, answering the place lists as they are asked for. */
  function fillValid(): void {
    type('title', 'iPhone 13, 128 GB');
    choose('categoryId', 'Mobiles & Tablets');
    choose('subcategoryId', 'Mobile Phones');
    choose('condition', 'Like new');
    type('price', '85000');
    type('description', 'Bought last year, battery health 91%.');
    choose('provinceId', 'Bagmati');
    controller.expectOne('/api/v1/locations/provinces/3/districts').flush(districts);
    fixture.detectChanges();
    choose('districtId', 'Kathmandu');
    controller.expectOne('/api/v1/locations/districts/30/municipalities').flush(municipalities);
    fixture.detectChanges();
  }

  function addPhotos(...files: File[]): void {
    const input = field<HTMLInputElement>('photo-input');
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  const button = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.trim().startsWith(text),
    );
  const tileNames = () =>
    Array.from(root.querySelectorAll('ol > li img')).map((img) => img.getAttribute('alt'));
  const alertText = () =>
    Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent?.trim())
      .join(' | ');

  function click(text: string): void {
    button(text)?.click();
    fixture.detectChanges();
  }

  function expectCall(method: string, url: string): TestRequest {
    const call = controller.expectOne(url);
    expect(call.request.method).toBe(method);
    return call;
  }

  // --- opening ---------------------------------------------------------------------------------------------------------

  describe('opening', () => {
    it('shows a placeholder while the lists load, then an empty form to post an ad', () => {
      open();
      expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(root.querySelector('form')).toBeNull();

      loaded();

      expect(root.querySelector('h1')?.textContent).toContain('Post an ad');
      expect(root.querySelector('form')).not.toBeNull();
      expect(field<HTMLInputElement>('title').value).toBe('');
      expect(button('Publish ad')).toBeDefined();
      expect(button('Save draft')).toBeDefined();
      expect(root.querySelector('a[href="/listings/mine"]')?.textContent).toContain('Cancel');
    });

    it('labels every field and says which ones are required', () => {
      open();
      loaded();

      for (const name of [
        'title',
        'categoryId',
        'subcategoryId',
        'condition',
        'price',
        'description',
        'provinceId',
        'districtId',
      ]) {
        expect(root.querySelector(`label[for="listing-${name}"]`), name).not.toBeNull();
      }
      for (const name of [
        'title',
        'categoryId',
        'condition',
        'price',
        'description',
        'provinceId',
        'districtId',
      ]) {
        expect(field(name).getAttribute('aria-required'), name).toBe('true');
      }
    });

    it('offers the five conditions and the categories, and nothing in the lists that depend on a choice yet', () => {
      open();
      loaded();

      const options = (name: string) =>
        Array.from(field<HTMLSelectElement>(name).options).map((o) => o.textContent?.trim());
      expect(options('condition')).toEqual([
        'Choose the condition',
        'New',
        'Like new',
        'Good',
        'Fair',
        'For parts or repair',
      ]);
      expect(options('categoryId')).toEqual(['Choose a category', 'Mobiles & Tablets', 'Other']);
      expect(field<HTMLSelectElement>('subcategoryId').disabled).toBe(true);
      expect(field<HTMLSelectElement>('districtId').disabled).toBe(true);
      expect(field<HTMLSelectElement>('municipalityId').disabled).toBe(true);
    });

    it('explains a failure to load and tries again', () => {
      open();
      controller
        .expectOne('/api/v1/categories')
        .flush(
          { title: 'Server Error', status: 500, detail: 'The categories are unavailable.' },
          { status: 500, statusText: 'Server Error' },
        );
      // The two lists load together: when one fails the other request is abandoned, so there is nothing to answer.
      expect(controller.match('/api/v1/locations/provinces')).toHaveLength(1);
      fixture.detectChanges();

      expect(alertText()).toContain('The categories are unavailable.');

      click('Try again');
      loaded();
      expect(root.querySelector('form')).not.toBeNull();
    });
  });

  // --- the dependent pickers ---------------------------------------------------------------------------------------------

  describe('categories and places', () => {
    beforeEach(() => {
      open();
      loaded();
    });

    it('offers the subcategories of the chosen category and clears them when the category changes', () => {
      choose('categoryId', 'Mobiles & Tablets');
      const subcategory = field<HTMLSelectElement>('subcategoryId');
      expect(subcategory.disabled).toBe(false);
      expect(Array.from(subcategory.options).map((o) => o.textContent?.trim())).toEqual([
        'Choose a subcategory',
        'Mobile Phones',
        'Tablets',
      ]);

      choose('subcategoryId', 'Tablets');
      expect(subcategory.selectedIndex).toBe(2);

      choose('categoryId', 'Other');
      expect(subcategory.disabled).toBe(true);
      expect(subcategory.selectedIndex).toBe(0);
    });

    it('loads the districts of a province and then the municipalities of a district, emptying them when the parent changes', () => {
      choose('provinceId', 'Bagmati');
      controller.expectOne('/api/v1/locations/provinces/3/districts').flush(districts);
      fixture.detectChanges();
      expect(field<HTMLSelectElement>('districtId').disabled).toBe(false);

      choose('districtId', 'Kathmandu');
      controller.expectOne('/api/v1/locations/districts/30/municipalities').flush(municipalities);
      fixture.detectChanges();
      expect(field<HTMLSelectElement>('municipalityId').disabled).toBe(false);
      expect(
        Array.from(field<HTMLSelectElement>('municipalityId').options).map((o) =>
          o.textContent?.trim(),
        ),
      ).toEqual(['Not set', 'Kathmandu']);

      field<HTMLSelectElement>('provinceId').selectedIndex = 0;
      field<HTMLSelectElement>('provinceId').dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(field<HTMLSelectElement>('districtId').disabled).toBe(true);
      expect(field<HTMLSelectElement>('municipalityId').disabled).toBe(true);
    });

    it('keeps the form usable when a list of places cannot be loaded, and says so', () => {
      choose('provinceId', 'Bagmati');
      controller
        .expectOne('/api/v1/locations/provinces/3/districts')
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(alertText()).toContain('The list of districts could not be loaded');
      expect(root.querySelector('form')).not.toBeNull();
    });
  });

  // --- validation --------------------------------------------------------------------------------------------------------

  describe('validation', () => {
    beforeEach(() => {
      open();
      loaded();
    });

    it('says what is missing next to each field and sends nothing', () => {
      click('Save draft');

      const text = root.textContent ?? '';
      expect(text).toContain('Enter a title for your ad.');
      expect(text).toContain('Choose a category.');
      expect(text).toContain('Choose the condition of the item.');
      expect(text).toContain('Enter a price. Enter 0 if it is free.');
      expect(text).toContain('Describe what you are selling.');
      expect(text).toContain('Choose the province.');
      controller.expectNone('/api/v1/listings');
    });

    it('moves focus to the first field with a problem and marks it invalid', () => {
      click('Save draft');

      expect(document.activeElement).toBe(field('title'));
      expect(field('title').getAttribute('aria-invalid')).toBe('true');
    });

    it('checks lengths and the price the way the server does', () => {
      type('title', 'ab');
      type('description', 'too short');
      type('price', '-1');
      click('Save draft');
      expect(root.textContent).toContain('Use at least 3 characters.');
      expect(root.textContent).toContain('Use at least 10 characters.');
      expect(root.textContent).toContain('Enter 0 or more.');

      type('price', '10.123');
      expect(root.textContent).toContain('Use at most 2 decimal places, like 1250.50.');
      type('price', '10.5');
      expect(root.textContent).not.toContain('decimal places');
      type('price', '0');
      expect(field<HTMLInputElement>('price').getAttribute('aria-invalid')).toBeNull();
    });

    it('wants a subcategory whenever the category has some', () => {
      choose('categoryId', 'Mobiles & Tablets');
      click('Save draft');

      expect(root.textContent).toContain('Choose a subcategory.');
    });

    it('wants at least one photo to publish, but not to save a draft', () => {
      fillValid();

      click('Publish ad');

      expect(alertText()).toContain('Add at least one photo to publish your ad.');
      controller.expectNone('/api/v1/listings');
      expect(document.activeElement).toBe(field('photo-input'));
    });
  });

  // --- the photos on screen ----------------------------------------------------------------------------------------------

  describe('photos on screen', () => {
    beforeEach(() => {
      open();
      loaded();
    });

    it('previews the chosen photos without sending anything', () => {
      addPhotos(jpeg('front.jpg'), jpeg('back.jpg'));

      expect(tileNames()).toEqual([
        'Photo 1 of 2, not uploaded yet',
        'Photo 2 of 2, not uploaded yet',
      ]);
      expect(root.querySelector('ol > li img')?.getAttribute('src')).toBe('blob:preview-1');
      controller.expectNone('/api/v1/listings');
    });

    it('turns away files that are not pictures or are too large, and keeps the good ones', () => {
      addPhotos(jpeg('ok.jpg'), new File(['x'], 'notes.txt', { type: 'text/plain' }));

      expect(tileNames()).toHaveLength(1);
      expect(alertText()).toContain('notes.txt is not a JPEG, PNG or WebP picture.');
    });

    it('holds at most eight photos', () => {
      addPhotos(...Array.from({ length: 10 }, (_, n) => jpeg(`p${n}.jpg`)));

      expect(tileNames()).toHaveLength(8);
      expect(alertText()).toContain('Only 8 more photos fit, so 2 were left out.');
    });

    it('moves a photo, makes one the main photo, and gives the preview memory back when one is removed', () => {
      addPhotos(jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg'));
      const sources = () =>
        Array.from(root.querySelectorAll('ol > li img')).map((img) => img.getAttribute('src'));
      expect(sources()).toEqual(['blob:preview-1', 'blob:preview-2', 'blob:preview-3']);

      root
        .querySelector<HTMLButtonElement>('button[aria-label="Make photo 3 the main photo"]')
        ?.click();
      fixture.detectChanges();
      expect(sources()).toEqual(['blob:preview-3', 'blob:preview-1', 'blob:preview-2']);

      root.querySelector<HTMLButtonElement>('button[aria-label="Move photo 1 later"]')?.click();
      fixture.detectChanges();
      expect(sources()).toEqual(['blob:preview-1', 'blob:preview-3', 'blob:preview-2']);

      root.querySelector<HTMLButtonElement>('button[aria-label="Remove photo 2"]')?.click();
      fixture.detectChanges();
      expect(sources()).toEqual(['blob:preview-1', 'blob:preview-2']);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-3');
    });

    it('gives every preview back when the page is left', () => {
      addPhotos(jpeg('a.jpg'), jpeg('b.jpg'));

      fixture.destroy();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
    });
  });

  // --- saving a new ad ---------------------------------------------------------------------------------------------------

  describe('saving a new ad', () => {
    beforeEach(() => {
      open();
      loaded();
      fillValid();
    });

    it('saves a draft: creates the ad with the details as typed, uploads the photos in order, and opens the ad', () => {
      addPhotos(jpeg('front.jpg'), jpeg('back.jpg'));
      type('locality', '  Baneshwor  ');

      click('Save draft');

      const create = expectCall('POST', '/api/v1/listings');
      expect(create.request.body).toEqual({
        title: 'iPhone 13, 128 GB',
        description: 'Bought last year, battery health 91%.',
        price: 85000,
        priceType: 'FIXED',
        condition: 'LIKE_NEW',
        categoryId: 1,
        subcategoryId: 15,
        provinceId: 3,
        districtId: 30,
        municipalityId: null,
        locality: 'Baneshwor',
      });
      expect(button('Saving…')?.disabled).toBe(true);
      create.flush(draft());

      const upload = expectCall('POST', `/api/v1/listings/${ID}/images`);
      const sent = (upload.request.body as FormData).getAll('images') as File[];
      expect(sent.map((file) => file.name)).toEqual(['front.jpg', 'back.jpg']);
      upload.flush([photo('s1', 0), photo('s2', 1)]);

      controller.expectNone(`/api/v1/listings/${ID}/images/order`); // already in the chosen order
      expect(navigate).toHaveBeenCalledWith(['/listings', ID]);
      expect(toasts.list().map((t) => t.message)).toEqual(['Your draft was saved.']);
    });

    it('publishes: saves, uploads, then moves the ad to live', () => {
      addPhotos(jpeg('front.jpg'));

      click('Publish ad');
      expectCall('POST', '/api/v1/listings').flush(draft());
      expectCall('POST', `/api/v1/listings/${ID}/images`).flush([photo('s1', 0)]);
      const publish = expectCall('PATCH', `/api/v1/listings/${ID}/status`);
      expect(publish.request.body).toEqual({ status: 'ACTIVE', reason: null });
      publish.flush(listingFixture({ status: 'ACTIVE' }));

      expect(navigate).toHaveBeenCalledWith(['/listings', ID]);
      expect(toasts.list().map((t) => t.message)).toEqual(['Your ad is live.']);
    });

    it('sends the ad to review instead when the marketplace requires approval, and says so', () => {
      addPhotos(jpeg('front.jpg'));

      click('Publish ad');
      expectCall('POST', '/api/v1/listings').flush(
        draft({ allowedStatuses: ['PENDING_REVIEW', 'ARCHIVED'] }),
      );
      expectCall('POST', `/api/v1/listings/${ID}/images`).flush([photo('s1', 0)]);
      const publish = expectCall('PATCH', `/api/v1/listings/${ID}/status`);
      expect(publish.request.body).toEqual({ status: 'PENDING_REVIEW', reason: null });
      publish.flush(listingFixture({ status: 'PENDING_REVIEW' }));

      expect(toasts.list().map((t) => t.message)).toEqual([
        'Your ad was sent for review. It goes live once it is approved.',
      ]);
    });

    it('saves a draft without photos with no upload at all', () => {
      click('Save draft');
      expectCall('POST', '/api/v1/listings').flush(draft());

      controller.expectNone(`/api/v1/listings/${ID}/images`);
      expect(navigate).toHaveBeenCalledWith(['/listings', ID]);
    });

    it("puts the server's complaints next to the fields they are about and creates nothing", () => {
      click('Save draft');
      expectCall('POST', '/api/v1/listings').flush(
        {
          title: 'Bad Request',
          status: 400,
          detail: 'One or more fields are invalid.',
          code: 'VALIDATION_FAILED',
          errors: [
            { field: 'subcategoryId', message: 'This subcategory is not in the chosen category.' },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();

      expect(root.querySelector('#listing-subcategoryId-error')?.textContent).toContain(
        'This subcategory is not in the chosen category.',
      );
      expect(document.activeElement).toBe(field('subcategoryId'));
      expect(navigate).not.toHaveBeenCalled();
      expect(button('Save draft')?.disabled).toBe(false);
    });

    it('shows a failure that belongs to no field as a general alert', () => {
      click('Save draft');
      expectCall('POST', '/api/v1/listings').flush(
        {
          title: 'Too Many Requests',
          status: 429,
          detail: 'Too many listings created recently. Try again in 12 minutes.',
        },
        { status: 429, statusText: 'Too Many Requests' },
      );
      fixture.detectChanges();

      expect(alertText()).toContain('Try again in 12 minutes.');
    });

    it('sends nothing twice while a save is under way', () => {
      click('Save draft');
      click('Save draft');
      click('Publish ad');

      controller.expectOne('/api/v1/listings');
    });

    describe('when something fails after the ad was created', () => {
      beforeEach(() => {
        addPhotos(jpeg('front.jpg'), jpeg('back.jpg'));
        click('Save draft');
        expectCall('POST', '/api/v1/listings').flush(draft());
      });

      it('keeps the ad as a draft, keeps the chosen photos on screen, and says which part failed', () => {
        expectCall('POST', `/api/v1/listings/${ID}/images`).flush(
          {
            title: 'Bad Request',
            status: 400,
            code: 'VALIDATION_FAILED',
            detail: 'One or more fields are invalid.',
            errors: [{ field: 'images', message: 'back.jpg is not a JPEG, PNG or WebP image.' }],
          },
          { status: 400, statusText: 'Bad Request' },
        );
        fixture.detectChanges();

        expect(alertText()).toContain('back.jpg is not a JPEG, PNG or WebP image.');
        expect(alertText()).toContain(
          'Your ad was saved as a draft, but not everything went through.',
        );
        expect(tileNames()).toHaveLength(2);
        expect(navigate).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(field('photo-input'));
      });

      it('carries on from there on the next try: it updates the ad instead of creating another one', () => {
        expectCall('POST', `/api/v1/listings/${ID}/images`).flush(
          {
            title: 'Content Too Large',
            status: 413,
            code: 'PAYLOAD_TOO_LARGE',
            detail: 'The upload is too large. Choose smaller photos, or fewer at a time.',
          },
          { status: 413, statusText: 'Content Too Large' },
        );
        fixture.detectChanges();
        expect(alertText()).toContain('The upload is too large.');

        click('Save draft');
        expectCall('PUT', `/api/v1/listings/${ID}`).flush(draft());
        controller.expectNone('/api/v1/listings');
        expectCall('POST', `/api/v1/listings/${ID}/images`).flush([photo('s1', 0), photo('s2', 1)]);

        expect(navigate).toHaveBeenCalledWith(['/listings', ID]);
        expect(alertText()).toBe('');
      });

      it('says a refused publish after the photos went up, without losing them', () => {
        expectCall('POST', `/api/v1/listings/${ID}/images`).flush([photo('s1', 0), photo('s2', 1)]);
        fixture.detectChanges();
        expect(navigate).toHaveBeenCalled(); // a draft needs no publish step

        navigate.mockClear();
        click('Publish ad');
        expectCall('PUT', `/api/v1/listings/${ID}`).flush(draft());
        const publish = expectCall('PATCH', `/api/v1/listings/${ID}/status`);
        publish.flush(
          {
            title: 'Unprocessable Content',
            status: 422,
            code: 'BUSINESS_RULE_VIOLATION',
            detail: 'Add at least one photo before publishing the listing.',
          },
          { status: 422, statusText: 'Unprocessable Content' },
        );
        fixture.detectChanges();

        controller.expectNone(`/api/v1/listings/${ID}/images`); // the photos are already up: not sent again
        expect(alertText()).toContain('Add at least one photo before publishing the listing.');
        expect(navigate).not.toHaveBeenCalled();
      });
    });
  });

  // --- editing -----------------------------------------------------------------------------------------------------------

  describe('editing an ad', () => {
    it('fills the form from the ad, with its photos, and its places', () => {
      openExisting(draft({ images: [photo('s1', 0), photo('s2', 1)] }));

      expect(root.querySelector('h1')?.textContent).toContain('Edit your ad');
      expect(field<HTMLInputElement>('title').value).toBe('iPhone 13, 128 GB');
      expect(field<HTMLTextAreaElement>('description').value).toContain('Battery health 91%.');
      expect(field<HTMLInputElement>('price').value).toBe('85000');
      expect(field<HTMLSelectElement>('categoryId').selectedOptions[0]?.textContent?.trim()).toBe(
        'Mobiles & Tablets',
      );
      expect(
        field<HTMLSelectElement>('subcategoryId').selectedOptions[0]?.textContent?.trim(),
      ).toBe('Mobile Phones');
      expect(field<HTMLSelectElement>('condition').selectedOptions[0]?.textContent?.trim()).toBe(
        'Like new',
      );
      expect(field<HTMLSelectElement>('districtId').selectedOptions[0]?.textContent?.trim()).toBe(
        'Kathmandu',
      );
      expect(field<HTMLInputElement>('locality').value).toBe('Baneshwor');
      expect(tileNames()).toEqual(['Photo 1 of 2', 'Photo 2 of 2']);
      expect(root.querySelector('a[href="/listings/' + ID + '"]')?.textContent).toContain('Cancel');
    });

    it('offers "Submit for review" instead of "Publish" when that is the way live', () => {
      openExisting(draft({ allowedStatuses: ['PENDING_REVIEW', 'ARCHIVED'] }));

      expect(button('Submit for review')).toBeDefined();
      expect(button('Publish ad')).toBeUndefined();
    });

    it('applies a removal, an upload and a new order in one save, in that order', () => {
      openExisting(draft({ images: [photo('s1', 0), photo('s2', 1), photo('s3', 2)] }));
      root.querySelector<HTMLButtonElement>('button[aria-label="Remove photo 2"]')?.click(); // s2 goes
      fixture.detectChanges();
      addPhotos(jpeg('new.jpg')); // [s1, s3, new]
      root
        .querySelector<HTMLButtonElement>('button[aria-label="Make photo 3 the main photo"]')
        ?.click(); // [new, s1, s3]
      fixture.detectChanges();

      click('Save draft');
      expectCall('PUT', `/api/v1/listings/${ID}`).flush(draft());
      expectCall('DELETE', `/api/v1/listings/${ID}/images/s2`).flush([
        photo('s1', 0),
        photo('s3', 1),
      ]);
      const upload = expectCall('POST', `/api/v1/listings/${ID}/images`);
      expect(
        ((upload.request.body as FormData).getAll('images') as File[]).map((f) => f.name),
      ).toEqual(['new.jpg']);
      upload.flush([photo('s1', 0), photo('s3', 1), photo('n1', 2)]);
      const reorder = expectCall('PUT', `/api/v1/listings/${ID}/images/order`);
      expect(reorder.request.body).toEqual({ imageIds: ['n1', 's1', 's3'] });
      reorder.flush([photo('n1', 0), photo('s1', 1), photo('s3', 2)]);

      expect(navigate).toHaveBeenCalledWith(['/listings', ID]);
    });

    it('does not touch the photos at all when nothing about them changed', () => {
      openExisting(draft({ images: [photo('s1', 0), photo('s2', 1)] }));
      type('title', 'A better title');

      click('Save draft');
      const put = expectCall('PUT', `/api/v1/listings/${ID}`);
      expect((put.request.body as { title: string }).title).toBe('A better title');
      put.flush(draft());

      controller.expectNone(`/api/v1/listings/${ID}/images`);
      controller.expectNone(`/api/v1/listings/${ID}/images/order`);
      expect(navigate).toHaveBeenCalled();
    });

    it('only reorders when the order is the only thing that changed', () => {
      openExisting(draft({ images: [photo('s1', 0), photo('s2', 1)] }));
      root
        .querySelector<HTMLButtonElement>('button[aria-label="Make photo 2 the main photo"]')
        ?.click();
      fixture.detectChanges();

      click('Save draft');
      expectCall('PUT', `/api/v1/listings/${ID}`).flush(draft());
      const reorder = expectCall('PUT', `/api/v1/listings/${ID}/images/order`);
      expect(reorder.request.body).toEqual({ imageIds: ['s2', 's1'] });
      reorder.flush([photo('s2', 0), photo('s1', 1)]);
    });

    describe('a live ad', () => {
      it('has one "Save changes" button and no publish step', () => {
        openExisting(
          listingFixture({
            status: 'ACTIVE',
            images: [photo('s1', 0)],
            allowedStatuses: ['RESERVED', 'SOLD', 'ARCHIVED'],
          }),
        );

        expect(button('Save changes')).toBeDefined();
        expect(button('Publish ad')).toBeUndefined();
        expect(button('Save draft')).toBeUndefined();

        click('Save changes');
        expectCall('PUT', `/api/v1/listings/${ID}`).flush(listingFixture({ status: 'ACTIVE' }));
        expect(toasts.list().map((t) => t.message)).toEqual(['Your changes were saved.']);
      });

      it('uploads the new photos before removing the last old one, so the ad is never left without a photo', () => {
        openExisting(
          listingFixture({
            status: 'ACTIVE',
            images: [photo('old', 0)],
            allowedStatuses: ['RESERVED', 'SOLD', 'ARCHIVED'],
          }),
        );
        root.querySelector<HTMLButtonElement>('button[aria-label="Remove photo 1"]')?.click();
        fixture.detectChanges();
        addPhotos(jpeg('replacement.jpg'));

        click('Save changes');
        expectCall('PUT', `/api/v1/listings/${ID}`).flush(listingFixture({ status: 'ACTIVE' }));
        expectCall('POST', `/api/v1/listings/${ID}/images`).flush([
          photo('old', 0),
          photo('fresh', 1),
        ]);
        expectCall('DELETE', `/api/v1/listings/${ID}/images/old`).flush([photo('fresh', 0)]);

        expect(navigate).toHaveBeenCalled();
      });

      it('removes first when other photos stay, to make room under the limit of eight', () => {
        const eight = Array.from({ length: 8 }, (_, n) => photo(`s${n}`, n));
        openExisting(
          listingFixture({
            status: 'ACTIVE',
            images: eight,
            allowedStatuses: ['RESERVED', 'SOLD', 'ARCHIVED'],
          }),
        );
        root.querySelector<HTMLButtonElement>('button[aria-label="Remove photo 8"]')?.click();
        fixture.detectChanges();
        addPhotos(jpeg('replacement.jpg'));

        click('Save changes');
        expectCall('PUT', `/api/v1/listings/${ID}`).flush(listingFixture({ status: 'ACTIVE' }));
        expectCall('DELETE', `/api/v1/listings/${ID}/images/s7`).flush(eight.slice(0, 7));
        expectCall('POST', `/api/v1/listings/${ID}/images`).flush([
          ...eight.slice(0, 7),
          photo('fresh', 7),
        ]);
      });
    });

    describe('when it cannot be edited', () => {
      it('refuses an ad that belongs to someone else', () => {
        open(ID);
        loaded(
          listingFixture({
            seller: { ...listingFixture().seller, id: '99999999-0000-0000-0000-000000000000' },
          }),
        );

        expect(root.querySelector('form')).toBeNull();
        expect(alertText()).toContain('Only the person who posted an ad can edit it.');
      });

      it('explains how to unfreeze a sold or archived ad that can go back to draft', () => {
        open(ID);
        loaded(listingFixture({ status: 'ARCHIVED', allowedStatuses: ['DRAFT'] }));

        expect(root.querySelector('form')).toBeNull();
        expect(alertText()).toContain('Move it back to a draft first');
        expect(root.querySelector(`a[href="/listings/${ID}"]`)?.textContent).toContain(
          'Go to the ad',
        );
      });

      it('says plainly when nothing can be done', () => {
        open(ID);
        loaded(listingFixture({ status: 'SOLD', allowedStatuses: ['ARCHIVED'] }));

        expect(alertText()).toContain('An ad in this state cannot be changed.');
      });

      it('shows a missing or private ad as an error that can be retried', () => {
        open(ID);
        controller.expectOne('/api/v1/categories').flush(categories);
        controller.expectOne('/api/v1/locations/provinces').flush(provinces);
        controller
          .expectOne(`/api/v1/listings/${ID}`)
          .flush(
            { title: 'Not Found', status: 404, detail: "Listing with id 'x' was not found." },
            { status: 404, statusText: 'Not Found' },
          );
        fixture.detectChanges();

        expect(alertText()).toContain("Listing with id 'x' was not found.");
      });
    });
  });
});
