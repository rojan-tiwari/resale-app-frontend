import { Service, computed, inject, signal } from '@angular/core';
import { Category } from '../models/category';
import { CategoryApi } from './category-api';

/**
 * The category tree, loaded once and shared: the header's category strip, the category pages and the search filters all need it, and
 * one request is enough (the server lets the browser keep it for an hour). A failed load can be tried again.
 */
@Service()
export class CategoryStore {
  private readonly api = inject(CategoryApi);

  readonly tree = signal<readonly Category[]>([]);
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly errorMessage = signal<string | null>(null);

  /** Top-level categories by slug. */
  readonly bySlug = computed(
    () => new Map(this.tree().map((category) => [category.slug, category])),
  );

  /** Loads the tree if it is not loaded (or loading) yet. Safe to call from every component that needs it. */
  load(): void {
    if (this.status() === 'loading' || this.status() === 'ready') {
      return;
    }
    this.status.set('loading');
    this.errorMessage.set(null);
    this.api.tree().subscribe({
      next: (tree) => {
        this.tree.set(tree);
        this.status.set('ready');
      },
      error: (error: unknown) => {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'The categories could not be loaded.',
        );
        this.status.set('error');
      },
    });
  }

  /** Forgets a failed attempt and tries again. */
  retry(): void {
    if (this.status() === 'error') {
      this.status.set('idle');
    }
    this.load();
  }

  /** A category (top-level or sub) by its id. */
  find(id: number): Category | undefined {
    for (const root of this.tree()) {
      if (root.id === id) {
        return root;
      }
      const child = root.children.find((candidate) => candidate.id === id);
      if (child) {
        return child;
      }
    }
    return undefined;
  }
}
