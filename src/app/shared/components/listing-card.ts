import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingSummary } from '../../core/models/listing';
import { FavoriteButton } from './favorite-button';
import {
  conditionLabel,
  isLive,
  placeLabel,
  statusBadgeClass,
  statusLabel,
} from '../listing/listing-labels';
import { NepalDatePipe } from '../pipes/nepal-date-pipe';
import { NprPipe } from '../pipes/npr-pipe';

/**
 * One listing as a card: photo, title, price in NPR, place, condition and posting date. The whole card is one link, made from
 * the title (a "stretched link"), so a screen reader hears the title once and a click anywhere opens the ad. The status badge
 * is for the seller's own lists; the public never sees a listing that is not live.
 */
@Component({
  selector: 'app-listing-card',
  imports: [RouterLink, NgTemplateOutlet, NprPipe, NepalDatePipe, FavoriteButton],
  host: { class: 'block' },
  template: `
    @let ad = listing();
    <article class="card card-interactive relative flex h-full flex-col overflow-hidden">
      <div class="relative aspect-4/3 bg-slate-100">
        @if (ad.primaryImage; as photo) {
          <img
            [src]="photo.url"
            alt=""
            [attr.width]="photo.width"
            [attr.height]="photo.height"
            loading="lazy"
            decoding="async"
            class="absolute inset-0 size-full object-cover"
          />
        } @else {
          <div class="absolute inset-0 grid place-items-center text-slate-600">
            <svg
              class="size-10"
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
            <span class="text-xs">No photo</span>
          </div>
        }
        @if (showHeart()) {
          <app-favorite-button
            class="absolute top-2 right-2 z-10"
            [listingId]="ad.id"
            [title]="ad.title"
          />
        }
        <div class="pointer-events-none absolute top-2 left-2 flex flex-wrap gap-1">
          @if (ad.featured) {
            <span class="badge badge-brand">Featured</span>
          }
          @if (showStatus()) {
            <span class="badge" [class]="statusClass()">{{ statusText() }}</span>
          }
        </div>
      </div>

      <div class="flex flex-1 flex-col gap-1 p-3">
        <ng-template #titleLink>
          <a
            [routerLink]="['/listings', ad.id]"
            class="after:absolute after:inset-0 after:content-['']"
            >{{ ad.title }}</a
          >
        </ng-template>
        @if (headingLevel() === 2) {
          <h2 class="line-clamp-2 font-semibold text-slate-900">
            <ng-container *ngTemplateOutlet="titleLink" />
          </h2>
        } @else {
          <h3 class="line-clamp-2 font-semibold text-slate-900">
            <ng-container *ngTemplateOutlet="titleLink" />
          </h3>
        }
        <p class="text-lg font-bold text-brand-700">
          {{ ad.price | npr }}
          @if (ad.priceType === 'NEGOTIABLE') {
            <span class="ml-1 text-xs font-medium text-slate-600">Negotiable</span>
          }
        </p>
        <p class="truncate text-sm text-slate-700">{{ place() }}</p>
        <p class="mt-auto pt-1 text-xs text-slate-600">
          {{ condition() }} · {{ postedAt() | nepalDate }}
        </p>
      </div>
    </article>
  `,
})
export class ListingCard {
  readonly listing = input.required<ListingSummary>();
  /** Show the status badge (draft, live, sold, ...): for the seller's own lists. */
  readonly showStatus = input(false);
  /**
   * The level of the title's heading. 3 under a section heading (the home page, the lists on an ad page); 2 when the cards follow the
   * page's own title directly (search results, favourites), so the levels never skip.
   */
  readonly headingLevel = input<2 | 3>(3);
  /** Offer the heart (save to favourites). Only live ads can be saved, whatever this says. */
  readonly favoritable = input(true);

  protected readonly showHeart = computed(
    () => this.favoritable() && isLive(this.listing().status),
  );

  protected readonly place = computed(() =>
    placeLabel(this.listing().location, this.listing().locality),
  );
  protected readonly condition = computed(() => conditionLabel(this.listing().condition));
  protected readonly statusText = computed(() => statusLabel(this.listing().status));
  protected readonly statusClass = computed(() => statusBadgeClass(this.listing().status));
  /** Live listings show when they went live; the seller's drafts, when they were started. */
  protected readonly postedAt = computed(
    () => this.listing().publishedAt ?? this.listing().createdAt,
  );
}
