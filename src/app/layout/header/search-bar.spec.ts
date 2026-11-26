import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SearchBar } from './search-bar';

@Component({ template: '' })
class Page {}

describe('SearchBar', () => {
  let fixture: ComponentFixture<SearchBar>;
  let router: Router;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchBar],
      providers: [
        provideRouter([
          { path: 'search', component: Page },
          { path: 'listings/new', component: Page },
          { path: '', component: Page },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SearchBar);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  const input = () => root.querySelector('input') as HTMLInputElement;

  function type(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(): void {
    root.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  it('is a labelled search landmark with a button that says what it does', () => {
    expect(root.querySelector('form')?.getAttribute('role')).toBe('search');
    expect(root.querySelector(`label[for="${input().id}"]`)?.textContent).toContain('Search ads');
    expect(root.querySelector('button')?.textContent).toContain('Search');
    expect(input().type).toBe('search');
    expect(input().maxLength).toBe(100);
  });

  it('opens the search page with the words in the address', async () => {
    const navigate = vi.spyOn(router, 'navigate');
    type('  iphone 13 ');

    submit();

    expect(navigate).toHaveBeenCalledWith(['/search'], { queryParams: { q: 'iphone 13' } });
  });

  it('searches for everything when the box is empty, with no empty keyword in the address', () => {
    const navigate = vi.spyOn(router, 'navigate');

    submit();

    expect(navigate).toHaveBeenCalledWith(['/search'], { queryParams: {} });
  });

  it('shows the words of the search page the person is on, and nothing on other pages', async () => {
    const harness = await RouterTestingHarness.create();
    const bar = TestBed.createComponent(SearchBar);
    bar.detectChanges();
    const box = () => (bar.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;

    await harness.navigateByUrl('/search?q=laptop');
    bar.detectChanges();
    expect(box().value).toBe('laptop');

    await harness.navigateByUrl('/listings/new?q=ignored');
    bar.detectChanges();
    expect(box().value).toBe('');
  });

  it('gives each bar its own id, so the page can hold two (one per screen size)', () => {
    const second = TestBed.createComponent(SearchBar);
    second.detectChanges();

    expect((second.nativeElement as HTMLElement).querySelector('input')?.id).not.toBe(input().id);
  });
});
