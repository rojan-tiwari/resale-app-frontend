import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { ApiError, toApiError } from '../../core/models/api-error';
import { Page } from '../../core/models/page';
import { FavoriteItem } from '../../core/models/search';
import { Toasts } from '../../core/notifications/toasts';
import { FavoriteApi } from '../../core/services/favorite-api';
import { ListingCard } from '../../shared/components/listing-card';
import { Pager } from '../../shared/components/pager';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly page: Page<FavoriteItem> }
  | { readonly kind: 'error'; readonly error: ApiError };

const LOADING: State = { kind: 'loading' };
const PAGE_SIZE = 24;

/**
 * The ads the signed-in person saved, newest saved first. An ad that is no longer for sale is not dropped silently: a sold ad keeps its card
 * (marked as sold), and an ad that was taken down shows a plain notice, because nothing of it is shown any more. Either can be removed from the list.
 */
@Component({
  selector: 'app-favorites',
  imports: [RouterLink, ListingCard, Pager],
  template: `
    <section class="container-page py-8 sm:py-10">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your favourites</h1>

      <div class="mt-6" aria-live="polite">
        @switch (state().kind) {
          @case ('loading') {
            <div
              class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
              aria-busy="true"
              aria-label="Loading your favourites"
            >
              @for (placeholder of placeholders; track placeholder) {
                <div class="skeleton aspect-4/3" aria-hidden="true"></div>
              }
            </div>
          }
          @case ('error') {
            <div class="card p-6" role="alert">
              <p class="text-sm text-slate-700">{{ errorMessage() }}</p>
              <button type="button" class="btn btn-primary mt-4" (click)="retry()">
                Try again
              </button>
            </div>
          }
          @case ('ready') {
            @if (items().length === 0) {
              <div class="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <h2 class="text-lg font-semibold text-slate-900">You have not saved any ads yet</h2>
                <p class="mt-1 text-sm text-slate-600">Tap the heart on an ad to keep it here.</p>
                <a routerLink="/search" class="btn btn-primary mt-4">Browse ads</a>
              </div>
            } @else {
              <ul class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                @for (item of items(); track item.listingId) {
                  <li class="flex flex-col gap-2">
                    @if (item.listing; as card) {
                      <app-listing-card
                        [listing]="card"
                        [showStatus]="!item.available"
                        [headingLevel]="2"
                      />
                    } @else {
                      <div class="card flex-1 p-4 text-sm text-slate-700">
                        <p class="font-semibold text-slate-900">This ad is no longer available</p>
                        <p class="mt-1">The seller took it down.</p>
                      </div>
                    }
                    <button type="button" class="btn btn-secondary" (click)="remove(item)">
                      Remove<span class="sr-only">
                        {{ item.listing ? item.listing.title : 'this ad' }} from favourites</span
                      >
                    </button>
                  </li>
                }
              </ul>
              <app-pager
                class="mt-6"
                [page]="page().page"
                [totalPages]="page().totalPages"
                (pageChange)="goTo($event)"
              />
            }
          }
        }
      </div>
    </section>
  `,
})
export class Favorites {
  private readonly api = inject(FavoriteApi);
  private readonly store = inject(FavoritesStore);
  private readonly toasts = inject(Toasts);

  protected readonly placeholders = [1, 2, 3, 4];
  private readonly pageIndex = signal(0);
  private readonly attempt = signal(0);
  /** Items taken off the list on this screen but still in the page the server last sent. */
  private readonly removed = signal<ReadonlySet<string>>(new Set());

  protected readonly state = toSignal(
    toObservable(computed(() => ({ page: this.pageIndex(), attempt: this.attempt() }))).pipe(
      switchMap(({ page }) =>
        this.api.list(page, PAGE_SIZE).pipe(
          map((result): State => ({ kind: 'ready', page: result })),
          catchError((error: unknown) => of<State>({ kind: 'error', error: toApiError(error) })),
          startWith(LOADING),
        ),
      ),
    ),
    { initialValue: LOADING },
  );

  protected readonly page = computed(() => {
    const state = this.state();
    return state.kind === 'ready'
      ? state.page
      : {
          content: [],
          page: 0,
          size: PAGE_SIZE,
          totalElements: 0,
          totalPages: 0,
          first: true,
          last: true,
        };
  });
  protected readonly items = computed(() =>
    this.page().content.filter((item) => !this.removed().has(item.listingId)),
  );
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.error.message : '';
  });

  protected retry(): void {
    this.attempt.update((count) => count + 1);
  }

  protected goTo(page: number): void {
    this.removed.set(new Set());
    this.pageIndex.set(page);
  }

  /** Takes the ad off the list at once; the request follows, and the ad comes back with a message if the server refuses. */
  protected remove(item: FavoriteItem): void {
    this.removed.update((set) => new Set(set).add(item.listingId));
    this.store.forget(item.listingId);
    this.api.remove(item.listingId).subscribe({
      next: () => this.toasts.success('Removed from your favourites.'),
      error: (error: unknown) => {
        this.removed.update((set) => {
          const next = new Set(set);
          next.delete(item.listingId);
          return next;
        });
        this.toasts.error(toApiError(error).message);
      },
    });
  }
}
