import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config';
import { Category } from '../models/category';
import { CategoryApi } from './category-api';

const phones: Category = {
  id: 15,
  parentId: 1,
  name: 'Mobile Phones',
  slug: 'mobile-phones',
  icon: null,
  description: null,
  children: [],
};
const mobiles: Category = {
  id: 1,
  parentId: null,
  name: 'Mobiles & Tablets',
  slug: 'mobiles-tablets',
  icon: 'smartphone',
  description: null,
  children: [phones],
};

describe('CategoryApi', () => {
  let api: CategoryApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/test/api' },
      ],
    });
    api = TestBed.inject(CategoryApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('tree calls GET {base}/categories and returns the tree', () => {
    let result: Category[] | undefined;
    api.tree().subscribe((value) => (result = value));

    const request = controller.expectOne('/test/api/categories');
    expect(request.request.method).toBe('GET');
    request.flush([mobiles]);

    expect(result?.[0]?.children[0]?.name).toBe('Mobile Phones');
  });

  it('one calls GET {base}/categories/{id}', () => {
    let result: Category | undefined;
    api.one(15).subscribe((value) => (result = value));

    controller.expectOne('/test/api/categories/15').flush(phones);

    expect(result).toEqual(phones);
  });
});
