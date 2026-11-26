import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Category } from '../models/category';
import { CategoryStore } from './category-store';

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
  icon: null,
  description: null,
  children: [phones],
};
const other: Category = {
  id: 14,
  parentId: null,
  name: 'Other',
  slug: 'other',
  icon: null,
  description: null,
  children: [],
};

describe('CategoryStore', () => {
  let store: CategoryStore;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(CategoryStore);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('is idle until something asks for the tree', () => {
    expect(store.status()).toBe('idle');
    expect(store.tree()).toEqual([]);
  });

  it('loads the tree once however many components ask for it', () => {
    store.load();
    store.load();
    expect(store.status()).toBe('loading');
    controller.expectOne('/api/v1/categories').flush([mobiles, other]);
    store.load();

    expect(store.status()).toBe('ready');
    expect(store.tree()).toHaveLength(2);
    expect(store.bySlug().get('other')?.id).toBe(14);
  });

  it('finds a category or a subcategory by id', () => {
    store.load();
    controller.expectOne('/api/v1/categories').flush([mobiles, other]);

    expect(store.find(1)?.name).toBe('Mobiles & Tablets');
    expect(store.find(15)?.name).toBe('Mobile Phones');
    expect(store.find(99)).toBeUndefined();
  });

  it('says it failed and can try again', () => {
    store.load();
    controller
      .expectOne('/api/v1/categories')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(store.status()).toBe('error');
    store.load(); // an ordinary load does not hammer a failing server

    store.retry();
    controller.expectOne('/api/v1/categories').flush([other]);

    expect(store.status()).toBe('ready');
    expect(store.tree()).toEqual([other]);
  });
});
