import { Provider, signal } from '@angular/core';
import { FavoritesStore } from '../core/favorites/favorites-store';

/**
 * A stand-in for {@link FavoritesStore} in specs of pages that only show cards: no requests, no session, just the hearts' state. The real
 * store is tested on its own. `toggled` records what was clicked.
 */
export class FavoritesStub {
  readonly saved = signal<ReadonlySet<string>>(new Set());
  readonly count = () => this.saved().size;
  readonly toggled: string[] = [];

  isSaved(id: string): boolean {
    return this.saved().has(id);
  }

  isPending(): boolean {
    return false;
  }

  toggle(id: string): void {
    this.toggled.push(id);
  }

  forget(id: string): void {
    this.saved.update((current) => new Set([...current].filter((saved) => saved !== id)));
  }
}

export function provideFavoritesStub(stub: FavoritesStub = new FavoritesStub()): Provider {
  return { provide: FavoritesStore, useValue: stub };
}
