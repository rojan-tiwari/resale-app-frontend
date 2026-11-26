import { Component, input, output } from '@angular/core';
import { ListingSummary } from '../../core/models/listing';
import { ListingCard } from './listing-card';

/** What a list of cards is doing: loading, showing, or failed. The page that owns the request decides. */
export type ListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly items: readonly ListingSummary[] }
  | { readonly kind: 'error'; readonly message: string };

/**
 * A responsive grid of listing cards with the three states every data view needs: skeletons while loading, an empty message,
 * and an error with "Try again". The page passes the state in and handles the retry.
 */
@Component({
  selector: 'app-listing-list',
  imports: [ListingCard],
  host: { class: 'block' },
  template: `
    @let current = state();
    @switch (current.kind) {
      @case ('loading') {
        <div
          class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
          aria-busy="true"
          [attr.aria-label]="loadingLabel()"
        >
          @for (placeholder of placeholders; track placeholder) {
            <div class="card overflow-hidden" aria-hidden="true">
              <div class="skeleton aspect-4/3 rounded-none"></div>
              <div class="space-y-2 p-3">
                <div class="skeleton h-4 w-4/5"></div>
                <div class="skeleton h-5 w-1/2"></div>
                <div class="skeleton h-3 w-2/3"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('error') {
        <div class="card p-5" role="alert">
          <p class="text-sm text-slate-700">{{ current.message }}</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="retry.emit()">
            Try again
          </button>
        </div>
      }
      @case ('ready') {
        @if (current.items.length === 0) {
          <p
            class="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-700"
          >
            {{ emptyText() }}
          </p>
        } @else {
          <ul class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            @for (item of current.items; track item.id) {
              <li><app-listing-card [listing]="item" [showStatus]="showStatus()" /></li>
            }
          </ul>
        }
      }
    }
  `,
})
export class ListingList {
  readonly state = input.required<ListState>();
  /** What to say when there is nothing to show. */
  readonly emptyText = input('There are no ads here yet.');
  readonly loadingLabel = input('Loading ads');
  readonly showStatus = input(false);
  readonly retry = output<void>();

  protected readonly placeholders = [1, 2, 3, 4];
}
