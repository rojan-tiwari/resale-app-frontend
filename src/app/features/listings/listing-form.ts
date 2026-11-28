import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, concatMap, forkJoin, from, of, switchMap, tap, toArray } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { ApiError, toApiError } from '../../core/models/api-error';
import { Category } from '../../core/models/category';
import {
  Listing,
  ListingCondition,
  ListingImage,
  ListingRequest,
  ListingStatus,
  MAX_LISTING_IMAGES,
  PriceType,
} from '../../core/models/listing';
import { District, Municipality, Province } from '../../core/models/location';
import { Toasts } from '../../core/notifications/toasts';
import { CategoryApi } from '../../core/services/category-api';
import { ListingApi } from '../../core/services/listing-api';
import { LocationApi } from '../../core/services/location-api';
import { FormSupport } from '../../shared/forms/form-support';
import { CONDITION_OPTIONS, isEditable, isLive } from '../../shared/listing/listing-labels';
import { maxDecimals, trimmedLength } from '../../shared/validators/form-validators';
import { ListingPhotos, PhotoMove } from './listing-photos';
import { PhotoItem, selectPhotos } from './photo-selection';

type FieldName =
  | 'title'
  | 'description'
  | 'price'
  | 'priceType'
  | 'condition'
  | 'categoryId'
  | 'subcategoryId'
  | 'provinceId'
  | 'districtId'
  | 'municipalityId'
  | 'locality';

/** Which part of saving is running, so a failure is shown where the person can fix it. */
type Step = 'content' | 'photos' | 'publish';

type LoadState = 'loading' | 'ready' | 'error' | 'blocked';

/** The database column holds 12 digits with 2 decimals. */
const MAX_PRICE = 9_999_999_999.99;

/**
 * Post an ad (`/listings/new`) and edit one (`/listings/:id/edit`): the details, the place, and the photos with previews.
 *
 * <p>Nothing is sent while the person is still choosing. "Save draft" and "Publish" run one chain: save the details (creating
 * the ad on the first save), remove the photos that were taken out, upload the new ones, put them in the chosen order and, for
 * "Publish", move the ad to live (or to review, when the marketplace requires it). Photos can only be uploaded to an ad that
 * exists, which is why a new ad is created first. If a later step fails the ad already exists as a draft, the chosen photos
 * stay on screen, and the next click carries on from where it stopped instead of creating a second ad.
 */
