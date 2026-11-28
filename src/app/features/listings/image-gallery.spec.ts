import { ComponentFixture, TestBed } from '@angular/core/testing';
import { photo } from '../../testing/listing-fixtures';
import { ImageGallery } from './image-gallery';

describe('ImageGallery', () => {
  let fixture: ComponentFixture<ImageGallery>;
  let root: HTMLElement;

  function show(count: number): void {
    fixture = TestBed.createComponent(ImageGallery);
    root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput(
      'images',
      Array.from({ length: count }, (_, n) => photo(`img-${n + 1}`, n)),
    );
    fixture.componentRef.setInput('title', 'Old guitar');
    fixture.detectChanges();
  }

  const big = () => root.querySelector<HTMLImageElement>('img[alt^="Old guitar"]');
  const thumb = (n: number) =>
    root.querySelector<HTMLButtonElement>(`button[aria-label="Show photo ${n} of 3"]`);
  const named = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(text),
    );

  it('says so when the ad has no photos', () => {
    show(0);

    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('This ad has no photos');
  });

  it('shows the main photo large, describing it with the title and its place in the gallery', () => {
    show(3);

    expect(big()?.getAttribute('src')).toContain('/images/img-1');
    expect(big()?.getAttribute('alt')).toBe('Old guitar, photo 1 of 3');
  });

  it('offers no browsing controls for a single photo', () => {
    show(1);

    expect(root.querySelectorAll('button')).toHaveLength(0);
    expect(big()?.getAttribute('alt')).toBe('Old guitar, photo 1 of 1');
  });

  it('switches to the photo whose thumbnail is chosen and marks it as current', () => {
    show(3);

    thumb(3)?.click();
    fixture.detectChanges();

    expect(big()?.getAttribute('src')).toContain('/images/img-3');
    expect(thumb(3)?.getAttribute('aria-current')).toBe('true');
    expect(thumb(1)?.getAttribute('aria-current')).toBeNull();
  });

  it('steps with Previous and Next and stops at the ends', () => {
    show(3);
    expect(named('Previous photo')?.disabled).toBe(true);

    named('Next photo')?.click();
    fixture.detectChanges();
    named('Next photo')?.click();
    fixture.detectChanges();

    expect(big()?.getAttribute('alt')).toBe('Old guitar, photo 3 of 3');
    expect(named('Next photo')?.disabled).toBe(true);
    expect(named('Previous photo')?.disabled).toBe(false);
  });

  it('stays on a photo that still exists when the list gets shorter', () => {
    show(3);
    thumb(3)?.click();
    fixture.detectChanges();

    fixture.componentRef.setInput('images', [photo('img-1', 0)]);
    fixture.detectChanges();

    expect(big()?.getAttribute('src')).toContain('/images/img-1');
  });
});
