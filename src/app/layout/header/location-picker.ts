import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LocationPreference } from '../../core/location/location-preference';
import { District, Province } from '../../core/models/location';
import { LocationApi } from '../../core/services/location-api';

/**
 * "Ads near me": shows the chosen district (or "All of Nepal") and opens a small panel to change it. A disclosure button like the user
 * menu: Escape, a click elsewhere or tabbing away closes it and Escape returns focus to the button. The choice is kept in this browser
 * ({@link LocationPreference}) and used by the home page's "near you" list.
 */
@Component({
  selector: 'app-location-picker',
  imports: [ReactiveFormsModule],
  host: {
    class: 'relative block',
    '(document:click)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'closeAndRefocus()',
    '(focusout)': 'closeWhenFocusLeaves($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="btn btn-ghost max-sm:px-2"
      aria-controls="location-picker-panel"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <svg
        class="size-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      <span class="max-w-32 truncate"
        ><span class="sr-only">Location: </span
        >{{ preference.place()?.districtName ?? 'All of Nepal' }}</span
      >
    </button>

    @if (open()) {
      <div
        id="location-picker-panel"
        class="card absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 p-4"
        role="group"
        aria-label="Choose your location"
      >
        @if (error(); as message) {
          <p class="text-sm text-red-700" role="alert">{{ message }}</p>
        }
        <div>
          <label class="field-label" for="place-province">Province</label>
          <select id="place-province" class="field-input" [formControl]="province">
            <option [ngValue]="null">Choose a province</option>
            @for (item of provinces(); track item.id) {
              <option [ngValue]="item.id">{{ item.name }}</option>
            }
          </select>
        </div>
        <div>
          <label class="field-label" for="place-district">District</label>
          <select id="place-district" class="field-input" [formControl]="district">
            <option [ngValue]="null">Choose a district</option>
            @for (item of districts(); track item.id) {
              <option [ngValue]="item.id">{{ item.name }}</option>
            }
          </select>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="district.value === null"
            (click)="apply()"
          >
            Show ads here
          </button>
          <button type="button" class="btn btn-secondary" (click)="everywhere()">
            All of Nepal
          </button>
        </div>
      </div>
    }
  `,
})
export class LocationPicker {
  protected readonly preference = inject(LocationPreference);
  private readonly locationApi = inject(LocationApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  protected readonly provinces = signal<readonly Province[]>([]);
  protected readonly districts = signal<readonly District[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly province = new FormControl<number | null>(null);
  protected readonly district = new FormControl<number | null>(null);

  constructor() {
    this.province.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.district.setValue(null);
      this.loadDistricts(id);
    });
  }

  protected toggle(): void {
    const opening = !this.open();
    this.open.set(opening);
    if (opening) {
      this.error.set(null);
      const place = this.preference.place();
      this.province.setValue(place?.provinceId ?? null, { emitEvent: false });
      this.loadProvinces();
      if (place) {
        this.loadDistricts(place.provinceId, place.districtId);
      }
    }
  }

  protected apply(): void {
    const districtId = this.district.value;
    const provinceId = this.province.value;
    const name = this.districts().find((candidate) => candidate.id === districtId)?.name;
    if (districtId === null || provinceId === null || name === undefined) {
      return;
    }
    this.preference.choose({ provinceId, districtId, districtName: name });
    this.close();
  }

  protected everywhere(): void {
    this.preference.clear();
    this.close();
  }

  protected closeOnOutsideClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected closeAndRefocus(): void {
    if (this.open()) {
      this.open.set(false);
      this.trigger().nativeElement.focus();
    }
  }

  protected closeWhenFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.open() && next && !this.host.nativeElement.contains(next)) {
      this.open.set(false);
    }
  }

  private close(): void {
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  private loadProvinces(): void {
    if (this.provinces().length > 0) {
      return;
    }
    this.locationApi.provinces().subscribe({
      next: (list) => this.provinces.set(list),
      error: () => this.error.set('The provinces could not be loaded. Close this and try again.'),
    });
  }

  private loadDistricts(provinceId: number | null, select?: number): void {
    if (provinceId === null) {
      this.districts.set([]);
      return;
    }
    this.locationApi.districts(provinceId).subscribe({
      next: (list) => {
        this.districts.set(list);
        if (select !== undefined) {
          this.district.setValue(select, { emitEvent: false });
        }
      },
      error: () =>
        this.error.set('The districts could not be loaded. Choose the province again to retry.'),
    });
  }
}
