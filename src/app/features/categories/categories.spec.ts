import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Category } from '../../core/models/category';
import { Categories } from './categories';

const phones: Category = {
  id: 15,
  parentId: 1,
  name: 'Mobile Phones',
  slug: 'mobile-phones',
  icon: null,
  description: null,
  children: [],
};
const tablets: Category = {
  id: 16,
  parentId: 1,
  name: 'Tablets',
  slug: 'tablets',
  icon: null,
  description: null,
  children: [],
};
const tree: Category[] = [
  {
    id: 1,
    parentId: null,
    name: 'Mobiles & Tablets',
    slug: 'mobiles-tablets',
    icon: null,
    description: null,
    children: [phones, tablets],
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

describe('Categories', () => {
  let fixture: ComponentFixture<Categories>;
  let controller: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Categories],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Categories);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('shows placeholders while loading', () => {
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    controller.expectOne('/api/v1/categories').flush(tree);
  });

  it('lists every category with its subcategories, all as links to their pages', () => {
    controller.expectOne('/api/v1/categories').flush(tree);
    fixture.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('All categories');
    const mobiles = root.querySelector('#category-1')?.closest('section');
    expect(mobiles?.querySelector('h2 a')?.getAttribute('href')).toBe(
      '/categories/mobiles-tablets',
    );
    expect(
      Array.from(mobiles?.querySelectorAll('li a') ?? []).map((a) => a.getAttribute('href')),
    ).toEqual(['/categories/mobiles-tablets/mobile-phones', '/categories/mobiles-tablets/tablets']);
    expect(root.querySelector('#category-14')?.closest('section')?.querySelector('ul')).toBeNull();
  });

  it('has a breadcrumb back home', () => {
    controller.expectOne('/api/v1/categories').flush(tree);
    fixture.detectChanges();

    expect(root.querySelector('nav[aria-label="Breadcrumb"] a')?.getAttribute('href')).toBe('/');
    expect(root.querySelector('[aria-current="page"]')?.textContent).toContain('All categories');
  });

  it('explains a failure and tries again', () => {
    controller
      .expectOne('/api/v1/categories')
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');

    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    controller.expectOne('/api/v1/categories').flush(tree);
    fixture.detectChanges();

    expect(root.querySelectorAll('section section')).toHaveLength(2);
  });
});
