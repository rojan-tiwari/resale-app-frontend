import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ApiError, toApiError } from '../../core/models/api-error';
import { ListingStatus, ListingSummary } from '../../core/models/listing';
import { Page } from '../../core/models/page';
import { ListingApi } from '../../core/services/listing-api';
import { Pager } from '../../shared/components/pager';
import {
  conditionLabel,
  isEditable,
  placeLabel,
  statusBadgeClass,
  statusLabel,
} from '../../shared/listing/listing-labels';
import { NepalDatePipe } from '../../shared/pipes/nepal-date-pipe';
import { NprPipe } from '../../shared/pipes/npr-pipe';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly page: Page<ListingSummary> }
  | { readonly kind: 'error'; readonly error: ApiError };

const LOADING: State = { kind: 'loading' };
const PAGE_SIZE = 10;

/** The filter chips: "All" is every ad except the archived ones, which the server leaves out unless asked for. */
const FILTERS: readonly { readonly status: ListingStatus | null; readonly label: string }[] = [
  { status: null, label: 'All' },
  { status: 'DRAFT', label: 'Drafts' },
  { status: 'ACTIVE', label: 'Live' },
  { status: 'RESERVED', label: 'Reserved' },
  { status: 'PENDING_REVIEW', label: 'Under review' },
  { status: 'SOLD', label: 'Sold' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: 'ARCHIVED', label: 'Archived' },
];

/**
 * The signed-in person's own ads (`/listings/mine`), newest first, with a filter by status and paging. Each row links to the ad
 * (where the seller manages it) and, where editing is allowed, to the edit form.
 */
@Component({
  selector: 'app-my-listings',
  imports: [RouterLink, NprPipe, NepalDatePipe, Pager],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-4xl">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My ads</h1>
          <a routerLink="/listings/new" class="btn btn-primary">Post an ad</a>
        </div>

        <div class="mt-5 flex flex-wrap gap-2" role="group" aria-label="Show ads">
          @for (option of filters; track option.label) {
            <button
              type="button"
              class="btn"
              [class.btn-primary]="option.status === filter()"
              [class.btn-secondary]="option.status !== filter()"
              [attr.aria-pressed]="option.status === filter()"
              (click)="choose(option.status)"
            >
              {{ option.label }}
            </button>
          }
        </div>

        <div class="mt-6" aria-live="polite">
          @switch (state().kind) {
            @case ('loading') {
              <ul class="space-y-3" aria-busy="true" aria-label="Loading your ads">
                @for (placeholder of placeholders; track placeholder) {
                  <li class="card flex gap-4 p-3" aria-hidden="true">
                    <div class="skeleton size-20 shrink-0"></div>
                    <div class="flex-1 space-y-2">
                      <div class="skeleton h-5 w-2/3"></div>
                      <div class="skeleton h-4 w-1/3"></div>
                    </div>
                  </li>
                }
              </ul>
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
                  <p class="text-slate-800">{{ emptyText() }}</p>
                  @if (filter() === null) {
                    <a routerLink="/listings/new" class="btn btn-primary mt-4"
                      >Post your first ad</a
                    >
                  }
                </div>
              } @else {
                <ul class="space-y-3">
                  @for (ad of items(); track ad.id) {
                    <li class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div class="size-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        @if (ad.primaryImage; as photo) {
                          <img
                            [src]="photo.url"
                            alt=""
                            loading="lazy"
                            decoding="async"
                            class="size-full object-cover"
                          />
                        } @else {
                          <span
                            class="grid size-full place-items-center px-1 text-center text-xs text-slate-600"
                            >No photo</span
                          >
                        }
                      </div>
                      <div class="min-w-0 flex-1">
                        <h2 class="truncate font-semibold text-slate-900">
                          <a [routerLink]="['/listings', ad.id]" class="hover:underline">{{
                            ad.title
                          }}</a>
                        </h2>
                        <p class="mt-0.5 text-sm font-bold text-brand-700">{{ ad.price | npr }}</p>
                        <p class="mt-0.5 truncate text-sm text-slate-700">
                          {{ place(ad) }} · {{ condition(ad) }}
                        </p>
                        <p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span class="badge" [class]="badgeClass(ad)">{{ statusText(ad) }}</span>
                          <span>{{ ad.publishedAt ?? ad.createdAt | nepalDate }}</span>
                        </p>
                      </div>
                      <div class="flex gap-2 sm:flex-col">
                        <a [routerLink]="['/listings', ad.id]" class="btn btn-secondary">
                          View<span class="sr-only"> {{ ad.title }}</span>
                        </a>
                        @if (canEdit(ad)) {
                          <a [routerLink]="['/listings', ad.id, 'edit']" class="btn btn-secondary">
                            Edit<span class="sr-only"> {{ ad.title }}</span>
                          </a>
                        }
                      </div>
                    </li>
                  }
                </ul>
                <p class="mt-4 text-sm text-slate-600">
                  {{ total() }} {{ total() === 1 ? 'ad' : 'ads' }}
                </p>
                <app-pager
                  class="mt-2"
                  [page]="pageIndex()"
                  [totalPages]="totalPages()"
                  (pageChange)="goTo($event)"
                />
              }
            }
          }
        </div>
      </div>
    </section>
  `,
})
export class MyListings {
  private readonly listingApi = inject(ListingApi);

  protected readonly filters = FILTERS;
  protected readonly placeholders = [1, 2, 3];

  protected readonly filter = signal<ListingStatus | null>(null);
  protected readonly pageIndex = signal(0);
  /** Bumped by "Try again", so the same query is sent once more. */
  private readonly attempt = signal(0);

  protected readonly state = toSignal(
    toObservable(
      computed(() => ({ status: this.filter(), page: this.pageIndex(), attempt: this.attempt() })),
    ).pipe(
      switchMap(({ status, page }) =>
        this.listingApi.mine({ status, page, size: PAGE_SIZE }).pipe(
          map((result): State => ({ kind: 'ready', page: result })),
          catchError((error: unknown) => of<State>({ kind: 'error', error: toApiError(error) })),
          startWith(LOADING),
        ),
      ),
    ),
    { initialValue: LOADING },
  );

  protected readonly items = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.page.content : [];
  });
  protected readonly total = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.page.totalElements : 0;
  });
  protected readonly totalPages = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.page.totalPages : 0;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.error.message : '';
  });
  protected readonly emptyText = computed(() => {
    const status = this.filter();
    return status === null
      ? 'You have not posted any ads yet.'
      : `You have no ads that are ${statusLabel(status).toLowerCase()}.`;
  });

  protected choose(status: ListingStatus | null): void {
    this.filter.set(status);
    this.pageIndex.set(0);
  }

  protected goTo(page: number): void {
    this.pageIndex.set(page);
  }

  protected retry(): void {
    this.attempt.update((count) => count + 1);
  }

  protected place(ad: ListingSummary): string {
    return placeLabel(ad.location, ad.locality);
  }

  protected condition(ad: ListingSummary): string {
    return conditionLabel(ad.condition);
  }

  protected statusText(ad: ListingSummary): string {
    return statusLabel(ad.status);
  }

  protected badgeClass(ad: ListingSummary): string {
    return statusBadgeClass(ad.status);
  }

  protected canEdit(ad: ListingSummary): boolean {
    return isEditable(ad.status);
  }
}
