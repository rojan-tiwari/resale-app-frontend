import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { summary } from '../../testing/listing-fixtures';
import { ListState, ListingList } from './listing-list';

@Component({
  imports: [ListingList],
  template: `<app-listing-list
    [state]="state()"
    emptyText="Nothing here."
    (retry)="retries = retries + 1"
  />`,
})
class Host {
  readonly state = signal<ListState>({ kind: 'loading' });
  retries = 0;
}

describe('ListingList', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('shows skeleton cards, announced as busy, while loading', () => {
    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(root.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(root.querySelector('app-listing-card')).toBeNull();
  });

  it('shows a card for each ad in a list', () => {
    fixture.componentInstance.state.set({
      kind: 'ready',
      items: [summary({ id: 'a', title: 'First' }), summary({ id: 'b', title: 'Second' })],
    });
    fixture.detectChanges();

    expect(root.querySelectorAll('ul > li app-listing-card')).toHaveLength(2);
    expect(root.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('says so when there is nothing to show', () => {
    fixture.componentInstance.state.set({ kind: 'ready', items: [] });
    fixture.detectChanges();

    expect(root.textContent).toContain('Nothing here.');
    expect(root.querySelector('ul')).toBeNull();
  });

  it('shows a failure as an alert with a way to try again', () => {
    fixture.componentInstance.state.set({ kind: 'error', message: 'The server is busy.' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('The server is busy.');
    root.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });
});
