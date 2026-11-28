import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, debounceTime, filter, map, switchMap, tap } from 'rxjs';
import { ApiError, toApiError } from '../../core/models/api-error';
import { ListingCondition, ListingSummary } from '../../core/models/listing';
import { District, Municipality, Province } from '../../core/models/location';
import { Page } from '../../core/models/page';
import { ListingSort, SearchParams } from '../../core/models/search';
import {
  SEARCH_PAGE_SIZE,
  activeFilterCount,
  parseSearchParams,
  toQueryParams,
} from '../../core/search/search-params';
import { CategoryStore } from '../../core/services/category-store';
import { ListingApi } from '../../core/services/listing-api';
import { LocationApi } from '../../core/services/location-api';
import { ListingCard } from '../../shared/components/listing-card';
import { Pager } from '../../shared/components/pager';
import { CONDITION_OPTIONS } from '../../shared/listing/listing-labels';

type Status = 'loading' | 'ready' | 'error';

const POSTED_OPTIONS: readonly { readonly value: number | null; readonly label: string }[] = [
  { value: null, label: 'Any time' },
  { value: 1, label: 'Last 24 hours' },
  { value: 3, label: 'Last 3 days' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
];

/** The wait after the last change of a filter before the search is run, so typing a price does not search on every key. */
const APPLY_AFTER_MS = 350;

/**
 * Search and category pages: one page, because a category is only a search with the category already chosen.
 *
 * <p><b>The address is the single source of truth.</b> The keyword, every filter, the sort and the page are query parameters
 * ({@code /search?q=phone&minPrice=5000&condition=GOOD}); the page reads them with {@link parseSearchParams}, and the filter form is only a
 * convenient way to write them. Changing a filter rewrites the address (replacing the history entry, so the back button is not
 * flooded with every price typed); moving to another page or a link pushes a new one. A search is therefore a link that can be shared
 * or bookmarked, and the back button returns to the previous search. The server runs the search (never the browser) and checks every value.
 *
 * <p>On a category page ({@code /categories/:slug[/:sub]}) the category is part of the route, so the category pickers are replaced
 * by links to the subcategories; everything else works the same.
 */
@Component({
  selector: 'app-search',
  imports: [ReactiveFormsModule, RouterLink, ListingCard, Pager],
  template: `
    <section class="container-page py-8 sm:py-10">
      @if (scopeNotFound()) {
        <div class="card mx-auto max-w-xl p-6 text-center sm:p-8" role="alert">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Category not found</h1>
          <p class="mt-3 text-slate-600">
            There is no such category. It may have been renamed or removed.
          </p>
          <a routerLink="/categories" class="btn btn-primary mt-6">See all categories</a>
        </div>
      } @else {
        <nav aria-label="Breadcrumb" class="text-sm text-slate-600">
          <ol class="flex flex-wrap items-center gap-x-2">
            <li>
              <a routerLink="/" class="underline underline-offset-2 hover:text-slate-900">Home</a>
            </li>
            @if (scope().category; as category) {
              <li aria-hidden="true">›</li>
              <li>
                @if (scope().subcategory) {
                  <a
                    [routerLink]="['/categories', category.slug]"
                    class="underline underline-offset-2 hover:text-slate-900"
                    >{{ category.name }}</a
                  >
                } @else {
                  <span aria-current="page">{{ category.name }}</span>
                }
              </li>
              @if (scope().subcategory; as sub) {
                <li aria-hidden="true">›</li>
                <li>
                  <span aria-current="page">{{ sub.name }}</span>
                </li>
              }
            } @else {
              <li aria-hidden="true">›</li>
              <li><span aria-current="page">Search</span></li>
            }
          </ol>
        </nav>

        <h1 class="mt-2 text-2xl font-bold tracking-tight break-words text-slate-900 sm:text-3xl">
          {{ heading() }}
        </h1>

        @if (scope().category; as category) {
          @if (category.children.length > 0 && !scope().subcategory) {
            <ul class="mt-4 flex flex-wrap gap-2" aria-label="Subcategories">
              @for (child of category.children; track child.id) {
                <li>
                  <a
                    [routerLink]="['/categories', category.slug, child.slug]"
                    class="btn btn-secondary"
                    >{{ child.name }}</a
                  >
                </li>
              }
            </ul>
          }
        }

        <div class="mt-6 grid gap-6 lg:grid-cols-4">
          <div class="lg:col-span-1">
            <button
              type="button"
              class="btn btn-secondary w-full lg:hidden"
              aria-controls="filters-panel"
              [attr.aria-expanded]="filtersOpen()"
              (click)="filtersOpen.set(!filtersOpen())"
            >
              Filters
              @if (filterCount() > 0) {
                <span class="badge badge-brand">{{ filterCount() }}</span>
              }
            </button>

            <form
              id="filters-panel"
              class="card mt-3 space-y-5 p-4 lg:mt-0 lg:block"
              [class.hidden]="!filtersOpen()"
              [formGroup]="form"
              (submit)="$event.preventDefault()"
              aria-label="Filters"
            >
              @if (!scope().category) {
                <div>
                  <label class="field-label" for="filter-categoryId">Category</label>
                  <select id="filter-categoryId" class="field-input" formControlName="categoryId">
                    <option [ngValue]="null">All categories</option>
                    @for (category of categories.tree(); track category.id) {
                      <option [ngValue]="category.id">{{ category.name }}</option>
                    }
                  </select>
                </div>
                @if (subcategoryOptions().length > 0) {
                  <div>
                    <label class="field-label" for="filter-subcategoryId">Subcategory</label>
                    <select
                      id="filter-subcategoryId"
                      class="field-input"
                      formControlName="subcategoryId"
                    >
                      <option [ngValue]="null">All subcategories</option>
                      @for (child of subcategoryOptions(); track child.id) {
                        <option [ngValue]="child.id">{{ child.name }}</option>
                      }
                    </select>
                  </div>
                }
              }

              <fieldset>
                <legend class="field-label">Price (Rs.)</legend>
                <div class="flex items-center gap-2">
                  <div class="min-w-0 flex-1">
                    <label class="sr-only" for="filter-minPrice">Lowest price</label>
                    <input
                      id="filter-minPrice"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      class="field-input"
                      placeholder="Min"
                      formControlName="minPrice"
                      [attr.aria-invalid]="priceError() ? 'true' : null"
                      aria-describedby="filter-price-error"
                    />
                  </div>
                  <span aria-hidden="true">–</span>
                  <div class="min-w-0 flex-1">
                    <label class="sr-only" for="filter-maxPrice">Highest price</label>
                    <input
                      id="filter-maxPrice"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      class="field-input"
                      placeholder="Max"
                      formControlName="maxPrice"
                      [attr.aria-invalid]="priceError() ? 'true' : null"
                      aria-describedby="filter-price-error"
                    />
                  </div>
                </div>
                <p id="filter-price-error" class="field-error" [hidden]="!priceError()">
                  {{ priceError() }}
                </p>
              </fieldset>

              <fieldset formGroupName="condition">
                <legend class="field-label">Condition</legend>
                <div class="space-y-1.5">
                  @for (option of conditions; track option.value) {
                    <label class="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        class="size-5 accent-brand-600"
                        [id]="'filter-condition-' + option.value"
                        [formControlName]="option.value"
                      />
                      {{ option.label }}
                    </label>
                  }
                </div>
              </fieldset>

              <fieldset class="space-y-3">
                <legend class="field-label">Location</legend>
                <div>
                  <label class="sr-only" for="filter-provinceId">Province</label>
                  <select id="filter-provinceId" class="field-input" formControlName="provinceId">
                    <option [ngValue]="null">All of Nepal</option>
                    @for (province of provinces(); track province.id) {
                      <option [ngValue]="province.id">{{ province.name }}</option>
                    }
                  </select>
                </div>
                @if (districts().length > 0) {
                  <div>
                    <label class="sr-only" for="filter-districtId">District</label>
                    <select id="filter-districtId" class="field-input" formControlName="districtId">
                      <option [ngValue]="null">Any district</option>
                      @for (district of districts(); track district.id) {
                        <option [ngValue]="district.id">{{ district.name }}</option>
                      }
                    </select>
                  </div>
                }
                @if (municipalities().length > 0) {
                  <div>
                    <label class="sr-only" for="filter-municipalityId">City or municipality</label>
                    <select
                      id="filter-municipalityId"
                      class="field-input"
                      formControlName="municipalityId"
                    >
                      <option [ngValue]="null">Any city</option>
                      @for (municipality of municipalities(); track municipality.id) {
                        <option [ngValue]="municipality.id">{{ municipality.name }}</option>
                      }
                    </select>
                  </div>
                }
              </fieldset>

              <div>
                <label class="field-label" for="filter-postedWithinDays">Posted</label>
                <select
                  id="filter-postedWithinDays"
                  class="field-input"
                  formControlName="postedWithinDays"
                >
                  @for (option of postedOptions; track option.label) {
                    <option [ngValue]="option.value">{{ option.label }}</option>
                  }
                </select>
              </div>

              <label class="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  id="filter-negotiable"
                  type="checkbox"
                  class="size-5 accent-brand-600"
                  formControlName="negotiable"
                />
                Negotiable prices only
              </label>

              @if (filterCount() > 0) {
                <button type="button" class="btn btn-secondary w-full" (click)="clearFilters()">
                  Clear filters
                </button>
              }
            </form>
          </div>

          <div class="lg:col-span-3" [attr.aria-busy]="status() === 'loading'">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-slate-700" role="status" aria-live="polite">{{ summary() }}</p>
              <form [formGroup]="form" class="flex items-center gap-2">
                <label class="text-sm font-medium text-slate-800" for="filter-sort">Sort by</label>
                <select id="filter-sort" class="field-input w-auto" formControlName="sort">
                  @if (hasKeyword()) {
                    <option value="relevance">Best match</option>
                  }
                  <option value="newest">Newest</option>
                  <option value="priceAsc">Price: low to high</option>
                  <option value="priceDesc">Price: high to low</option>
                </select>
              </form>
            </div>

            <div class="mt-4">
              @switch (status()) {
                @case ('error') {
                  <div class="card p-6" role="alert">
                    <h2 class="text-lg font-semibold text-slate-900">
                      The search could not be run
                    </h2>
                    <p class="mt-2 text-sm text-slate-700">{{ errorMessage() }}</p>
                    <button type="button" class="btn btn-primary mt-4" (click)="retry()">
                      Try again
                    </button>
                  </div>
                }
                @default {
                  @if (status() === 'loading' && !results()) {
                    <div
                      class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3"
                      aria-label="Loading results"
                    >
                      @for (placeholder of placeholders; track placeholder) {
                        <div class="card overflow-hidden" aria-hidden="true">
                          <div class="skeleton aspect-4/3 rounded-none"></div>
                          <div class="space-y-2 p-3">
                            <div class="skeleton h-4 w-4/5"></div>
                            <div class="skeleton h-5 w-1/2"></div>
                          </div>
                        </div>
                      }
                    </div>
                  } @else if (results(); as page) {
                    @if (page.content.length === 0) {
                      <div class="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                        <h2 class="text-lg font-semibold text-slate-900">
                          No ads match your search
                        </h2>
                        <p class="mt-1 text-sm text-slate-600">
                          Try fewer filters, or different words.
                        </p>
                        <div class="mt-4 flex flex-wrap justify-center gap-2">
                          @if (filterCount() > 0) {
                            <button
                              type="button"
                              class="btn btn-secondary"
                              (click)="clearFilters()"
                            >
                              Clear filters
                            </button>
                          }
                          @if (hasKeyword()) {
                            <button
                              type="button"
                              class="btn btn-secondary"
                              (click)="clearKeyword()"
                            >
                              Clear the search words
                            </button>
                          }
                        </div>
                      </div>
                    } @else {
                      <ul
                        class="grid grid-cols-2 gap-3 transition-opacity sm:gap-4 xl:grid-cols-3"
                        [class.opacity-60]="status() === 'loading'"
                      >
                        @for (item of page.content; track item.id) {
                          <li><app-listing-card [listing]="item" [headingLevel]="2" /></li>
                        }
                      </ul>
                      <app-pager
                        class="mt-6"
                        [page]="page.page"
                        [totalPages]="page.totalPages"
                        (pageChange)="goToPage($event)"
                      />
                    }
                  }
                }
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class Search {
  private readonly listingApi = inject(ListingApi);
  private readonly locationApi = inject(LocationApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly categories = inject(CategoryStore);

  /** Route parameters of a category page: the slug of the category and of its subcategory. Absent on `/search`. */
  readonly slug = input<string>();
  readonly sub = input<string>();

  protected readonly conditions = CONDITION_OPTIONS;
  protected readonly postedOptions = POSTED_OPTIONS;
  protected readonly placeholders = [1, 2, 3, 4, 5, 6];

  protected readonly form = inject(NonNullableFormBuilder).group({
    categoryId: new FormControl<number | null>(null),
    subcategoryId: new FormControl<number | null>(null),
    minPrice: new FormControl<number | null>(null),
    maxPrice: new FormControl<number | null>(null),
    condition: new FormGroup({
      NEW: new FormControl(false, { nonNullable: true }),
      LIKE_NEW: new FormControl(false, { nonNullable: true }),
      GOOD: new FormControl(false, { nonNullable: true }),
      FAIR: new FormControl(false, { nonNullable: true }),
      FOR_PARTS: new FormControl(false, { nonNullable: true }),
    }),
    provinceId: new FormControl<number | null>(null),
    districtId: new FormControl<number | null>(null),
    municipalityId: new FormControl<number | null>(null),
    postedWithinDays: new FormControl<number | null>(null),
    negotiable: new FormControl(false, { nonNullable: true }),
    sort: new FormControl<ListingSort>('newest', { nonNullable: true }),
  });

  /** What the address says, parsed. */
  private readonly urlParams = toSignal(
    this.route.queryParamMap.pipe(map((params) => parseSearchParams(params))),
    {
      initialValue: parseSearchParams(this.route.snapshot.queryParamMap),
    },
  );

  protected readonly provinces = signal<readonly Province[]>([]);
  protected readonly districts = signal<readonly District[]>([]);
  protected readonly municipalities = signal<readonly Municipality[]>([]);
  private readonly selectedCategory = signal<number | null>(null);
  protected readonly filtersOpen = signal(false);

  /** The category the route fixes (a category page), resolved from the tree once it is loaded. */
  protected readonly scope = computed(() => {
    const slug = this.slug();
    const tree = this.categories.tree();
    const category = slug ? tree.find((candidate) => candidate.slug === slug) : undefined;
    const subcategory =
      category && this.sub()
        ? category.children.find((candidate) => candidate.slug === this.sub())
        : undefined;
    return { category, subcategory };
  });

  /** A category page for a category that does not exist (known only once the tree is loaded). */
  protected readonly scopeNotFound = computed(() => {
    if (!this.slug() || this.categories.status() !== 'ready') {
      return false;
    }
    const { category, subcategory } = this.scope();
    return !category || (!!this.sub() && !subcategory);
  });

  protected readonly subcategoryOptions = computed(
    () => this.categories.find(this.selectedCategory() ?? -1)?.children ?? [],
  );

  /** The search to run: the address, with the category of a category page applied. Null until that category is known. */
  private readonly effective = computed<SearchParams | null>(() => {
    const params = this.urlParams();
    if (!this.slug()) {
      return params;
    }
    const { category, subcategory } = this.scope();
    // Unknown category, or a subcategory that is not one of its children: the page says "not found", so no search is run either.
    if (!category || (this.sub() && !subcategory)) {
      return null;
    }
    return {
      ...params,
      categoryId: category.id,
      ...(subcategory ? { subcategoryId: subcategory.id } : { subcategoryId: undefined }),
    };
  });

  private readonly attempt = signal(0);
  protected readonly status = signal<Status>('loading');
  /** The page being shown; kept while the next one loads, so the results do not flash away on every filter change. */
  protected readonly results = signal<Page<ListingSummary> | null>(null);
  private readonly error = signal<ApiError | null>(null);
  protected readonly errorMessage = computed(() => this.error()?.message ?? '');

  protected readonly hasKeyword = computed(() => !!this.urlParams().q);
  protected readonly filterCount = computed(() => activeFilterCount(this.urlParams()));

  protected readonly heading = computed(() => {
    const { category, subcategory } = this.scope();
    const q = this.urlParams().q;
    if (subcategory) {
      return subcategory.name;
    }
    if (category) {
      return category.name;
    }
    return q ? `Results for “${q}”` : 'All ads';
  });

  protected readonly summary = computed(() => {
    const page = this.results();
    if (this.status() === 'error') {
      return '';
    }
    if (!page) {
      return 'Searching…';
    }
    const total = page.totalElements;
    return `${new Intl.NumberFormat('en-IN').format(total)} ${total === 1 ? 'ad' : 'ads'} found`;
  });

  protected readonly priceError = signal<string | null>(null);

  constructor() {
    this.categories.load();
    this.locationApi
      .provinces()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (list) => this.provinces.set(list), error: () => undefined });

    // address -> form (without sending the change back to the address)
    effect(() => {
      const params = this.urlParams();
      untracked(() => this.showInForm(params));
    });

    // form -> address, after the person stops changing things
    this.form.valueChanges
      .pipe(
        tap(() => this.validatePrices()),
        debounceTime(APPLY_AFTER_MS),
        filter(() => this.priceError() === null),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.writeToAddress());

    // the lists below the province and category follow their parent
    this.form.controls.provinceId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.form.controls.districtId.setValue(null, { emitEvent: false });
      this.form.controls.municipalityId.setValue(null, { emitEvent: false });
      this.municipalities.set([]);
      this.loadDistricts(id);
    });
    this.form.controls.districtId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.form.controls.municipalityId.setValue(null, { emitEvent: false });
      this.loadMunicipalities(id);
    });
    this.form.controls.categoryId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.form.controls.subcategoryId.setValue(null, { emitEvent: false });
      this.selectedCategory.set(id);
    });

    // run the search whenever the effective search changes
    toObservable(computed(() => ({ params: this.effective(), attempt: this.attempt() })))
      .pipe(
        filter(
          (request): request is { params: SearchParams; attempt: number } =>
            request.params !== null,
        ),
        tap(() => {
          this.status.set('loading');
          this.error.set(null);
        }),
        switchMap(({ params }) => this.run(params)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((outcome) => {
        if (outcome.kind === 'ready') {
          this.results.set(outcome.page);
          this.status.set('ready');
        } else {
          this.error.set(outcome.error);
          this.status.set('error');
        }
      });

    effect(() => this.title.setTitle(`${this.heading()} · ResaleMarket`));
  }

  protected retry(): void {
    this.attempt.update((count) => count + 1);
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams({ ...this.urlParams(), page }),
    });
  }

  protected clearFilters(): void {
    const { q, sort } = this.urlParams();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams({ ...(q ? { q } : {}), ...(sort ? { sort } : {}) }),
      replaceUrl: true,
    });
  }

  protected clearKeyword(): void {
    const { q: _removed, page: _page, ...rest } = this.urlParams();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(rest),
      replaceUrl: true,
    });
  }

  // --- the search ----------------------------------------------------------------------------------------------------------

  private run(
    params: SearchParams,
  ): Observable<
    { kind: 'ready'; page: Page<ListingSummary> } | { kind: 'error'; error: ApiError }
  > {
    return new Observable((subscriber) =>
      this.listingApi.search({ ...params, size: SEARCH_PAGE_SIZE }).subscribe({
        next: (page) => {
          subscriber.next({ kind: 'ready', page });
          subscriber.complete();
        },
        error: (error: unknown) => {
          subscriber.next({ kind: 'error', error: toApiError(error) });
          subscriber.complete();
        },
      }),
    );
  }

  // --- address <-> form ------------------------------------------------------------------------------------------------------

  /** Puts a search in the form without announcing it as a change (it came from the address). */
  private showInForm(params: SearchParams): void {
    const chosen = new Set(params.condition ?? []);
    this.form.patchValue(
      {
        categoryId: params.categoryId ?? null,
        subcategoryId: params.subcategoryId ?? null,
        minPrice: params.minPrice ?? null,
        maxPrice: params.maxPrice ?? null,
        condition: {
          NEW: chosen.has('NEW'),
          LIKE_NEW: chosen.has('LIKE_NEW'),
          GOOD: chosen.has('GOOD'),
          FAIR: chosen.has('FAIR'),
          FOR_PARTS: chosen.has('FOR_PARTS'),
        },
        provinceId: params.provinceId ?? null,
        districtId: params.districtId ?? null,
        municipalityId: params.municipalityId ?? null,
        postedWithinDays: params.postedWithinDays ?? null,
        negotiable: params.negotiable ?? false,
        sort: params.sort ?? (params.q ? 'relevance' : 'newest'),
      },
      { emitEvent: false },
    );
    this.selectedCategory.set(params.categoryId ?? null);
    this.priceError.set(null);
    this.loadDistricts(
      params.provinceId ?? null,
      params.districtId ?? undefined,
      params.municipalityId ?? undefined,
    );
  }

  /** Writes the form to the address as a new search starting at the first page. */
  private writeToAddress(): void {
    const value = this.form.getRawValue();
    const condition = (Object.entries(value.condition) as [ListingCondition, boolean][])
      .filter(([, on]) => on)
      .map(([name]) => name);
    const q = this.urlParams().q;
    const params: SearchParams = {
      ...(q ? { q } : {}),
      ...(value.categoryId !== null ? { categoryId: value.categoryId } : {}),
      ...(value.subcategoryId !== null ? { subcategoryId: value.subcategoryId } : {}),
      ...(value.minPrice !== null ? { minPrice: value.minPrice } : {}),
      ...(value.maxPrice !== null ? { maxPrice: value.maxPrice } : {}),
      ...(condition.length > 0 ? { condition } : {}),
      ...(value.provinceId !== null ? { provinceId: value.provinceId } : {}),
      ...(value.districtId !== null ? { districtId: value.districtId } : {}),
      ...(value.municipalityId !== null ? { municipalityId: value.municipalityId } : {}),
      ...(value.negotiable ? { negotiable: true } : {}),
      ...(value.postedWithinDays !== null ? { postedWithinDays: value.postedWithinDays } : {}),
      sort: value.sort,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(params),
      replaceUrl: true,
    });
  }

  private validatePrices(): void {
    const { minPrice, maxPrice } = this.form.getRawValue();
    if ((minPrice !== null && minPrice < 0) || (maxPrice !== null && maxPrice < 0)) {
      this.priceError.set('A price cannot be below 0.');
    } else if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      this.priceError.set('The lowest price is above the highest.');
    } else {
      this.priceError.set(null);
    }
  }

  // --- dependent lists -----------------------------------------------------------------------------------------------------

  /** The province whose districts, and the district whose cities, the lists below hold (or are being loaded for). */
  private districtsOf: number | null = null;
  private municipalitiesOf: number | null = null;

  /**
   * Fills the district list for a province, and selects a district (and city) when the address names one. Asked again for the same
   * province, as happens each time the page re-reads its own address, it does not ask the server again: it only re-selects.
   */
  private loadDistricts(
    provinceId: number | null,
    selectDistrict?: number,
    selectMunicipality?: number,
  ): void {
    if (provinceId === null) {
      this.districtsOf = null;
      this.municipalitiesOf = null;
      this.districts.set([]);
      this.municipalities.set([]);
      return;
    }
    if (provinceId === this.districtsOf) {
      if (selectDistrict !== undefined) {
        this.form.controls.districtId.setValue(selectDistrict, { emitEvent: false });
        this.loadMunicipalities(selectDistrict, selectMunicipality);
      }
      return;
    }
    this.districtsOf = provinceId;
    this.municipalitiesOf = null;
    this.locationApi.districts(provinceId).subscribe({
      next: (list) => {
        this.districts.set(list);
        if (selectDistrict !== undefined) {
          this.form.controls.districtId.setValue(selectDistrict, { emitEvent: false });
          this.loadMunicipalities(selectDistrict, selectMunicipality);
        }
      },
      error: () => {
        this.districtsOf = null;
        this.districts.set([]);
      },
    });
  }

  private loadMunicipalities(districtId: number | null, select?: number): void {
    if (districtId === null) {
      this.municipalitiesOf = null;
      this.municipalities.set([]);
      return;
    }
    if (districtId === this.municipalitiesOf) {
      if (select !== undefined) {
        this.form.controls.municipalityId.setValue(select, { emitEvent: false });
      }
      return;
    }
    this.municipalitiesOf = districtId;
    this.locationApi.municipalities(districtId).subscribe({
      next: (list) => {
        this.municipalities.set(list);
        if (select !== undefined) {
          this.form.controls.municipalityId.setValue(select, { emitEvent: false });
        }
      },
      error: () => {
        this.municipalitiesOf = null;
        this.municipalities.set([]);
      },
    });
  }
}