@Component({
  selector: 'app-listing-form',
  imports: [ReactiveFormsModule, RouterLink, ListingPhotos],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-3xl">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {{ isEditing() ? 'Edit your ad' : 'Post an ad' }}
        </h1>

        @switch (state()) {
          @case ('loading') {
            <div
              class="card mt-6 space-y-5 p-6 sm:p-8"
              aria-busy="true"
              aria-label="Loading the form"
            >
              <div class="skeleton h-5 w-40"></div>
              <div class="skeleton h-10 w-full"></div>
              <div class="skeleton h-5 w-32"></div>
              <div class="skeleton h-24 w-full"></div>
              <div class="skeleton h-10 w-full"></div>
            </div>
          }
          @case ('error') {
            <div class="card mt-6 p-6 sm:p-8" role="alert">
              <h2 class="text-lg font-semibold text-slate-900">The form could not be loaded</h2>
              <p class="mt-2 text-sm text-slate-600">{{ loadError() }}</p>
              <button type="button" class="btn btn-primary mt-4" (click)="load()">Try again</button>
            </div>
          }
          @case ('blocked') {
            <div class="card mt-6 p-6 sm:p-8" role="alert">
              <h2 class="text-lg font-semibold text-slate-900">
                This ad cannot be edited right now
              </h2>
              <p class="mt-2 text-sm text-slate-700">{{ blockedReason() }}</p>
              @if (id(); as adId) {
                <a [routerLink]="['/listings', adId]" class="btn btn-primary mt-4">Go to the ad</a>
              }
            </div>
          }
          @case ('ready') {
            <form
              class="card mt-6 space-y-6 p-6 sm:p-8"
              [formGroup]="form"
              (ngSubmit)="submit('save')"
              novalidate
            >
              @if (saveError(); as message) {
                <div
                  class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
                  role="alert"
                >
                  {{ message }}
                </div>
              }

              <div>
                <label class="field-label" for="listing-title">Title</label>
                @let titleError = support.errorOf('title');
                <input
                  id="listing-title"
                  type="text"
                  class="field-input"
                  formControlName="title"
                  maxlength="200"
                  placeholder="e.g. iPhone 13, 128 GB, with box"
                  aria-required="true"
                  aria-describedby="listing-title-hint listing-title-error"
                  [attr.aria-invalid]="titleError ? 'true' : null"
                />
                <p id="listing-title-hint" class="mt-1.5 text-sm text-slate-600">
                  What it is, in a few words. 3 to 150 characters.
                </p>
                <p id="listing-title-error" class="field-error" [hidden]="!titleError">
                  {{ titleError }}
                </p>
              </div>

              <div class="grid gap-6 sm:grid-cols-2">
                <div>
                  <label class="field-label" for="listing-categoryId">Category</label>
                  @let categoryError = support.errorOf('categoryId');
                  <select
                    id="listing-categoryId"
                    class="field-input"
                    formControlName="categoryId"
                    aria-required="true"
                    aria-describedby="listing-categoryId-error"
                    [attr.aria-invalid]="categoryError ? 'true' : null"
                  >
                    <option [ngValue]="null">Choose a category</option>
                    @for (category of categories(); track category.id) {
                      <option [ngValue]="category.id">{{ category.name }}</option>
                    }
                  </select>
                  <p id="listing-categoryId-error" class="field-error" [hidden]="!categoryError">
                    {{ categoryError }}
                  </p>
                </div>

                <div>
                  <label class="field-label" for="listing-subcategoryId">Subcategory</label>
                  @let subcategoryError = support.errorOf('subcategoryId');
                  <select
                    id="listing-subcategoryId"
                    class="field-input"
                    formControlName="subcategoryId"
                    aria-describedby="listing-subcategoryId-error"
                    [attr.aria-invalid]="subcategoryError ? 'true' : null"
                  >
                    <option [ngValue]="null">
                      {{
                        subcategories().length > 0
                          ? 'Choose a subcategory'
                          : 'Choose a category first'
                      }}
                    </option>
                    @for (subcategory of subcategories(); track subcategory.id) {
                      <option [ngValue]="subcategory.id">{{ subcategory.name }}</option>
                    }
                  </select>
                  <p
                    id="listing-subcategoryId-error"
                    class="field-error"
                    [hidden]="!subcategoryError"
                  >
                    {{ subcategoryError }}
                  </p>
                </div>
              </div>

              <div class="grid gap-6 sm:grid-cols-2">
                <div>
                  <label class="field-label" for="listing-condition">Condition</label>
                  @let conditionError = support.errorOf('condition');
                  <select
                    id="listing-condition"
                    class="field-input"
                    formControlName="condition"
                    aria-required="true"
                    aria-describedby="listing-condition-error"
                    [attr.aria-invalid]="conditionError ? 'true' : null"
                  >
                    <option [ngValue]="null">Choose the condition</option>
                    @for (option of conditions; track option.value) {
                      <option [ngValue]="option.value">{{ option.label }}</option>
                    }
                  </select>
                  <p id="listing-condition-error" class="field-error" [hidden]="!conditionError">
                    {{ conditionError }}
                  </p>
                </div>

                <div>
                  <label class="field-label" for="listing-price">Price (Rs.)</label>
                  @let priceError = support.errorOf('price');
                  <input
                    id="listing-price"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.01"
                    class="field-input"
                    formControlName="price"
                    placeholder="0"
                    aria-required="true"
                    aria-describedby="listing-price-hint listing-price-error"
                    [attr.aria-invalid]="priceError ? 'true' : null"
                  />
                  <p id="listing-price-hint" class="mt-1.5 text-sm text-slate-600">
                    In Nepali rupees. Enter 0 if it is free.
                  </p>
                  <p id="listing-price-error" class="field-error" [hidden]="!priceError">
                    {{ priceError }}
                  </p>
                </div>
              </div>

              <fieldset>
                <legend class="field-label">Is the price negotiable?</legend>
                <div class="flex flex-wrap gap-x-6 gap-y-2">
                  <label class="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      class="size-5 accent-brand-600"
                      formControlName="priceType"
                      value="FIXED"
                    />
                    Fixed price
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      class="size-5 accent-brand-600"
                      formControlName="priceType"
                      value="NEGOTIABLE"
                    />
                    Negotiable
                  </label>
                </div>
              </fieldset>

              <div>
                <label class="field-label" for="listing-description">Description</label>
                @let descriptionError = support.errorOf('description');
                <textarea
                  id="listing-description"
                  rows="6"
                  class="field-input"
                  formControlName="description"
                  aria-required="true"
                  aria-describedby="listing-description-count listing-description-error"
                  [attr.aria-invalid]="descriptionError ? 'true' : null"
                ></textarea>
                <p id="listing-description-count" class="mt-1.5 text-sm text-slate-600">
                  Age, what is included, any faults. {{ descriptionLength() }} of 5000 characters
                  (at least 10).
                </p>
                <p id="listing-description-error" class="field-error" [hidden]="!descriptionError">
                  {{ descriptionError }}
                </p>
              </div>

              <fieldset class="space-y-4">
                <legend class="field-label">Where the item is</legend>
                @if (locationError(); as message) {
                  <p class="text-sm text-red-700" role="alert">{{ message }}</p>
                }
                <div class="grid gap-6 sm:grid-cols-3">
                  <div>
                    <label class="field-label" for="listing-provinceId">Province</label>
                    @let provinceError = support.errorOf('provinceId');
                    <select
                      id="listing-provinceId"
                      class="field-input"
                      formControlName="provinceId"
                      aria-required="true"
                      aria-describedby="listing-provinceId-error"
                      [attr.aria-invalid]="provinceError ? 'true' : null"
                    >
                      <option [ngValue]="null">Choose a province</option>
                      @for (province of provinces(); track province.id) {
                        <option [ngValue]="province.id">{{ province.name }}</option>
                      }
                    </select>
                    <p id="listing-provinceId-error" class="field-error" [hidden]="!provinceError">
                      {{ provinceError }}
                    </p>
                  </div>
                  <div>
                    <label class="field-label" for="listing-districtId">District</label>
                    @let districtError = support.errorOf('districtId');
                    <select
                      id="listing-districtId"
                      class="field-input"
                      formControlName="districtId"
                      aria-required="true"
                      aria-describedby="listing-districtId-error"
                      [attr.aria-invalid]="districtError ? 'true' : null"
                    >
                      <option [ngValue]="null">Choose a district</option>
                      @for (district of districts(); track district.id) {
                        <option [ngValue]="district.id">{{ district.name }}</option>
                      }
                    </select>
                    <p id="listing-districtId-error" class="field-error" [hidden]="!districtError">
                      {{ districtError }}
                    </p>
                  </div>
                  <div>
                    <label class="field-label" for="listing-municipalityId"
                      >City or municipality
                      <span class="font-normal text-slate-600">(optional)</span></label
                    >
                    @let municipalityError = support.errorOf('municipalityId');
                    <select
                      id="listing-municipalityId"
                      class="field-input"
                      formControlName="municipalityId"
                      aria-describedby="listing-municipalityId-error"
                      [attr.aria-invalid]="municipalityError ? 'true' : null"
                    >
                      <option [ngValue]="null">Not set</option>
                      @for (municipality of municipalities(); track municipality.id) {
                        <option [ngValue]="municipality.id">{{ municipality.name }}</option>
                      }
                    </select>
                    <p
                      id="listing-municipalityId-error"
                      class="field-error"
                      [hidden]="!municipalityError"
                    >
                      {{ municipalityError }}
                    </p>
                  </div>
                </div>
                <div>
                  <label class="field-label" for="listing-locality"
                    >Area or tole <span class="font-normal text-slate-600">(optional)</span></label
                  >
                  @let localityError = support.errorOf('locality');
                  <input
                    id="listing-locality"
                    type="text"
                    class="field-input"
                    formControlName="locality"
                    placeholder="e.g. Baneshwor"
                    aria-describedby="listing-locality-error"
                    [attr.aria-invalid]="localityError ? 'true' : null"
                  />
                  <p id="listing-locality-error" class="field-error" [hidden]="!localityError">
                    {{ localityError }}
                  </p>
                </div>
              </fieldset>

              <app-listing-photos
                [items]="photos()"
                [problems]="photoProblems()"
                [error]="photoError()"
                [disabled]="saving()"
                (add)="addPhotos($event)"
                (move)="movePhoto($event)"
                (remove)="removePhoto($event)"
              />

              <div class="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
                @if (isLiveAd()) {
                  <button type="submit" class="btn btn-primary" [disabled]="saving()">
                    {{ saving() ? 'Saving…' : 'Save changes' }}
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="saving()"
                    (click)="submit('publish')"
                  >
                    {{ saving() && action() === 'publish' ? 'Publishing…' : publishLabel() }}
                  </button>
                  <button type="submit" class="btn btn-secondary" [disabled]="saving()">
                    {{ saving() && action() === 'save' ? 'Saving…' : 'Save draft' }}
                  </button>
                }
                <a [routerLink]="cancelLink()" class="btn btn-ghost">Cancel</a>
              </div>
            </form>
          }
        }
      </div>
    </section>
  `,
})
export class ListingForm implements OnInit {
  private readonly listingApi = inject(ListingApi);
  private readonly categoryApi = inject(CategoryApi);
  private readonly locationApi = inject(LocationApi);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Bound from the `:id` route parameter; absent when posting a new ad. */
  readonly id = input<string>();

  protected readonly conditions = CONDITION_OPTIONS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, trimmedLength(3, 150)]],
    description: ['', [Validators.required, trimmedLength(10, 5000)]],
    price: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(MAX_PRICE),
      maxDecimals(2),
    ]),
    priceType: ['FIXED' as PriceType],
    condition: new FormControl<ListingCondition | null>(null, Validators.required),
    categoryId: new FormControl<number | null>(null, Validators.required),
    subcategoryId: new FormControl<number | null>(
      { value: null, disabled: true },
      Validators.required,
    ),
    provinceId: new FormControl<number | null>(null, Validators.required),
    districtId: new FormControl<number | null>(
      { value: null, disabled: true },
      Validators.required,
    ),
    municipalityId: new FormControl<number | null>({ value: null, disabled: true }),
    locality: ['', [Validators.maxLength(120)]],
  });

  protected readonly support = new FormSupport<FieldName>(this.form, {
    idPrefix: 'listing',
    host: inject<ElementRef<HTMLElement>>(ElementRef),
    order: [
      'title',
      'categoryId',
      'subcategoryId',
      'condition',
      'price',
      'priceType',
      'description',
      'provinceId',
      'districtId',
      'municipalityId',
      'locality',
    ],
    requiredMessages: {
      title: 'Enter a title for your ad.',
      description: 'Describe what you are selling.',
      price: 'Enter a price. Enter 0 if it is free.',
      condition: 'Choose the condition of the item.',
      categoryId: 'Choose a category.',
      subcategoryId: 'Choose a subcategory.',
      provinceId: 'Choose the province.',
      districtId: 'Choose the district.',
    },
  });

  protected readonly state = signal<LoadState>('loading');
  protected readonly loadError = signal<string | null>(null);
  protected readonly blockedReason = signal('');

  /** The ad as last loaded or saved; null until it exists. */
  protected readonly listing = signal<Listing | null>(null);
  /** Set at the first save, so a retry updates this ad instead of creating another one. */
  private readonly listingId = signal<string | null>(null);

  protected readonly categories = signal<readonly Category[]>([]);
  private readonly selectedCategory = signal<number | null>(null);
  protected readonly subcategories = computed(
    () =>
      this.categories().find((category) => category.id === this.selectedCategory())?.children ?? [],
  );
  protected readonly provinces = signal<readonly Province[]>([]);
  protected readonly districts = signal<readonly District[]>([]);
  protected readonly municipalities = signal<readonly Municipality[]>([]);
  protected readonly locationError = signal<string | null>(null);
  protected readonly descriptionLength = signal(0);

  /** The photos on screen, in the order the seller wants them. */
  protected readonly photos = signal<readonly PhotoItem[]>([]);
  /** Photos already on the server that the seller took out; they are deleted when the ad is saved. */
  private readonly removedImages = signal<readonly ListingImage[]>([]);
  /** The gallery as the server last reported it. */
  private readonly serverGallery = signal<readonly ListingImage[]>([]);
  protected readonly photoProblems = signal<readonly string[]>([]);
  protected readonly photoError = signal<string | null>(null);

  protected readonly saving = signal(false);
  protected readonly action = signal<'save' | 'publish' | null>(null);
  protected readonly saveError = signal<string | null>(null);
  private step: Step = 'content';

  protected readonly isEditing = computed(() => this.id() !== undefined);
  /** A live ad has one "Save changes" button; a new ad or a draft can be saved as a draft or published. */
  protected readonly isLiveAd = computed(() => {
    const status = this.listing()?.status;
    return status !== undefined && isLive(status);
  });
  protected readonly publishLabel = computed(() => {
    const allowed = this.listing()?.allowedStatuses ?? [];
    return allowed.includes('PENDING_REVIEW') && !allowed.includes('ACTIVE')
      ? 'Submit for review'
      : 'Publish ad';
  });
  protected readonly cancelLink = computed(() => {
    const id = this.listingId() ?? this.id();
    return id ? ['/listings', id] : ['/listings', 'mine'];
  });

  constructor() {
    const { categoryId, description, provinceId, districtId } = this.form.controls;

    description.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((text) => this.descriptionLength.set(text.length));
    categoryId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncCategory(true));

    // Choosing a province empties the lists below it and loads its districts; choosing a district does the same for municipalities.
    provinceId.valueChanges
      .pipe(
        tap(() => {
          districtId.setValue(null, { emitEvent: false });
          this.form.controls.municipalityId.setValue(null, { emitEvent: false });
          this.municipalities.set([]);
          this.syncLocationControls();
        }),
        switchMap((id) => this.districtsOf(id)),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.districts.set(list));
    districtId.valueChanges
      .pipe(
        tap(() => {
          this.form.controls.municipalityId.setValue(null, { emitEvent: false });
          this.syncLocationControls();
        }),
        switchMap((id) => this.municipalitiesOf(id)),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.municipalities.set(list));

    // Preview pictures are object URLs: give the memory back when the page goes away.
    this.destroyRef.onDestroy(() => this.photos().forEach((item) => this.release(item)));
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.loadError.set(null);
    const id = this.id();
    forkJoin({
      categories: this.categoryApi.tree(),
      provinces: this.locationApi.provinces(),
      listing: id === undefined ? of(null) : this.listingApi.get(id),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, provinces, listing }) => {
          this.categories.set(categories);
          this.provinces.set(provinces);
          if (listing === null) {
            this.state.set('ready');
            return;
          }
          this.open(listing);
        },
        error: (error: unknown) => {
          this.loadError.set(toApiError(error).message);
          this.state.set('error');
        },
      });
  }

  // --- photos --------------------------------------------------------------------------------------------------------

  protected addPhotos(files: readonly File[]): void {
    const room = MAX_LISTING_IMAGES - this.photos().length;
    const { accepted, problems } = selectPhotos(files, room);
    this.photoProblems.set(problems);
    this.photoError.set(null);
    const added: PhotoItem[] = accepted.map((file) => ({
      kind: 'pending',
      key: `new-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    this.photos.update((list) => [...list, ...added]);
  }

  protected movePhoto({ from, to }: PhotoMove): void {
    const list = [...this.photos()];
    if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) {
      return;
    }
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved as PhotoItem);
    this.photos.set(list);
    this.photoProblems.set([]);
  }

  protected removePhoto(index: number): void {
    const item = this.photos()[index];
    if (item === undefined) {
      return;
    }
    if (item.kind === 'saved') {
      this.removedImages.update((list) => [...list, item.image]);
    } else {
      this.release(item);
    }
    this.photos.update((list) => list.filter((_, position) => position !== index));
    this.photoProblems.set([]);
    this.photoError.set(null);
  }

  // --- saving --------------------------------------------------------------------------------------------------------

  protected submit(action: 'save' | 'publish'): void {
    if (this.saving() || !this.support.attempt()) {
      return;
    }
    if (action === 'publish' && this.photos().length === 0) {
      this.photoError.set(
        'Add at least one photo to publish your ad. You can also save it as a draft and add photos later.',
      );
      this.focusPhotoInput();
      return;
    }

    this.saving.set(true);
    this.action.set(action);
    this.saveError.set(null);
    this.photoError.set(null);
    this.photoProblems.set([]);

    this.persist(action === 'publish')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (listing) => {
          this.saving.set(false);
          this.action.set(null);
          this.toasts.success(this.successMessage(action, listing));
          void this.router.navigate(['/listings', listing.id]);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.action.set(null);
          this.showFailure(toApiError(error));
        },
      });
  }

  private persist(publish: boolean): Observable<Listing> {
    return this.saveContent().pipe(
      switchMap((listing) => this.syncPhotos(listing)),
      switchMap((listing) => (publish ? this.publish(listing) : of(listing))),
    );
  }

  private saveContent(): Observable<Listing> {
    this.step = 'content';
    const request = this.buildRequest();
    const id = this.listingId();
    const call =
      id === null ? this.listingApi.create(request) : this.listingApi.update(id, request);
    return call.pipe(
      tap((listing) => {
        this.listingId.set(listing.id);
        this.listing.set(listing);
      }),
    );
  }

  /**
   * Brings the server's photos in line with the screen. A live ad must never be left without a photo, so when every saved photo
   * is being replaced the new ones go up first; otherwise the removals come first, which frees room under the limit of 8.
   */
  private syncPhotos(listing: Listing): Observable<Listing> {
    this.step = 'photos';
    const id = listing.id;
    const keptSaved = this.photos().filter((item) => item.kind === 'saved').length;
    const hasPending = this.photos().some((item) => item.kind === 'pending');
    const uploadFirst = isLive(listing.status) && keptSaved === 0 && hasPending;
    const stages = uploadFirst
      ? [() => this.uploadPending(id), () => this.removeMarked(id), () => this.applyOrder(id)]
      : [() => this.removeMarked(id), () => this.uploadPending(id), () => this.applyOrder(id)];
    return stages
      .reduce<Observable<unknown>>((chain, stage) => chain.pipe(switchMap(stage)), of(null))
      .pipe(switchMap(() => of(listing)));
  }

  private removeMarked(id: string): Observable<unknown> {
    const removed = this.removedImages();
    if (removed.length === 0) {
      return of(null);
    }
    return from(removed).pipe(
      concatMap((image) =>
        this.listingApi.deleteImage(id, image.id).pipe(
          tap((gallery) => {
            this.serverGallery.set(gallery);
            this.removedImages.update((list) => list.filter((other) => other.id !== image.id));
          }),
        ),
      ),
      toArray(),
    );
  }

  private uploadPending(id: string): Observable<unknown> {
    const pending = this.photos().filter((item) => item.kind === 'pending');
    if (pending.length === 0) {
      return of(null);
    }
    const known = new Set(this.serverGallery().map((image) => image.id));
    return this.listingApi
      .uploadImages(
        id,
        pending.map((item) => item.file),
      )
      .pipe(
        tap((gallery) => {
          this.serverGallery.set(gallery);
          // The server appends the files in the order of the request: the photos it did not have before are ours.
          const fresh = gallery.filter((image) => !known.has(image.id));
          const uploaded = new Map<string, ListingImage>();
          pending.forEach((item, position) => {
            const image = fresh[position];
            if (image !== undefined) {
              uploaded.set(item.key, image);
            }
          });
          this.photos.update((list) =>
            list.map((item): PhotoItem => {
              const image = item.kind === 'pending' ? uploaded.get(item.key) : undefined;
              if (item.kind === 'pending' && image !== undefined) {
                this.release(item);
                return { kind: 'saved', key: image.id, image };
              }
              return item;
            }),
          );
        }),
      );
  }

  private applyOrder(id: string): Observable<unknown> {
    const wanted = this.photos().flatMap((item) => (item.kind === 'saved' ? [item.key] : []));
    const current = this.serverGallery().map((image) => image.id);
    const same =
      wanted.length === current.length &&
      wanted.every((key, position) => key === current[position]);
    if (wanted.length === 0 || same) {
      return of(null);
    }
    return this.listingApi
      .reorderImages(id, wanted)
      .pipe(tap((gallery) => this.serverGallery.set(gallery)));
  }

  private publish(listing: Listing): Observable<Listing> {
    this.step = 'publish';
    const target: ListingStatus = listing.allowedStatuses.includes('ACTIVE')
      ? 'ACTIVE'
      : 'PENDING_REVIEW';
    return this.listingApi
      .changeStatus(listing.id, { status: target, reason: null })
      .pipe(tap((published) => this.listing.set(published)));
  }

  private successMessage(action: 'save' | 'publish', listing: Listing): string {
    if (action === 'publish') {
      return listing.status === 'PENDING_REVIEW'
        ? 'Your ad was sent for review. It goes live once it is approved.'
        : 'Your ad is live.';
    }
    return isLive(listing.status) ? 'Your changes were saved.' : 'Your draft was saved.';
  }

  /** Puts a failure where the person can act on it, and says what already happened when only part of the save went through. */
  private showFailure(error: ApiError): void {
    if (this.step === 'content') {
      if (!this.support.showServerErrors(error)) {
        this.saveError.set(error.message);
      }
      return;
    }
    const partial =
      this.listingId() !== null
        ? 'Your ad was saved as a draft, but not everything went through. Fix the problem below and save again; nothing you chose is lost.'
        : null;
    if (this.step === 'photos') {
      this.photoError.set(
        error.fieldMessage('images') ?? error.fieldMessage('imageIds') ?? error.message,
      );
      this.saveError.set(partial);
      this.focusPhotoInput();
    } else {
      this.saveError.set(`${error.message}${partial ? ` ${partial}` : ''}`);
    }
  }

  /**
   * Moves focus to the photo picker. It waits for the next render: while an ad is being saved the photos are disabled, and a
   * disabled control cannot take focus, so asking right away would silently do nothing.
   */
  private focusPhotoInput(): void {
    afterNextRender(() => document.getElementById('listing-photo-input')?.focus(), {
      injector: this.injector,
    });
  }

  private buildRequest(): ListingRequest {
    const value = this.form.getRawValue();
    return {
      title: value.title.trim(),
      description: value.description.trim(),
      price: value.price ?? 0,
      priceType: value.priceType,
      condition: value.condition as ListingCondition,
      categoryId: value.categoryId as number,
      subcategoryId: value.subcategoryId,
      provinceId: value.provinceId as number,
      districtId: value.districtId as number,
      municipalityId: value.municipalityId,
      locality: value.locality.trim() || null,
    };
  }

  // --- loading an existing ad ------------------------------------------------------------------------------------------

  /** Shows an existing ad in the form, or explains why it cannot be edited by this person now. */
  private open(listing: Listing): void {
    const me = this.session.user();
    if (me === null || listing.seller.id !== me.id) {
      this.blockedReason.set('Only the person who posted an ad can edit it.');
      this.state.set('blocked');
      return;
    }
    if (!isEditable(listing.status)) {
      this.blockedReason.set(
        listing.allowedStatuses.includes('DRAFT')
          ? 'Move it back to a draft first (on the ad page), then you can change it.'
          : 'An ad in this state cannot be changed.',
      );
      this.state.set('blocked');
      return;
    }
    this.listing.set(listing);
    this.listingId.set(listing.id);
    this.serverGallery.set(listing.images);
    this.photos.set(
      listing.images.map((image): PhotoItem => ({ kind: 'saved', key: image.id, image })),
    );
    this.populate(listing);
    this.state.set('ready');
  }

  private populate(listing: Listing): void {
    this.form.reset(
      {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        priceType: listing.priceType,
        condition: listing.condition,
        categoryId: listing.category.id,
        subcategoryId: listing.subcategory?.id ?? null,
        provinceId: listing.provinceId,
        districtId: listing.districtId,
        municipalityId: listing.municipalityId,
        locality: listing.locality ?? '',
      },
      { emitEvent: false },
    );
    this.descriptionLength.set(listing.description.length);
    this.syncCategory(false);
    this.syncLocationControls();
    this.districtsOf(listing.provinceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.districts.set(list));
    this.municipalitiesOf(listing.districtId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.municipalities.set(list));
  }

  // --- the dependent pickers -----------------------------------------------------------------------------------------

  /** A subcategory can be chosen once there is a category with subcategories; changing the category clears it. */
  private syncCategory(clear: boolean): void {
    const { categoryId, subcategoryId } = this.form.controls;
    this.selectedCategory.set(categoryId.value);
    if (clear) {
      subcategoryId.setValue(null, { emitEvent: false });
    }
    if (this.subcategories().length > 0) {
      subcategoryId.enable({ emitEvent: false });
    } else {
      subcategoryId.setValue(null, { emitEvent: false });
      subcategoryId.disable({ emitEvent: false });
    }
  }

  /** A district can only be chosen after a province, and a municipality after a district. */
  private syncLocationControls(): void {
    const { provinceId, districtId, municipalityId } = this.form.controls;
    if (provinceId.value === null) {
      districtId.disable({ emitEvent: false });
    } else {
      districtId.enable({ emitEvent: false });
    }
    if (districtId.value === null || provinceId.value === null) {
      municipalityId.disable({ emitEvent: false });
    } else {
      municipalityId.enable({ emitEvent: false });
    }
  }

  private districtsOf(provinceId: number | null): Observable<readonly District[]> {
    if (provinceId === null) {
      return of([]);
    }
    return this.locationApi.districts(provinceId).pipe(this.keepGoingIfListFails('districts'));
  }

  private municipalitiesOf(districtId: number | null): Observable<readonly Municipality[]> {
    if (districtId === null) {
      return of([]);
    }
    return this.locationApi
      .municipalities(districtId)
      .pipe(this.keepGoingIfListFails('cities and municipalities'));
  }

  /** A list that cannot be loaded must not break the form: say so, show an empty list, and let the person choose the parent again. */
  private keepGoingIfListFails<T>(what: string) {
    return (source: Observable<T[]>): Observable<readonly T[]> =>
      new Observable<readonly T[]>((subscriber) =>
        source.subscribe({
          next: (value) => subscriber.next(value),
          error: () => {
            this.locationError.set(
              `The list of ${what} could not be loaded. Choose the province again to retry.`,
            );
            subscriber.next([]);
            subscriber.complete();
          },
          complete: () => subscriber.complete(),
        }),
      );
  }

  private release(item: PhotoItem): void {
    if (item.kind === 'pending') {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}
