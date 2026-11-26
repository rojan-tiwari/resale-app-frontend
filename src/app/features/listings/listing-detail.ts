import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { ApiError, toApiError } from '../../core/models/api-error';
import { Listing, ListingStatus } from '../../core/models/listing';
import { Toasts } from '../../core/notifications/toasts';
import { ListingApi } from '../../core/services/listing-api';
import { ListState, ListingList } from '../../shared/components/listing-list';
import {
  conditionLabel,
  isEditable,
  isLive,
  placeLabel,
  priceTypeLabel,
  statusBadgeClass,
  statusLabel,
} from '../../shared/listing/listing-labels';
import { NepalDatePipe } from '../../shared/pipes/nepal-date-pipe';
import { NprPipe } from '../../shared/pipes/npr-pipe';
import { ImageGallery } from './image-gallery';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly listing: Listing }
  | { readonly kind: 'error'; readonly error: ApiError };

const LOADING: State = { kind: 'loading' };

/** A move the seller can make from this page: the button's words, its look, and whether it asks "are you sure?" first. */
interface OwnerAction {
  readonly status: ListingStatus;
  readonly label: string;
  readonly style: 'primary' | 'secondary';
  /** The question to ask first, for moves that are hard to take back; null for the rest. */
  readonly confirm: string | null;
}

/** Statuses only an administrator may choose: never offered to the seller. */
const ADMIN_ONLY: readonly ListingStatus[] = ['REJECTED'];

/**
 * One ad (`/listings/:id`): photos, price, facts, description and the seller, then more ads by the same seller and similar ads.
 * Everyone sees a live ad. Its seller also sees what state it is in and the moves allowed from there (publish, reserve, sold,
 * take down, restore): the buttons come from the server's `allowedStatuses`, so the page cannot offer a move the server would refuse.
 */
