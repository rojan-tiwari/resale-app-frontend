import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FavoritesStub, provideFavoritesStub } from '../../testing/favorites-stub';
import { summary } from '../../testing/listing-fixtures';
import { ListingCard } from './listing-card';

describe('ListingCard', () => {
  let fixture: ComponentFixture<ListingCard>;
  let root: HTMLElement;
  let favorites: FavoritesStub;

  beforeEach(() => {
    favorites = new FavoritesStub();
  });

  async function show(
    overrides: Parameters<typeof summary>[0] = {},
    showStatus = false,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ListingCard],
      providers: [provideRouter([]), provideFavoritesStub(favorites)],
    }).compileComponents();
    fixture = TestBed.createComponent(ListingCard);
    root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('listing', summary(overrides));
    fixture.componentRef.setInput('showStatus', showStatus);
    fixture.detectChanges();
  }

  it('shows the title as the one link to the ad, the price in rupees, the place, condition and date', async () => {
    await show({ id: 'abc', title: 'Old guitar', price: 125000 });

    const link = root.querySelector('h3 a');
    expect(link?.textContent?.trim()).toBe('Old guitar');
    expect(link?.getAttribute('href')).toBe('/listings/abc');
    expect(root.querySelectorAll('a')).toHaveLength(1);
    expect(root.textContent).toContain('Rs. 1,25,000');
    expect(root.textContent).toContain('Baneshwor, Kathmandu, Bagmati');
    expect(root.textContent).toContain('Like new');
    expect(root.textContent).toContain('21 Oct 2026');
  });

  it('marks a negotiable price and leaves a fixed one plain', async () => {
    await show({ priceType: 'NEGOTIABLE' });
    expect(root.textContent).toContain('Negotiable');

    fixture.componentRef.setInput('listing', summary({ priceType: 'FIXED' }));
    fixture.detectChanges();
    expect(root.textContent).not.toContain('Negotiable');
  });

  it('shows the main photo without repeating the title as its text (the link already says it)', async () => {
    await show();

    const image = root.querySelector('img');
    expect(image?.getAttribute('src')).toContain('/images/img-1');
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('width')).toBe('640');
  });

  it('says "No photo" for an ad without one', async () => {
    await show({ primaryImage: null });

    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('No photo');
  });

  it('shows a featured badge, and a status badge only when asked to', async () => {
    await show({ featured: true, status: 'SOLD' });
    expect(root.textContent).toContain('Featured');
    expect(root.textContent).not.toContain('Sold');

    fixture.componentRef.setInput('showStatus', true);
    fixture.detectChanges();
    expect(root.textContent).toContain('Sold');
  });

  it('shows the start date for an ad that never went live', async () => {
    await show({ status: 'DRAFT', publishedAt: null, createdAt: '2026-10-20T08:15:00Z' });

    expect(root.textContent).toContain('20 Oct 2026');
  });

  describe('the heading of the title', () => {
    it('is a level-3 heading by default, for cards under a section heading', async () => {
      await show({ title: 'Old guitar' });

      expect(root.querySelector('h3 a')?.textContent?.trim()).toBe('Old guitar');
      expect(root.querySelector('h2')).toBeNull();
    });

    it('is a level-2 heading when the cards follow the page title directly, and is still the one link', async () => {
      await show({ id: 'abc', title: 'Old guitar' });
      fixture.componentRef.setInput('headingLevel', 2);
      fixture.detectChanges();

      expect(root.querySelector('h2 a')?.textContent?.trim()).toBe('Old guitar');
      expect(root.querySelector('h2 a')?.getAttribute('href')).toBe('/listings/abc');
      expect(root.querySelector('h3')).toBeNull();
      expect(root.querySelectorAll('a')).toHaveLength(1);
    });
  });

  describe('the heart', () => {
    const heart = () => root.querySelector('app-favorite-button button');

    it('is offered on a live ad, named after it, and saves it', async () => {
      await show({ id: 'abc', title: 'Old guitar' });

      expect(heart()?.getAttribute('aria-label')).toBe('Save Old guitar to favourites');
      (heart() as HTMLButtonElement).click();
      expect(favorites.toggled).toEqual(['abc']);
    });

    it("sits above the card's link, so a click on it saves instead of opening the ad", async () => {
      await show();

      expect(root.querySelector('app-favorite-button')?.className).toContain('z-10');
      expect(root.querySelectorAll('a')).toHaveLength(1);
    });

    it('is not offered on an ad that is not live (it cannot be saved)', async () => {
      await show({ status: 'SOLD' });
      expect(heart()).toBeNull();

      fixture.componentRef.setInput('listing', summary({ status: 'DRAFT' }));
      fixture.detectChanges();
      expect(heart()).toBeNull();
    });

    it("can be switched off, for the seller's own lists", async () => {
      await show();
      fixture.componentRef.setInput('favoritable', false);
      fixture.detectChanges();

      expect(heart()).toBeNull();
    });

    it('is offered on a reserved ad', async () => {
      await show({ status: 'RESERVED' });

      expect(heart()).not.toBeNull();
    });
  });
});
