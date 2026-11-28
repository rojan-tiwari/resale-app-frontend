import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFavoritesStub } from '../../testing/favorites-stub';
import { summary } from '../../testing/listing-fixtures';
import { ListState } from '../../shared/components/listing-list';
import { HomeSection } from './home-section';

@Component({
  imports: [HomeSection],
  template: `
    <app-home-section
      heading="Recently posted"
      [subtitle]="subtitle()"
      [state]="state()"
      emptyText="Nothing posted yet."
      [seeAll]="seeAll()"
      (retry)="retries = retries + 1"
    />
  `,
})
class Host {
  readonly subtitle = signal<string | null>(null);
  readonly state = signal<ListState>({ kind: 'loading' });
  readonly seeAll = signal<{ path: string; query?: Record<string, unknown> } | null>({
    path: '/search',
    query: { sort: 'newest' },
  });
  retries = 0;
}

describe('HomeSection', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([]), provideFavoritesStub()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('is a region named by its heading', () => {
    const section = root.querySelector('section');
    const heading = root.querySelector('h2');

    expect(heading?.textContent).toContain('Recently posted');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(heading?.id).toBe('home-recently-posted');
  });

  it('links "See all" to the search that shows more, and names the section for screen readers', () => {
    const link = root.querySelector('a[href^="/search"]');

    expect(link?.getAttribute('href')).toBe('/search?sort=newest');
    expect(link?.textContent?.replace(/\s+/g, ' ').trim()).toBe('See all Recently posted');
  });

  it('has no link when there is nowhere to go, and shows a subtitle when given one', () => {
    host.seeAll.set(null);
    host.subtitle.set('Ads in the district you chose.');
    fixture.detectChanges();

    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toContain('Ads in the district you chose.');
  });

  it('shows the cards of the list, its empty message and its failure, with a way to try again', () => {
    host.state.set({ kind: 'ready', items: [summary({ id: 'a', title: 'Old guitar' })] });
    fixture.detectChanges();
    expect(root.querySelector('app-listing-card h3')?.textContent).toContain('Old guitar');

    host.state.set({ kind: 'ready', items: [] });
    fixture.detectChanges();
    expect(root.textContent).toContain('Nothing posted yet.');

    host.state.set({ kind: 'error', message: 'The server is busy.' });
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('The server is busy.');
    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    expect(host.retries).toBe(1);
  });

  it('says what is loading', () => {
    expect(root.querySelector('[aria-busy="true"]')?.getAttribute('aria-label')).toBe(
      'Loading Recently posted',
    );
  });
});