@Component({
  selector: 'app-listing-detail',
  imports: [RouterLink, ImageGallery, ListingList, NprPipe, NepalDatePipe],
  template: `
    <section class="container-page py-8 sm:py-12">
      @switch (state().kind) {
        @case ('loading') {
          <div class="grid gap-8 lg:grid-cols-5" aria-busy="true" aria-label="Loading the ad">
            <div class="skeleton aspect-4/3 w-full lg:col-span-3"></div>
            <div class="space-y-4 lg:col-span-2">
              <div class="skeleton h-8 w-4/5"></div>
              <div class="skeleton h-8 w-1/3"></div>
              <div class="skeleton h-24 w-full"></div>
            </div>
          </div>
        }
        @case ('error') {
          <div class="card mx-auto max-w-xl p-6 text-center sm:p-8" role="alert">
            @if (notFound()) {
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">
                This ad is not available
              </h1>
              <p class="mt-3 text-slate-600">
                It may have been sold, taken down by the seller, or the link may be wrong.
              </p>
              <a routerLink="/" class="btn btn-primary mt-6">Go to the home page</a>
            } @else {
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">
                The ad could not be loaded
              </h1>
              <p class="mt-3 text-slate-600">{{ errorMessage() }}</p>
              <button type="button" class="btn btn-primary mt-6" (click)="retry()">
                Try again
              </button>
            }
          </div>
        }
        @case ('ready') {
          @if (ad(); as listing) {
            <article>
              @if (isOwner() && !live()) {
                <div
                  class="mb-6 rounded-xl border p-4 text-sm"
                  [class.border-red-200]="listing.status === 'REJECTED'"
                  [class.bg-red-50]="listing.status === 'REJECTED'"
                  [class.text-red-900]="listing.status === 'REJECTED'"
                  [class.border-slate-200]="listing.status !== 'REJECTED'"
                  [class.bg-slate-100]="listing.status !== 'REJECTED'"
                  [class.text-slate-900]="listing.status !== 'REJECTED'"
                  role="status"
                >
                  <p class="font-semibold">{{ statusHeadline() }}</p>
                  @if (listing.status === 'REJECTED' && listing.rejectionReason) {
                    <p class="mt-1">Reason: {{ listing.rejectionReason }}</p>
                  }
                </div>
              }

              <nav aria-label="Breadcrumb" class="text-sm text-slate-600">
                <ol class="flex flex-wrap items-center gap-x-2">
                  <li>{{ listing.category.name }}</li>
                  @if (listing.subcategory; as sub) {
                    <li aria-hidden="true">›</li>
                    <li>{{ sub.name }}</li>
                  }
                </ol>
              </nav>

              <div class="mt-3 grid gap-8 lg:grid-cols-5">
                <div class="lg:col-span-3">
                  <app-image-gallery [images]="listing.images" [title]="listing.title" />

                  <h2 class="mt-8 text-lg font-semibold text-slate-900">Description</h2>
                  <p class="mt-2 text-sm whitespace-pre-line text-slate-800">
                    {{ listing.description }}
                  </p>
                </div>

                <div class="space-y-6 lg:col-span-2">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      @if (listing.featured) {
                        <span class="badge badge-brand">Featured</span>
                      }
                      @if (isOwner()) {
                        <span class="badge" [class]="statusClass()">{{ statusText() }}</span>
                      }
                    </div>
                    <h1
                      class="mt-2 text-2xl font-bold tracking-tight break-words text-slate-900 sm:text-3xl"
                    >
                      {{ listing.title }}
                    </h1>
                    <p class="mt-3 text-3xl font-bold text-brand-700">{{ listing.price | npr }}</p>
                    <p class="mt-1 text-sm text-slate-700">{{ priceKind() }}</p>
                  </div>

                  <dl class="card divide-y divide-slate-100 text-sm">
                    <div class="flex justify-between gap-4 px-4 py-3">
                      <dt class="font-medium text-slate-800">Condition</dt>
                      <dd class="text-right text-slate-700">{{ condition() }}</dd>
                    </div>
                    <div class="flex justify-between gap-4 px-4 py-3">
                      <dt class="font-medium text-slate-800">Location</dt>
                      <dd class="text-right text-slate-700">{{ place() }}</dd>
                    </div>
                    <div class="flex justify-between gap-4 px-4 py-3">
                      <dt class="font-medium text-slate-800">Posted</dt>
                      <dd class="text-right text-slate-700">
                        {{ listing.publishedAt ?? listing.createdAt | nepalDate }}
                      </dd>
                    </div>
                    <div class="flex justify-between gap-4 px-4 py-3">
                      <dt class="font-medium text-slate-800">Views</dt>
                      <dd class="text-right text-slate-700">{{ listing.viewCount }}</dd>
                    </div>
                  </dl>

                  <section class="card p-4" aria-labelledby="seller-heading">
                    <h2 id="seller-heading" class="text-sm font-semibold text-slate-800">Seller</h2>
                    <div class="mt-3 flex items-center gap-3">
                      <span
                        class="grid size-12 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800"
                        aria-hidden="true"
                      >
                        {{ sellerInitial() }}
                      </span>
                      <div class="min-w-0">
                        <a
                          [routerLink]="['/users', listing.seller.id]"
                          class="font-semibold break-words text-brand-700 underline underline-offset-2 hover:text-brand-800"
                        >
                          {{ listing.seller.displayName }}
                        </a>
                        @if (listing.seller.memberSince) {
                          <p class="text-sm text-slate-600">
                            Member since {{ listing.seller.memberSince | nepalDate }}
                          </p>
                        }
                      </div>
                    </div>
                    @if (listing.seller.phone; as phone) {
                      <p class="mt-3 text-sm">
                        <span class="font-medium text-slate-800">Phone: </span>
                        <a
                          [href]="'tel:' + phone"
                          class="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                          >{{ phone }}</a
                        >
                      </p>
                    }
                  </section>

                  @if (isOwner()) {
                    <section class="card space-y-3 p-4" aria-labelledby="owner-heading">
                      <h2 id="owner-heading" class="text-sm font-semibold text-slate-800">
                        Manage your ad
                      </h2>

                      @if (actionError(); as message) {
                        <p
                          class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
                          role="alert"
                        >
                          {{ message }}
                        </p>
                      }

                      @if (confirming(); as question) {
                        <div
                          class="rounded-xl border border-slate-300 bg-slate-50 p-3"
                          role="alertdialog"
                          aria-labelledby="confirm-text"
                        >
                          <p id="confirm-text" class="text-sm font-medium text-slate-900">
                            {{ question.confirm }}
                          </p>
                          <div class="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              class="btn btn-primary"
                              [disabled]="changing()"
                              (click)="perform(question.status)"
                            >
                              {{
                                changing() ? 'Please wait…' : 'Yes, ' + question.label.toLowerCase()
                              }}
                            </button>
                            <button
                              type="button"
                              class="btn btn-secondary"
                              [disabled]="changing()"
                              (click)="confirming.set(null)"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      } @else {
                        <div class="flex flex-wrap gap-2">
                          @if (editable()) {
                            <a
                              [routerLink]="['/listings', listing.id, 'edit']"
                              class="btn btn-secondary"
                              >Edit ad</a
                            >
                          }
                          @for (action of actions(); track action.status) {
                            <button
                              type="button"
                              class="btn"
                              [class.btn-primary]="action.style === 'primary'"
                              [class.btn-secondary]="action.style === 'secondary'"
                              [disabled]="changing()"
                              (click)="choose(action)"
                            >
                              {{ action.label }}
                            </button>
                          }
                        </div>
                      }
                    </section>
                  }
                </div>
              </div>

              @if (live()) {
                @if (showOthers()) {
                  <section class="mt-12" aria-labelledby="others-heading">
                    <h2
                      id="others-heading"
                      class="mb-4 text-xl font-bold tracking-tight text-slate-900"
                    >
                      More from {{ listing.seller.displayName }}
                    </h2>
                    <app-listing-list
                      [state]="others()"
                      loadingLabel="Loading more ads from this seller"
                      (retry)="loadRelated(listing)"
                    />
                  </section>
                }
                @if (showSimilar()) {
                  <section class="mt-12" aria-labelledby="similar-heading">
                    <h2
                      id="similar-heading"
                      class="mb-4 text-xl font-bold tracking-tight text-slate-900"
                    >
                      Similar ads
                    </h2>
                    <app-listing-list
                      [state]="similar()"
                      loadingLabel="Loading similar ads"
                      (retry)="loadRelated(listing)"
                    />
                  </section>
                }
              }
            </article>
          }
        }
      }
    </section>
  `,
})
export class ListingDetail {
  private readonly listingApi = inject(ListingApi);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(Toasts);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  /** Counts the loads of the related lists, so a slow answer for the ad the person already left cannot replace the current ones. */
  private relatedLoads = 0;

