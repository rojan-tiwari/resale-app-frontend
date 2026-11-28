import { Component, computed, input, signal } from '@angular/core';
import { ListingImage } from '../../core/models/listing';

/**
 * The photos of an ad: one large picture and a row of thumbnails to choose from, with "Previous" and "Next" buttons for one-handed
 * phone use. Every control is a button; the current thumbnail is marked with `aria-current`. Photos keep their own proportions
 * (nothing is cropped), so the seller's shot is shown as taken.
 */
@Component({
  selector: 'app-image-gallery',
  host: { class: 'block' },
  template: `
    @if (images().length === 0) {
      <div
        class="grid aspect-4/3 w-full place-items-center rounded-(--radius-card) bg-slate-100 text-slate-600"
      >
        <div class="text-center">
          <svg
            class="mx-auto size-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="m21 16-5-5-8 8" />
          </svg>
          <p class="mt-1 text-sm">This ad has no photos</p>
        </div>
      </div>
    } @else {
      @let photo = current();
      <div class="relative overflow-hidden rounded-(--radius-card) bg-slate-100">
        <div class="relative aspect-4/3 w-full">
          <img
            [src]="photo.url"
            [alt]="title() + ', photo ' + (index() + 1) + ' of ' + images().length"
            [attr.width]="photo.width"
            [attr.height]="photo.height"
            decoding="async"
            class="absolute inset-0 size-full object-contain"
          />
        </div>
        @if (images().length > 1) {
          <div class="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
            <button
              type="button"
              class="btn btn-secondary px-3 shadow"
              [disabled]="index() === 0"
              (click)="select(index() - 1)"
            >
              <span aria-hidden="true">←</span><span class="sr-only">Previous photo</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary px-3 shadow"
              [disabled]="index() === images().length - 1"
              (click)="select(index() + 1)"
            >
              <span aria-hidden="true">→</span><span class="sr-only">Next photo</span>
            </button>
          </div>
        }
      </div>
      @if (images().length > 1) {
        <ul class="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Choose a photo">
          @for (image of images(); track image.id; let i = $index) {
            <li class="shrink-0">
              <button
                type="button"
                class="block overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                [class.border-brand-600]="i === index()"
                [class.border-transparent]="i !== index()"
                [attr.aria-current]="i === index() ? 'true' : null"
                [attr.aria-label]="'Show photo ' + (i + 1) + ' of ' + images().length"
                (click)="select(i)"
              >
                <img
                  [src]="image.url"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="size-16 object-cover sm:size-20"
                />
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class ImageGallery {
  readonly images = input.required<readonly ListingImage[]>();
  /** The ad's title, for the picture's description. */
  readonly title = input.required<string>();

  private readonly chosen = signal(0);
  /** The shown photo, kept inside the list when the list shrinks. */
  protected readonly index = computed(() =>
    Math.min(this.chosen(), Math.max(this.images().length - 1, 0)),
  );
  protected readonly current = computed(() => this.images()[this.index()] as ListingImage);

  protected select(index: number): void {
    this.chosen.set(Math.min(Math.max(index, 0), this.images().length - 1));
  }
}
