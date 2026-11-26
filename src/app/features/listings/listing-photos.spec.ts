import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { photo } from '../../testing/listing-fixtures';
import { ListingPhotos, PhotoMove } from './listing-photos';
import { PhotoItem } from './photo-selection';

@Component({
  imports: [ListingPhotos],
  template: `
    <app-listing-photos
      [items]="items()"
      [problems]="problems()"
      [error]="error()"
      [disabled]="disabled()"
      (add)="added.push($event)"
      (move)="moves.push($event)"
      (remove)="removed.push($event)"
    />
  `,
})
class Host {
  readonly items = signal<readonly PhotoItem[]>([]);
  readonly problems = signal<readonly string[]>([]);
  readonly error = signal<string | null>(null);
  readonly disabled = signal(false);
  added: (readonly File[])[] = [];
  moves: PhotoMove[] = [];
  removed: number[] = [];
}

const saved = (id: string, position: number): PhotoItem => ({
  kind: 'saved',
  key: id,
  image: photo(id, position),
});
const pending = (key: string): PhotoItem => ({
  kind: 'pending',
  key,
  file: new File(['x'], `${key}.jpg`, { type: 'image/jpeg' }),
  previewUrl: `blob:${key}`,
});

describe('ListingPhotos', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  const tiles = () => Array.from(root.querySelectorAll<HTMLElement>('ol > li'));
  const button = (label: string) =>
    root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const fileInput = () =>
    root.querySelector<HTMLInputElement>('#listing-photo-input') as HTMLInputElement;

  function choose(files: File[]): void {
    const input = fileInput();
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('explains the rules and shows no list for an ad without photos', () => {
    expect(root.querySelector('ol')).toBeNull();
    expect(root.textContent).toContain('Up to 8 photos');
    expect(root.textContent).toContain('5 MB');
    expect(root.textContent).toContain('0 of 8 photos');
  });

  it('shows the photos in order, the first as the main photo, and marks the ones not uploaded yet', () => {
    host.items.set([saved('a', 0), saved('b', 1), pending('new-1')]);
    fixture.detectChanges();

    expect(tiles()).toHaveLength(3);
    expect(tiles()[0]?.textContent).toContain('Main photo');
    expect(tiles()[1]?.textContent).not.toContain('Main photo');
    expect(tiles()[2]?.textContent).toContain('Not uploaded yet');
    expect(tiles()[2]?.querySelector('img')?.getAttribute('src')).toBe('blob:new-1');
    expect(tiles()[2]?.querySelector('img')?.getAttribute('alt')).toBe(
      'Photo 3 of 3, not uploaded yet',
    );
    expect(root.textContent).toContain('3 of 8 photos');
  });

  it('does not offer to move the first photo earlier, the last one later, or to make the main photo the main photo', () => {
    host.items.set([saved('a', 0), saved('b', 1), saved('c', 2)]);
    fixture.detectChanges();

    expect(button('Move photo 1 earlier')?.disabled).toBe(true);
    expect(button('Move photo 3 later')?.disabled).toBe(true);
    expect(button('Move photo 2 earlier')?.disabled).toBe(false);
    expect(button('Make photo 1 the main photo')).toBeNull();
    expect(button('Make photo 2 the main photo')).not.toBeNull();
  });

  it('says what the person asked for, and leaves the changing to the form', () => {
    host.items.set([saved('a', 0), saved('b', 1), saved('c', 2)]);
    fixture.detectChanges();

    button('Move photo 2 later')?.click();
    button('Move photo 2 earlier')?.click();
    button('Make photo 3 the main photo')?.click();
    button('Remove photo 2')?.click();

    expect(host.moves).toEqual([
      { from: 1, to: 2 },
      { from: 1, to: 0 },
      { from: 2, to: 0 },
    ]);
    expect(host.removed).toEqual([1]);
    expect(tiles()).toHaveLength(3); // nothing changed on its own
  });

  it('announces what happened to screen readers', () => {
    host.items.set([saved('a', 0), saved('b', 1)]);
    fixture.detectChanges();

    button('Move photo 2 earlier')?.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'Photo moved to position 1 of 2.',
    );

    button('Remove photo 1')?.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Photo 1 removed.');
  });

  it('hands the chosen files over and forgets them, so the same file can be chosen again', () => {
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];

    choose(files);

    expect(host.added).toEqual([files]);
    expect(fileInput().value).toBe('');
  });

  it('does not report an empty choice', () => {
    choose([]);

    expect(host.added).toEqual([]);
  });

  it('only accepts the picture types the server takes, several at a time', () => {
    expect(fileInput().getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(fileInput().multiple).toBe(true);
    expect(root.querySelector('label')?.textContent).toContain('Add photos');
  });

  it('closes the door at 8 photos', () => {
    host.items.set(Array.from({ length: 8 }, (_, n) => saved(`p${n}`, n)));
    fixture.detectChanges();

    expect(fileInput().disabled).toBe(true);
    expect(root.textContent).toContain('8 of 8 photos');
  });

  it('shows what was left out and what went wrong as alerts', () => {
    host.problems.set([
      'huge.jpg is larger than 5 MB.',
      'doc.pdf is not a JPEG, PNG or WebP picture.',
    ]);
    host.error.set('The upload is too large.');
    fixture.detectChanges();

    const alerts = Array.from(root.querySelectorAll('[role="alert"]')).map((el) => el.textContent);
    expect(alerts.join(' ')).toContain('The upload is too large.');
    expect(alerts.join(' ')).toContain('huge.jpg is larger than 5 MB.');
    expect(root.querySelectorAll('[role="alert"] ul li')).toHaveLength(2);
  });

  it('cannot be changed while the ad is being saved', () => {
    host.items.set([saved('a', 0)]);
    host.disabled.set(true);
    fixture.detectChanges();

    expect(root.querySelector('fieldset')?.disabled).toBe(true);
    expect(fileInput().disabled).toBe(true);
  });
});