  /** Bound from the `:id` route parameter (router input binding). */
  readonly id = input.required<string>();

  /** Bumped by "Try again", so the same id is loaded once more. */
  private readonly attempt = signal(0);

  protected readonly state = signal<State>(LOADING);
  protected readonly similar = signal<ListState>({ kind: 'loading' });
  protected readonly others = signal<ListState>({ kind: 'loading' });

  /** The move waiting for "are you sure?", if any. */
  protected readonly confirming = signal<OwnerAction | null>(null);
  protected readonly changing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly ad = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.listing : null;
  });
  protected readonly notFound = computed(() => {
    const state = this.state();
    return state.kind === 'error' && state.error.isNotFound;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.error.message : '';
  });

  protected readonly isOwner = computed(() => {
    const listing = this.ad();
    return listing !== null && this.session.user()?.id === listing.seller.id;
  });
  protected readonly live = computed(() => {
    const listing = this.ad();
    return listing !== null && isLive(listing.status);
  });
  protected readonly editable = computed(() => {
    const listing = this.ad();
    return listing !== null && isEditable(listing.status);
  });
  protected readonly statusText = computed(() => statusLabel(this.ad()?.status ?? 'DRAFT'));
  protected readonly statusClass = computed(() => statusBadgeClass(this.ad()?.status ?? 'DRAFT'));
  protected readonly condition = computed(() => conditionLabel(this.ad()?.condition ?? 'GOOD'));
  protected readonly priceKind = computed(() => priceTypeLabel(this.ad()?.priceType ?? 'FIXED'));
  protected readonly place = computed(() => {
    const listing = this.ad();
    return listing ? placeLabel(listing.location, listing.locality) : '';
  });
  protected readonly sellerInitial = computed(() =>
    (this.ad()?.seller.displayName ?? '').trim().charAt(0).toUpperCase(),
  );
  protected readonly statusHeadline = computed(() => {
    switch (this.ad()?.status) {
      case 'DRAFT':
        return 'This ad is a draft. Only you can see it. Publish it when it is ready.';
      case 'PENDING_REVIEW':
        return 'This ad is waiting for approval. It goes live once an administrator approves it.';
      case 'REJECTED':
        return 'This ad was rejected and is not visible to others.';
      case 'SOLD':
        return 'This ad is marked as sold and is no longer shown to others.';
      case 'ARCHIVED':
        return 'This ad was taken down and is no longer shown to others.';
      default:
        return '';
    }
  });

  /** The seller's buttons: exactly the moves the server allows now, minus the ones only administrators make. */
  protected readonly actions = computed<readonly OwnerAction[]>(() => {
    const listing = this.ad();
    if (listing === null || !this.isOwner()) {
      return [];
    }
    return listing.allowedStatuses
      .filter((status) => !ADMIN_ONLY.includes(status))
      .map((status) => ownerAction(listing.status, status));
  });

  protected readonly showOthers = computed(() => {
    const state = this.others();
    return state.kind !== 'ready' || state.items.length > 0;
  });
  protected readonly showSimilar = computed(() => {
    const state = this.similar();
    return state.kind !== 'ready' || state.items.length > 0;
  });

  constructor() {
    toObservable(computed(() => ({ id: this.id(), attempt: this.attempt() })))
      .pipe(
        switchMap(({ id }) =>
          this.listingApi.get(id).pipe(
            map((listing): State => ({ kind: 'ready', listing })),
            catchError((error: unknown) => of<State>({ kind: 'error', error: toApiError(error) })),
            startWith(LOADING),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.state.set(state);
        this.confirming.set(null);
        this.actionError.set(null);
        if (state.kind === 'ready') {
          this.loadRelated(state.listing);
        }
      });

    effect(() => {
      const name = this.ad()?.title;
      this.title.setTitle(name ? `${name} · ResaleMarket` : 'Ad · ResaleMarket');
    });
  }

  protected retry(): void {
    this.attempt.update((count) => count + 1);
  }

  /** More ads by this seller and similar ads: only for live ads, and each loads (and fails) on its own. */
  protected loadRelated(listing: Listing): void {
    if (!isLive(listing.status)) {
      return;
    }
    const load = ++this.relatedLoads;
    const current = () => load === this.relatedLoads;
    this.similar.set({ kind: 'loading' });
    this.others.set({ kind: 'loading' });
    this.listingApi
      .similar(listing.id, 8)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => current() && this.similar.set({ kind: 'ready', items }),
        error: (error: unknown) =>
          current() && this.similar.set({ kind: 'error', message: toApiError(error).message }),
      });
    this.listingApi
      .ofSeller(listing.seller.id, { size: 9 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) =>
          current() &&
          this.others.set({
            kind: 'ready',
            items: page.content.filter((item) => item.id !== listing.id).slice(0, 8),
          }),
        error: (error: unknown) =>
          current() && this.others.set({ kind: 'error', message: toApiError(error).message }),
      });
  }

  protected choose(action: OwnerAction): void {
    this.actionError.set(null);
    if (action.confirm !== null) {
      this.confirming.set(action);
      return;
    }
    this.perform(action.status);
  }

  protected perform(status: ListingStatus): void {
    const listing = this.ad();
    if (listing === null || this.changing()) {
      return;
    }
    this.changing.set(true);
    this.actionError.set(null);
    this.listingApi
      .changeStatus(listing.id, { status, reason: null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (changed) => {
          this.changing.set(false);
          this.confirming.set(null);
          this.state.set({ kind: 'ready', listing: changed });
          this.toasts.success(changedMessage(changed));
          this.loadRelated(changed);
        },
        error: (error: unknown) => {
          this.changing.set(false);
          this.confirming.set(null);
          this.actionError.set(toApiError(error).message);
        },
      });
  }
}

