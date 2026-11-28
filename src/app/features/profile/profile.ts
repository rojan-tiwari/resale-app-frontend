import { Component, DestroyRef, ElementRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { toApiError } from '../../core/models/api-error';
import { District, Municipality, Province } from '../../core/models/location';
import { UpdateProfileRequest, User } from '../../core/models/user';
import { Toasts } from '../../core/notifications/toasts';
import { LocationApi } from '../../core/services/location-api';
import { UserApi } from '../../core/services/user-api';
import { FormSupport } from '../../shared/forms/form-support';
import { NepalDatePipe } from '../../shared/pipes/nepal-date-pipe';
import { nepalMobile, trimmedLength } from '../../shared/validators/form-validators';
import { ProfileNav } from './profile-nav';

type FieldName =
  'displayName' | 'phone' | 'showPhone' | 'bio' | 'provinceId' | 'districtId' | 'municipalityId';

const BIO_MAX_LENGTH = 500;

/** A Nepali number is edited without the country code, as it was typed at registration; the server stores `+977...`. */
function nationalNumber(phone: string | null): string {
  return phone?.replace(/^\+977/, '') ?? '';
}

/**
 * The signed-in person's profile: name, phone (and whether to show it), a few words about them and where they are.
 * Loads the account fresh from the server, saves the whole form at once, and shows the new name in the header right away.
 * The place is chosen province -> district -> municipality; each list loads when its parent is chosen.
 */
@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink, ProfileNav, NepalDatePipe],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-xl">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your account</h1>
        <app-profile-nav class="mt-4" />

        @switch (status()) {
          @case ('loading') {
            <div
              class="card mt-6 space-y-5 p-6 sm:p-8"
              aria-busy="true"
              aria-label="Loading your profile"
            >
              <div class="skeleton h-5 w-40"></div>
              <div class="skeleton h-10 w-full"></div>
              <div class="skeleton h-5 w-32"></div>
              <div class="skeleton h-10 w-full"></div>
              <div class="skeleton h-24 w-full"></div>
            </div>
          }
          @case ('error') {
            <div class="card mt-6 p-6 sm:p-8" role="alert">
              <h2 class="text-lg font-semibold text-slate-900">Your profile could not be loaded</h2>
              <p class="mt-2 text-sm text-slate-600">{{ loadError() }}</p>
              <button type="button" class="btn btn-primary mt-4" (click)="load()">Try again</button>
            </div>
          }
          @case ('ready') {
            <form
              class="card mt-6 space-y-5 p-6 sm:p-8"
              [formGroup]="form"
              (ngSubmit)="save()"
              novalidate
            >
              @if (account(); as me) {
                <div class="text-sm text-slate-600">
                  <p>
                    Signed in as
                    <strong class="font-semibold break-all text-slate-900">{{ me.email }}</strong>
                  </p>
                  <p class="mt-1">
                    Member since {{ me.createdAt | nepalDate }} ·
                    <a
                      [routerLink]="['/users', me.id]"
                      class="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                    >
                      See how others see your profile
                    </a>
                  </p>
                </div>
              }

              @if (saveError(); as message) {
                <div
                  class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
                  role="alert"
                >
                  {{ message }}
                </div>
              }

              <div>
                <label class="field-label" for="profile-displayName">Display name</label>
                @let nameError = support.errorOf('displayName');
                <input
                  id="profile-displayName"
                  type="text"
                  class="field-input"
                  formControlName="displayName"
                  autocomplete="name"
                  aria-required="true"
                  aria-describedby="profile-displayName-hint profile-displayName-error"
                  [attr.aria-invalid]="nameError ? 'true' : null"
                />
                <p id="profile-displayName-hint" class="mt-1.5 text-sm text-slate-600">
                  Shown on your ads and messages.
                </p>
                <p id="profile-displayName-error" class="field-error" [hidden]="!nameError">
                  {{ nameError }}
                </p>
              </div>

              <div>
                <label class="field-label" for="profile-phone"
                  >Mobile number <span class="font-normal text-slate-600">(optional)</span></label
                >
                @let phoneError = support.errorOf('phone');
                <input
                  id="profile-phone"
                  type="tel"
                  inputmode="numeric"
                  class="field-input"
                  formControlName="phone"
                  autocomplete="tel-national"
                  placeholder="9812345678"
                  aria-describedby="profile-phone-error"
                  [attr.aria-invalid]="phoneError ? 'true' : null"
                />
                <p id="profile-phone-error" class="field-error" [hidden]="!phoneError">
                  {{ phoneError }}
                </p>

                <div class="mt-3 flex items-start gap-3">
                  <input
                    id="profile-showPhone"
                    type="checkbox"
                    class="mt-0.5 size-5 shrink-0 accent-brand-600"
                    formControlName="showPhone"
                    aria-describedby="profile-showPhone-hint profile-showPhone-error"
                  />
                  <div>
                    <label class="text-sm font-medium text-slate-800" for="profile-showPhone">
                      Show my number on my public profile
                    </label>
                    @let showPhoneError = support.errorOf('showPhone');
                    <p id="profile-showPhone-hint" class="text-sm text-slate-600">
                      Off by default. Without it nobody else sees your number. You need a number to
                      turn it on.
                    </p>
                    <p id="profile-showPhone-error" class="field-error" [hidden]="!showPhoneError">
                      {{ showPhoneError }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label class="field-label" for="profile-bio"
                  >About you <span class="font-normal text-slate-600">(optional)</span></label
                >
                @let bioError = support.errorOf('bio');
                <textarea
                  id="profile-bio"
                  rows="4"
                  class="field-input"
                  formControlName="bio"
                  aria-describedby="profile-bio-count profile-bio-error"
                  [attr.aria-invalid]="bioError ? 'true' : null"
                ></textarea>
                <p id="profile-bio-count" class="mt-1.5 text-sm text-slate-600">
                  {{ bioLength() }} of {{ bioMaxLength }} characters
                </p>
                <p id="profile-bio-error" class="field-error" [hidden]="!bioError">
                  {{ bioError }}
                </p>
              </div>

              <fieldset class="space-y-4">
                <legend class="field-label">
                  Where you are <span class="font-normal text-slate-600">(optional)</span>
                </legend>
                @if (locationError(); as message) {
                  <p class="text-sm text-red-700" role="alert">{{ message }}</p>
                }

                <div>
                  <label class="field-label" for="profile-provinceId">Province</label>
                  @let provinceError = support.errorOf('provinceId');
                  <select
                    id="profile-provinceId"
                    class="field-input"
                    formControlName="provinceId"
                    aria-describedby="profile-provinceId-error"
                    [attr.aria-invalid]="provinceError ? 'true' : null"
                  >
                    <option [ngValue]="null">Not set</option>
                    @for (province of provinces(); track province.id) {
                      <option [ngValue]="province.id">{{ province.name }}</option>
                    }
                  </select>
                  <p id="profile-provinceId-error" class="field-error" [hidden]="!provinceError">
                    {{ provinceError }}
                  </p>
                </div>

                <div>
                  <label class="field-label" for="profile-districtId">District</label>
                  @let districtError = support.errorOf('districtId');
                  <select
                    id="profile-districtId"
                    class="field-input"
                    formControlName="districtId"
                    aria-describedby="profile-districtId-error"
                    [attr.aria-invalid]="districtError ? 'true' : null"
                  >
                    <option [ngValue]="null">Not set</option>
                    @for (district of districts(); track district.id) {
                      <option [ngValue]="district.id">{{ district.name }}</option>
                    }
                  </select>
                  <p id="profile-districtId-error" class="field-error" [hidden]="!districtError">
                    {{ districtError }}
                  </p>
                </div>

                <div>
                  <label class="field-label" for="profile-municipalityId"
                    >City or municipality</label
                  >
                  @let municipalityError = support.errorOf('municipalityId');
                  <select
                    id="profile-municipalityId"
                    class="field-input"
                    formControlName="municipalityId"
                    aria-describedby="profile-municipalityId-error"
                    [attr.aria-invalid]="municipalityError ? 'true' : null"
                  >
                    <option [ngValue]="null">Not set</option>
                    @for (municipality of municipalities(); track municipality.id) {
                      <option [ngValue]="municipality.id">{{ municipality.name }}</option>
                    }
                  </select>
                  <p
                    id="profile-municipalityId-error"
                    class="field-error"
                    [hidden]="!municipalityError"
                  >
                    {{ municipalityError }}
                  </p>
                </div>
              </fieldset>

              <button type="submit" class="btn btn-primary" [disabled]="saving()">
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
            </form>
          }
        }
      </div>
    </section>
  `,
})
export class Profile implements OnInit {
  private readonly userApi = inject(UserApi);
  private readonly locationApi = inject(LocationApi);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(Toasts);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly bioMaxLength = BIO_MAX_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.required, trimmedLength(2, 80)]],
    phone: ['', [nepalMobile]],
    showPhone: [false],
    bio: ['', [Validators.maxLength(BIO_MAX_LENGTH)]],
    provinceId: new FormControl<number | null>(null),
    districtId: new FormControl<number | null>(null),
    municipalityId: new FormControl<number | null>(null),
  });

  protected readonly support = new FormSupport<FieldName>(this.form, {
    idPrefix: 'profile',
    host: inject<ElementRef<HTMLElement>>(ElementRef),
    order: [
      'displayName',
      'phone',
      'showPhone',
      'bio',
      'provinceId',
      'districtId',
      'municipalityId',
    ],
    requiredMessages: { displayName: 'Enter your name.' },
  });

  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly loadError = signal<string | null>(null);
  /** The account as last loaded or saved: for the e-mail address and "member since", which cannot be edited here. */
  protected readonly account = signal<User | null>(null);
  protected readonly provinces = signal<readonly Province[]>([]);
  protected readonly districts = signal<readonly District[]>([]);
  protected readonly municipalities = signal<readonly Municipality[]>([]);
  protected readonly locationError = signal<string | null>(null);
  protected readonly bioLength = signal(0);
  protected readonly saving = signal(false);
  /** A problem that does not belong to one field: a conflict with another device, a network failure, ... */
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    const { phone, bio, provinceId, districtId, municipalityId } = this.form.controls;

    phone.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncShowPhone());
    bio.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((text) => this.bioLength.set(text.length));

    // Choosing a province empties the lists below it and loads its districts; choosing a district does the same for municipalities.
    provinceId.valueChanges
      .pipe(
        tap(() => {
          districtId.setValue(null, { emitEvent: false });
          municipalityId.setValue(null, { emitEvent: false });
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
          municipalityId.setValue(null, { emitEvent: false });
          this.syncLocationControls();
        }),
        switchMap((id) => this.municipalitiesOf(id)),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.municipalities.set(list));
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.loadError.set(null);
    this.userApi
      .me()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.populate(user);
          this.status.set('ready');
        },
        error: (error: unknown) => {
          this.loadError.set(toApiError(error).message);
          this.status.set('error');
        },
      });
    this.locationApi
      .provinces()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.provinces.set(list),
        error: () =>
          this.locationError.set(
            'The list of provinces could not be loaded, so your place cannot be changed right now.',
          ),
      });
  }

  protected save(): void {
    if (this.saving() || !this.support.attempt()) {
      return;
    }
    const value = this.form.getRawValue();
    const phone = value.phone.trim();
    const request: UpdateProfileRequest = {
      displayName: value.displayName.trim(),
      phone: phone || null,
      showPhone: value.showPhone && phone !== '',
      bio: value.bio.trim() || null,
      provinceId: value.provinceId,
      districtId: value.districtId,
      municipalityId: value.municipalityId,
    };

    this.saving.set(true);
    this.saveError.set(null);
    this.userApi
      .updateMe(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.saving.set(false);
          this.session.updateUser(user);
          this.populate(user);
          this.toasts.success('Your profile was saved.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          const failure = toApiError(error);
          if (!this.support.showServerErrors(failure)) {
            this.saveError.set(failure.message);
          }
        },
      });
  }

  /** Fills the form from the server's copy and loads the lists for the saved place. */
  private populate(user: User): void {
    this.account.set(user);
    this.form.reset(
      {
        displayName: user.displayName,
        phone: nationalNumber(user.phone),
        showPhone: user.showPhone,
        bio: user.bio ?? '',
        provinceId: user.provinceId,
        districtId: user.districtId,
        municipalityId: user.municipalityId,
      },
      { emitEvent: false },
    );
    this.bioLength.set((user.bio ?? '').length);
    this.syncShowPhone();
    this.syncLocationControls();
    this.districtsOf(user.provinceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.districts.set(list));
    this.municipalitiesOf(user.districtId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.municipalities.set(list));
  }

  /** "Show my number" only makes sense with a number: without one the box is off and cannot be ticked. */
  private syncShowPhone(): void {
    const { phone, showPhone } = this.form.controls;
    if (phone.value.trim() === '') {
      showPhone.setValue(false, { emitEvent: false });
      showPhone.disable({ emitEvent: false });
    } else {
      showPhone.enable({ emitEvent: false });
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
    if (districtId.value === null) {
      municipalityId.disable({ emitEvent: false });
    } else {
      municipalityId.enable({ emitEvent: false });
    }
  }

  private districtsOf(provinceId: number | null): Observable<readonly District[]> {
    if (provinceId === null) {
      return of([]);
    }
    return this.locationApi
      .districts(provinceId)
      .pipe(catchError(() => this.listFailed('districts')));
  }

  private municipalitiesOf(districtId: number | null): Observable<readonly Municipality[]> {
    if (districtId === null) {
      return of([]);
    }
    return this.locationApi
      .municipalities(districtId)
      .pipe(catchError(() => this.listFailed('cities and municipalities')));
  }

  private listFailed(what: string): Observable<never[]> {
    this.locationError.set(
      `The list of ${what} could not be loaded. Choose the province again to retry.`,
    );
    return of([]);
  }
}
