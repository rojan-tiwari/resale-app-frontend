import { Service, effect, inject, signal, untracked } from '@angular/core';
import { AuthSession } from '../auth/auth-session';
import { LocationApi } from '../services/location-api';

/** The place a visitor chose to see ads near. A district is precise enough for "near you" and is what the picker offers. */
export interface PlacePreference {
  readonly provinceId: number;
  readonly districtId: number;
  readonly districtName: string;
}

const STORAGE_KEY = 'resalemarket.place';

/** What is kept in the browser: the place, or `null` for "all of Nepal" that the person chose on purpose. Not having chosen is "no entry". */
interface Stored {
  readonly place: PlacePreference | null;
}

function isPlace(value: unknown): value is PlacePreference {
  const place = value as Partial<PlacePreference> | null;
  return (
    typeof place === 'object' &&
    place !== null &&
    Number.isInteger(place.provinceId) &&
    Number.isInteger(place.districtId) &&
    typeof place.districtName === 'string'
  );
}

/**
 * Where the person wants to see ads "near": chosen in the header, remembered in this browser, and used by the home page and as a
 * starting filter. It is a convenience, not a secret, so `localStorage` is fine (and every read and write is guarded: a private window
 * or blocked storage just means the choice is not remembered). The server never receives it except as ordinary search filters.
 *
 * A signed-in person who has never chosen gets the district of their profile, once. Choosing "all of Nepal" is remembered too, so it
 * is not overridden again.
 */
@Service()
export class LocationPreference {
  private readonly session = inject(AuthSession);
  private readonly locationApi = inject(LocationApi);

  private readonly chosen = signal<PlacePreference | null>(null);
  private hasChosen = false;

  /** The place to show ads near, or null for all of Nepal. */
  readonly place = this.chosen.asReadonly();

  constructor() {
    const stored = this.read();
    if (stored !== undefined) {
      this.chosen.set(stored.place);
      this.hasChosen = true;
    }
    effect(() => {
      const user = this.session.user();
      untracked(() => this.adoptProfilePlace(user?.provinceId ?? null, user?.districtId ?? null));
    });
  }

  choose(place: PlacePreference): void {
    this.chosen.set(place);
    this.hasChosen = true;
    this.write({ place });
  }

  /** "All of Nepal". */
  clear(): void {
    this.chosen.set(null);
    this.hasChosen = true;
    this.write({ place: null });
  }

  /** Takes the district of the person's profile as the place, once, when they have not chosen one themselves. */
  private adoptProfilePlace(provinceId: number | null, districtId: number | null): void {
    if (this.hasChosen || provinceId === null || districtId === null) {
      return;
    }
    this.locationApi.districts(provinceId).subscribe({
      next: (districts) => {
        const district = districts.find((candidate) => candidate.id === districtId);
        if (district && !this.hasChosen) {
          // Not stored as a choice: the person did not make one, and a later change of their profile should be followed.
          this.chosen.set({ provinceId, districtId, districtName: district.name });
        }
      },
      error: () => undefined, // the place is a nicety: without the district's name it is simply not preselected
    });
  }

  private read(): Stored | undefined {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text === null) {
        return undefined;
      }
      const value = JSON.parse(text) as { place?: unknown };
      if (value.place === null) {
        return { place: null };
      }
      return isPlace(value.place) ? { place: value.place } : undefined;
    } catch {
      return undefined;
    }
  }

  private write(stored: Stored): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // storage unavailable: the choice lasts until the page is closed
    }
  }
}
