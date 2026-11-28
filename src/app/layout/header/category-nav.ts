import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CategoryStore } from '../../core/services/category-store';

/**
 * The top-level categories as a strip of links under the header: each opens the category page. It scrolls sideways when there are more
 * than fit (a phone shows about three), so nothing is hidden behind a menu. While the tree loads it shows placeholders of the same height,
 * so the page does not jump; if it fails the strip simply stays empty and the rest of the page works.
 */
@Component({
  selector: 'app-category-nav',
  imports: [RouterLink, RouterLinkActive],
  host: { class: 'block min-w-0' },
  template: `
    <nav aria-label="Categories">
      <ul
        class="flex items-center gap-1 overflow-x-auto py-1.5 whitespace-nowrap [scrollbar-width:thin]"
      >
        @switch (store.status()) {
          @case ('ready') {
            @for (category of store.tree(); track category.id) {
              <li>
                <a
                  [routerLink]="['/categories', category.slug]"
                  routerLinkActive="bg-brand-50 text-brand-800"
                  class="nav-link block"
                >
                  {{ category.name }}
                </a>
              </li>
            }
            <li>
              <a
                routerLink="/categories"
                [routerLinkActiveOptions]="{ exact: true }"
                routerLinkActive="bg-brand-50 text-brand-800"
                class="nav-link block font-semibold"
              >
                All categories
              </a>
            </li>
          }
          @case ('error') {
            <li class="px-3 py-2 text-sm text-slate-600">
              Categories could not be loaded.
              <button
                type="button"
                class="font-medium text-brand-700 underline underline-offset-2"
                (click)="store.retry()"
              >
                Try again
              </button>
            </li>
          }
          @default {
            @for (placeholder of placeholders; track placeholder) {
              <li aria-hidden="true"><span class="skeleton mx-1 block h-6 w-24"></span></li>
            }
          }
        }
      </ul>
    </nav>
  `,
})
export class CategoryNav {
  protected readonly store = inject(CategoryStore);
  protected readonly placeholders = [1, 2, 3, 4, 5, 6];

  constructor() {
    this.store.load();
  }
}
