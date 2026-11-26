import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FavoritesStub, provideFavoritesStub } from '../../testing/favorites-stub';
import { FavoriteButton } from './favorite-button';

@Component({
  imports: [FavoriteButton],
  template: `<app-favorite-button [listingId]="id()" title="iPhone 13" />`,
})
class Host {
  readonly id = signal('listing-1');
}

describe('FavoriteButton', () => {
  let fixture: ComponentFixture<Host>;
  let stub: FavoritesStub;

  const button = () =>
    (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

  beforeEach(() => {
    stub = new FavoritesStub();
    TestBed.configureTestingModule({ imports: [Host], providers: [provideFavoritesStub(stub)] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('names the ad it saves and is a toggle button that is off', () => {
    expect(button().getAttribute('aria-label')).toBe('Save iPhone 13 to favourites');
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button().querySelector('svg')?.getAttribute('fill')).toBe('none');
  });

  it('shows it is on, with a filled heart, when the ad is saved', () => {
    stub.saved.set(new Set(['listing-1']));
    fixture.detectChanges();

    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
  });

  it('hands the click to the store', () => {
    button().click();

    expect(stub.toggled).toEqual(['listing-1']);
  });

  it('follows the ad when the same button is used for another one', () => {
    stub.saved.set(new Set(['listing-2']));
    fixture.componentInstance.id.set('listing-2');
    fixture.detectChanges();

    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('is never disabled, so keyboard focus is not lost while a request is on its way', () => {
    expect(button().disabled).toBe(false);
    expect(button().getAttribute('type')).toBe('button');
  });
});