/** The words for a move, given where the ad is now. Moves that are hard to take back ask first. */
function ownerAction(from: ListingStatus, to: ListingStatus): OwnerAction {
  switch (to) {
    case 'ACTIVE':
      return from === 'DRAFT'
        ? { status: to, label: 'Publish ad', style: 'primary', confirm: null }
        : { status: to, label: 'Make available again', style: 'secondary', confirm: null };
    case 'PENDING_REVIEW':
      return { status: to, label: 'Submit for review', style: 'primary', confirm: null };
    case 'RESERVED':
      return { status: to, label: 'Mark as reserved', style: 'secondary', confirm: null };
    case 'SOLD':
      return {
        status: to,
        label: 'Mark as sold',
        style: 'secondary',
        confirm: 'Mark this ad as sold? It will no longer be shown to others.',
      };
    case 'DRAFT':
      return {
        status: to,
        label:
          from === 'PENDING_REVIEW'
            ? 'Withdraw from review'
            : from === 'ARCHIVED'
              ? 'Restore as draft'
              : 'Move back to draft',
        style: 'secondary',
        confirm: null,
      };
    case 'ARCHIVED':
      return {
        status: to,
        label: from === 'DRAFT' ? 'Delete draft' : 'Take down',
        style: 'secondary',
        confirm:
          from === 'DRAFT'
            ? 'Delete this draft? You can restore it later from your archived ads.'
            : 'Take this ad down? It will no longer be shown to others.',
      };
    default:
      return { status: to, label: statusLabel(to), style: 'secondary', confirm: null };
  }
}

function changedMessage(listing: Listing): string {
  switch (listing.status) {
    case 'ACTIVE':
      return 'Your ad is live.';
    case 'PENDING_REVIEW':
      return 'Your ad was sent for review.';
    case 'RESERVED':
      return 'The ad is marked as reserved.';
    case 'SOLD':
      return 'The ad is marked as sold.';
    case 'ARCHIVED':
      return 'The ad was taken down.';
    default:
      return 'The ad is now a draft.';
  }
}
