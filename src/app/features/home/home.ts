import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, Subscription, map } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { LocationPreference } from '../../core/location/location-preference';
import { toApiError } from '../../core/models/api-error';
import { ListingSummary } from '../../core/models/listing';
import { RecommendationBasis } from '../../core/models/search';
import { CategoryStore } from '../../core/services/category-store';
import { ListingApi } from '../../core/services/listing-api';
import { ListState } from '../../shared/components/listing-list';
import { HomeSection } from './home-section';

const SECTION_SIZE = 8;
const LOADING: ListState = { kind: 'loading' };

/**
 * The home page: a hero with the call to post an ad, the categories, and four lists of ads that load on their own — featured, recent, near
 * the chosen district and recommended — so one that fails or is slow never holds back the others. Featured, near-you and recommended
 * are left out when they have nothing to show; "recent" always appears.
 *
 * <p>"Near you" follows the place chosen in the header. "Recommended" depends on who is signed in (ads like the ones the person saved, or
 * what is popular) and is fetched again when the person signs in or out.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, HomeSection],
  template: `
    <section class="bg-linear-to-b from-brand-50 to-slate-50">
      <div class="container-page py-10 sm:py-14">
        <span class="badge badge-brand">Nepal's second-hand marketplace</span>
        <h1 class="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Buy and sell pre-loved things, close to home.
        </h1>
        <p class="mt-4 max-w-2xl text-lg text-slate-600">
          Phones, laptops, vehicles, furniture and more — priced in NPR and listed by province,
          district and city.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <a routerLink="/search" class="btn btn-secondary">Browse all ads</a>
          <a routerLink="/listings/new" class="btn btn-primary">Post your ad</a>
        </div>
      </div>
    </section>

    <div class="container-page space-y-12 py-10">
      <section aria-labelledby="home-categories">
        <h2
          id="home-categories"
          class="mb-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
        >
          Browse by category
        </h2>
        @switch (categories.status()) {
          @case ('ready') {
            <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              @for (category of categories.tree(); track category.id) {
                <li>
                  <a
                    [routerLink]="['/categories', category.slug]"
                    class="card card-interactive flex h-full items-center gap-3 p-3 text-sm font-semibold text-slate-900"
                  >
                    <span
                      class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800"
                      aria-hidden="true"
                      >{{ category.name.charAt(0) }}</span
                    >
                    <span>{{ category.name }}</span>
                  </a>
                </li>
              }
            </ul>
          }
          @case ('error') {
            <p class="text-sm text-slate-700">
              The categories could not be loaded.
              <button
                type="button"
                class="font-medium text-brand-700 underline underline-offset-2"
                (click)="categories.retry()"
              >
                Try again
              </button>
            </p>
          }
          @default {
            <div
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7"
              aria-busy="true"
              aria-label="Loading categories"
            >
              @for (placeholder of placeholders; track placeholder) {
                <div class="skeleton h-16" aria-hidden="true"></div>
              }
            </div>
          }
        }
      </section>

      @if (showFeatured()) {
        <app-home-section
          heading="Featured ads"
          [state]="featured()"
          [seeAll]="{ path: '/search', query: { sort: 'newest' } }"
          (retry)="loadFeatured()"
        />
      }

      <app-home-section
        heading="Recently posted"
        [state]="recent()"
        emptyText="No ads have been posted yet. Be the first!"
        [seeAll]="{ path: '/search', query: { sort: 'newest' } }"
        (retry)="loadRecent()"
      />

      @if (place(); as chosen) {
        @if (showNear()) {
          <app-home-section
            [heading]="'Near ' + chosen.districtName"
            subtitle="Ads in the district you chose. Change it at the top of the page."
            [state]="near()"
            [seeAll]="{
              path: '/search',
              query: { provinceId: chosen.provinceId, districtId: chosen.districtId },
            }"
            (retry)="loadNear()"
          />
        }
      } @else {
        <section
          class="card flex flex-wrap items-center justify-between gap-3 p-5"
          aria-labelledby="home-near-prompt"
        >
          <div>
            <h2 id="home-near-prompt" class="text-lg font-semibold text-slate-900">
              See ads near you
            </h2>
            <p class="mt-0.5 text-sm text-slate-600">
              Choose your district with the location button at the top of the page.
            </p>
          </div>
          <a routerLink="/search" class="btn btn-secondary">Browse all of Nepal</a>
        </section>
      }

      @if (showRecommended()) {
        <app-home-section
          [heading]="recommendedHeading()"
          [subtitle]="recommendedSubtitle()"
          [state]="recommended()"
          (retry)="loadRecommended()"
        />
      }

      <section
        class="card flex flex-wrap items-center justify-between gap-4 bg-brand-600 p-6 text-white"
        aria-labelledby="home-sell"
      >
        <div>
          <h2 id="home-sell" class="text-xl font-bold">Got something to sell?</h2>
          <p class="mt-1 text-brand-50">Post an ad with photos in a few minutes. It's free.</p>
        </div>
        <a routerLink="/listings/new" class="btn bg-white text-brand-800 hover:bg-brand-50"
          >Post an ad</a
        >
      </section>
    </div>
  `,
})
export class Home {
  private readonly listingApi = inject(ListingApi);
  private readonly session = inject(AuthSession);
  private readonly preference = inject(LocationPreference);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly categories = inject(CategoryStore);

  protected readonly placeholders = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly place = this.preference.place;

  protected readonly featured = signal<ListState>(LOADING);
  protected readonly recent = signal<ListState>(LOADING);
  protected readonly near = signal<ListState>(LOADING);
  protected readonly recommended = signal<ListState>(LOADING);
  private readonly basis = signal<RecommendationBasis>('POPULAR');

  /** Sections that are hidden when there is nothing to show (and while they load nothing is shown for them either). */
  protected readonly showFeatured = computed(() => this.hasContentOrIsLoading(this.featured()));
  protected readonly showNear = computed(() => this.hasContentOrIsLoading(this.near()));
  protected readonly showRecommended = computed(() =>
    this.hasContentOrIsLoading(this.recommended()),
  );

  protected readonly recommendedHeading = computed(() =>
    this.basis() === 'FAVOURITE_CATEGORIES' ? 'Recommended for you' : 'Popular right now',
  );
  protected readonly recommendedSubtitle = computed(() =>
    this.basis() === 'FAVOURITE_CATEGORIES'
      ? 'New ads in the categories of the ads you saved.'
      : 'The ads people have been looking at the most lately.',
  );

  private readonly running = new Map<string, Subscription>();

  constructor() {
    this.categories.load();
    this.loadFeatured();
    this.loadRecent();
    // "Near you" follows the chosen place; "recommended" follows who is signed in. Both start once their input is known.
    effect(() => {
      this.place();
      untracked(() => this.loadNear());
    });
    effect(() => {
      const status = this.session.status();
      if (status === 'authenticated' || status === 'anonymous') {
        untracked(() => this.loadRecommended());
      }
    });
    this.destroyRef.onDestroy(() =>
      this.running.forEach((subscription) => subscription.unsubscribe()),
    );
  }

  protected loadFeatured(): void {
    this.run('featured', this.featured, this.listingApi.featured(SECTION_SIZE));
  }

  protected loadRecent(): void {
    this.run('recent', this.recent, this.listingApi.recent(SECTION_SIZE));
  }

  protected loadNear(): void {
    const place = this.place();
    if (place === null) {
      this.running.get('near')?.unsubscribe();
      this.near.set(LOADING);
      return;
    }
    this.run(
      'near',
      this.near,
      this.listingApi
        .search({ districtId: place.districtId, sort: 'newest', size: SECTION_SIZE })
        .pipe(map((page) => page.content)),
    );
  }

  protected loadRecommended(): void {
    this.run(
      'recommended',
      this.recommended,
      this.listingApi.recommended(SECTION_SIZE).pipe(
        map((result) => {
          this.basis.set(result.basis);
          return result.listings;
        }),
      ),
    );
  }

  /** Loads one section, replacing a load of the same section that is still running (a slow old answer must not overwrite a new one). */
  private run(
    name: string,
    target: { set(state: ListState): void },
    source: Observable<readonly ListingSummary[]>,
  ): void {
    this.running.get(name)?.unsubscribe();
    target.set(LOADING);
    this.running.set(
      name,
      source.subscribe({
        next: (items) => target.set({ kind: 'ready', items }),
        error: (error: unknown) =>
          target.set({ kind: 'error', message: toApiError(error).message }),
      }),
    );
  }

  private hasContentOrIsLoading(state: ListState): boolean {
    return state.kind !== 'ready' || state.items.length > 0;
  }
}
