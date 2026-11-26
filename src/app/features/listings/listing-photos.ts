import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MAX_LISTING_IMAGES } from '../../core/models/listing';
import { PhotoItem } from './photo-selection';

export interface PhotoMove {
  readonly from: number;
  readonly to: number;
}

/**
 * The photos of an ad as the seller edits them: previews, "Make main photo", move earlier or later, remove, and "Add photos".
 * It only shows the list and says what the person asked for; the form owns the list and decides what happens (nothing is sent
 * to the server until the ad is saved). Every action is a button, so it all works from the keyboard, and each change is
 * announced to screen readers.
 */
@Component({
  selector: 'app-listing-photos',
  host: { class: 'block' },
  template: `
    <fieldset class="space-y-3" [disabled]="disabled()">
      <legend class="field-label">Photos</legend>
      <p id="listing-photos-hint" class="text-sm text-slate-600">
        Up to {{ max }} photos: JPEG, PNG or WebP, at most 5 MB each. The first photo is the main
        photo shown on the ad's card. Photos from an iPhone saved as HEIC must be converted to JPEG
        first.
      </p>

      @if (error(); as message) {
        <p class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {{ message }}
        </p>
      }
      @if (problems().length > 0) {
        <div role="alert">
          <ul class="list-disc space-y-1 pl-5 text-sm text-red-700">
            @for (problem of problems(); track problem) {
              <li>{{ problem }}</li>
            }
          </ul>
        </div>
      }

      @if (items().length > 0) {
        <ol
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-label="Photos of this ad, main photo first"
        >
          @for (
            item of items();
            track item.key;
            let i = $index;
            let first = $first;
            let last = $last
          ) {
            <li class="card flex flex-col overflow-hidden" [attr.data-photo]="item.key">
              <div class="relative aspect-4/3 bg-slate-100">
                <img
                  [src]="item.kind === 'saved' ? item.image.url : item.previewUrl"
                  [alt]="
                    'Photo ' +
                    (i + 1) +
                    ' of ' +
                    items().length +
                    (item.kind === 'pending' ? ', not uploaded yet' : '')
                  "
                  class="absolute inset-0 size-full object-cover"
                />
                <div class="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1">
                  @if (first) {
                    <span class="badge badge-brand">Main photo</span>
                  }
                  @if (item.kind === 'pending') {
                    <span class="badge badge-neutral">Not uploaded yet</span>
                  }
                </div>
              </div>
              <div class="mt-auto space-y-1 p-2">
                <div class="flex gap-1">
                  <button
                    type="button"
                    class="btn btn-ghost px-3"
                    data-action="earlier"
                    [disabled]="first"
                    [attr.aria-label]="'Move photo ' + (i + 1) + ' earlier'"
                    (click)="moveBy(item.key, i, -1)"
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost px-3"
                    data-action="later"
                    [disabled]="last"
                    [attr.aria-label]="'Move photo ' + (i + 1) + ' later'"
                    (click)="moveBy(item.key, i, 1)"
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
                <div class="flex flex-wrap gap-1">
                  @if (!first) {
                    <button
                      type="button"
                      class="btn btn-ghost px-3"
                      data-action="main"
                      [attr.aria-label]="'Make photo ' + (i + 1) + ' the main photo'"
                      (click)="makeMain(item.key, i)"
                    >
                      Make main
                    </button>
                  }
                  <button
                    type="button"
                    class="btn btn-ghost px-3 text-red-700"
                    [attr.aria-label]="'Remove photo ' + (i + 1)"
                    (click)="removeAt(i)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          }
        </ol>
      }

      <div class="flex flex-wrap items-center gap-3">
        <label
          class="btn btn-secondary cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600 has-disabled:cursor-not-allowed has-disabled:opacity-50"
        >
          Add photos
          <input
            id="listing-photo-input"
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-describedby="listing-photos-hint"
            [disabled]="disabled() || items().length >= max"
            (change)="chosen($event)"
          />
        </label>
        <p class="text-sm text-slate-700">{{ items().length }} of {{ max }} photos</p>
      </div>

      <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>
    </fieldset>
  `,
})
export class ListingPhotos {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** The photos in gallery order. */
  readonly items = input.required<readonly PhotoItem[]>();
  /** Why something was left out or could not be uploaded, one sentence each. */
  readonly problems = input<readonly string[]>([]);
  /** A failure that belongs to the photos as a whole (an upload that failed). */
  readonly error = input<string | null>(null);
  /** True while the ad is being saved: nothing can be changed then. */
  readonly disabled = input(false);

  readonly add = output<readonly File[]>();
  readonly move = output<PhotoMove>();
  readonly remove = output<number>();

  protected readonly max = MAX_LISTING_IMAGES;
  protected readonly announcement = signal('');

  protected chosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // so the same file can be chosen again after it was removed
    if (files.length > 0) {
      this.add.emit(files);
    }
  }

  protected moveBy(key: string, from: number, delta: -1 | 1): void {
    const to = from + delta;
    this.move.emit({ from, to });
    this.announcement.set(`Photo moved to position ${to + 1} of ${this.items().length}.`);
    this.focusAfterRender(key, delta < 0 ? 'earlier' : 'later');
  }

  protected makeMain(key: string, from: number): void {
    this.move.emit({ from, to: 0 });
    this.announcement.set('Photo is now the main photo.');
    this.focusAfterRender(key, 'later');
  }

  protected removeAt(index: number): void {
    this.remove.emit(index);
    this.announcement.set(`Photo ${index + 1} removed.`);
    this.focusAfterRender(null, null);
  }

  /** The tile moves in the DOM when the list changes, which can drop keyboard focus: put it back on the same button. */
  private focusAfterRender(key: string | null, action: 'earlier' | 'later' | null): void {
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        let target: HTMLElement | null = null;
        if (key !== null && action !== null) {
          const tile = root.querySelector(`[data-photo="${CSS.escape(key)}"]`);
          target =
            tile?.querySelector<HTMLButtonElement>(
              `button[data-action="${action}"]:not(:disabled)`,
            ) ??
            tile?.querySelector<HTMLButtonElement>('button:not(:disabled)') ??
            null;
        }
        (target ?? root.querySelector<HTMLElement>('#listing-photo-input'))?.focus();
      },
      { injector: this.injector },
    );
  }
}
