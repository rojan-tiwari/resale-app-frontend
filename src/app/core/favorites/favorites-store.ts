import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthSession } from '../auth/auth-session';
import { toApiError } from '../models/api-error';
import { Toasts } from '../notifications/toasts';
import { FavoriteApi } from '../services/favorite-api';

/**
 * Which ads the signed-in person saved, as a set of ids, so any card can show a filled or an empty heart without a request of its own.
 * It is loaded once after sign-in (one request, at most a few hundred ids) and emptied on sign-out.
 *
 * Saving and unsaving are <b>optimistic</b>: the heart changes at once and the request follows; if the server refuses, the heart goes
 * back and a message says why. A heart that is waiting for the server ignores further clicks, so a double click cannot save and unsave.
 * Someone who is not signed in is sent to sign in and brought back to the page they were on.
 */
@Service()
export class FavoritesStore {
  private readonly session = inject(AuthSession);
  private readonly api = inject(FavoriteApi);
  private readonly toasts = inject(Toasts);
  private readonly router = inject(Router);

  private readonly saved = signal<ReadonlySet<string>>(new Set());
  private readonly pending = signal<ReadonlySet<string>>(new Set());

  /** How many ads are saved (the number next to the heart in the header). */
  readonly count = computed(() => this.saved().size);
  /** True once the ids of this sign-in were loaded. */
  readonly loaded = signal(false);

  constructor() {
    effect(() => {
      if (this.session.isAuthenticated()) {
        untracked(() => this.load());
      } else {
        untracked(() => this.reset());
      }
    });
  }

  isSaved(listingId: string): boolean {
    return this.saved().has(listingId);
  }

  /** True while a save or removal of this ad is on its way to the server. */
  isPending(listingId: string): boolean {
    return this.pending().has(listingId);
  }

  /** Saves the ad, or removes it when it is saved. */
  toggle(listingId: string): void {
    if (!this.session.isAuthenticated()) {
      this.toasts.info('Sign in to save ads you like.');
      void this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.isPending(listingId)) {
      return;
    }
    const wasSaved = this.isSaved(listingId);
    this.set(listingId, !wasSaved);
    this.markPending(listingId, true);

    const call: Observable<unknown> = wasSaved
      ? this.api.remove(listingId)
      : this.api.add(listingId);
    call.subscribe({
      next: () => this.markPending(listingId, false),
      error: (error: unknown) => {
        this.markPending(listingId, false);
        const failure = toApiError(error);
        // "Already saved" means the heart should be filled after all; every other failure puts it back as it was.
        if (!wasSaved && failure.status === 409) {
          this.set(listingId, true);
          return;
        }
        this.set(listingId, wasSaved);
        this.toasts.error(
          failure.status === 404 ? 'This ad is no longer available.' : failure.message,
        );
      },
    });
  }

  /** Forgets an ad that the person removed on the favourites page (the request was made there). */
  forget(listingId: string): void {
    this.set(listingId, false);
  }

  private load(): void {
    this.api.ids().subscribe({
      next: (ids) => {
        this.saved.set(new Set(ids));
        this.loaded.set(true);
      },
      // Without the ids every heart is empty: usable, and saving still works. Not worth an error message on every page.
      error: () => this.loaded.set(true),
    });
  }

  private reset(): void {
    this.saved.set(new Set());
    this.pending.set(new Set());
    this.loaded.set(false);
  }

  private set(listingId: string, isSaved: boolean): void {
    this.saved.update((current) => {
      const next = new Set(current);
      if (isSaved) {
        next.add(listingId);
      } else {
        next.delete(listingId);
      }
      return next;
    });
  }

  private markPending(listingId: string, isPending: boolean): void {
    this.pending.update((current) => {
      const next = new Set(current);
      if (isPending) {
        next.add(listingId);
      } else {
        next.delete(listingId);
      }
      return next;
    });
  }
}
