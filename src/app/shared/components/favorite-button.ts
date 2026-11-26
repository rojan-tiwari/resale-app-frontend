import { Component, computed, inject, input } from '@angular/core';
import { FavoritesStore } from '../../core/favorites/favorites-store';

/**
 * The heart on a card: saves the ad to the person's favourites or removes it. A toggle button: its name says what it does ("Save
 * iPhone to favourites") and `aria-pressed` says whether it is on, so a screen reader hears "Save iPhone to favourites, toggle
 * button, pressed". It is not disabled while the request is on its way, because a disabled button loses keyboard focus; the store ignores
 * clicks that arrive meanwhile. A visitor who clicks it is sent to sign in and brought back.
 */
@Component({
  selector: 'app-favorite-button',
  host: { class: 'inline-block' },
  template: `
    <button
      type="button"
      class="grid size-10 place-items-center rounded-full bg-white/95 text-slate-700 shadow ring-1 ring-slate-200 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      [class.text-brand-600]="saved()"
      [attr.aria-pressed]="saved()"
      [attr.aria-label]="label()"
      (click)="store.toggle(listingId())"
    >
      <svg
        class="size-5"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
        [attr.fill]="saved() ? 'currentColor' : 'none'"
        aria-hidden="true"
      >
        <path
          d="M12 20.5s-7.4-4.5-9.3-9.1C1.5 8.5 3.1 5.5 6.2 5.5c1.9 0 3.3 1 4.1 2.4.4.6 1.1.6 1.4 0 .8-1.4 2.2-2.4 4.1-2.4 3.1 0 4.7 3 3.5 5.9-1.9 4.6-9.3 9.1-9.3 9.1Z"
        />
      </svg>
    </button>
  `,
})
export class FavoriteButton {
  protected readonly store = inject(FavoritesStore);

  readonly listingId = input.required<string>();
  /** The ad's title, so the button says which ad it saves. */
  readonly title = input.required<string>();

  protected readonly saved = computed(() => this.store.isSaved(this.listingId()));
  protected readonly label = computed(() => `Save ${this.title()} to favourites`);
}
