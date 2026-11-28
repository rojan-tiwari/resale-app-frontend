import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Category } from '../../core/models/category';
import { CategoryNav } from './category-nav';

const category = (id: number, name: string, slug: string): Category => ({
  id,
  parentId: null,
  name,
  slug,
  icon: null,
  description: null,
  children: [],
});

describe('CategoryNav', () => {
  let fixture: ComponentFixture<CategoryNav>;
  let controller: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryNav],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CategoryNav);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('holds the place with placeholders while the categories load, so the header does not jump', () => {
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Categories');
    expect(root.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
    expect(root.querySelector('a')).toBeNull();

    controller.expectOne('/api/v1/categories').flush([]);
  });

  it('links every category to its page, and ends with "All categories"', () => {
    controller
      .expectOne('/api/v1/categories')
      .flush([
        category(1, 'Mobiles & Tablets', 'mobiles-tablets'),
        category(2, 'Vehicles', 'vehicles'),
      ]);
    fixture.detectChanges();

    const links = Array.from(root.querySelectorAll('a')).map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Mobiles & Tablets', '/categories/mobiles-tablets'],
      ['Vehicles', '/categories/vehicles'],
      ['All categories', '/categories'],
    ]);
    expect(root.querySelector('.skeleton')).toBeNull();
  });

  it('is a list inside the landmark, one link per item', () => {
    controller.expectOne('/api/v1/categories').flush([category(1, 'Vehicles', 'vehicles')]);
    fixture.detectChanges();

    expect(root.querySelectorAll('nav > ul > li')).toHaveLength(2);
  });

  it('says so and offers to try again when the categories cannot be loaded, without breaking the header', () => {
    controller
      .expectOne('/api/v1/categories')
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(root.textContent).toContain('Categories could not be loaded.');
    root.querySelector('button')?.click();
    fixture.detectChanges();
    controller.expectOne('/api/v1/categories').flush([category(1, 'Vehicles', 'vehicles')]);
    fixture.detectChanges();

    expect(root.querySelector('a')?.textContent).toContain('Vehicles');
  });
});
