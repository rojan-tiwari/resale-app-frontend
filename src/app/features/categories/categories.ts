import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoryStore } from '../../core/services/category-store';

/** Every category with its subcategories, as links to the category pages: the page behind "All categories" and the way to browse on a phone. */
@Component({
  selector: 'app-categories',
  imports: [RouterLink],
  template: `
    <section class="container-page py-8 sm:py-10">
      <nav aria-label="Breadcrumb" class="text-sm text-slate-600">
        <ol class="flex flex-wrap items-center gap-x-2">
          <li>
            <a routerLink="/" class="underline underline-offset-2 hover:text-slate-900">Home</a>
          </li>
          <li aria-hidden="true">›</li>
          <li><span aria-current="page">All categories</span></li>
        </ol>
      </nav>
      <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        All categories
      </h1>

      @switch (store.status()) {
        @case ('ready') {
          <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (category of store.tree(); track category.id) {
              <section class="card p-4" [attr.aria-labelledby]="'category-' + category.id">
                <h2 [id]="'category-' + category.id" class="text-lg font-semibold">
                  <a
                    [routerLink]="['/categories', category.slug]"
                    class="text-slate-900 hover:text-brand-700 hover:underline"
                    >{{ category.name }}</a
                  >
                </h2>
                @if (category.children.length > 0) {
                  <ul class="mt-2 space-y-1 text-sm">
                    @for (child of category.children; track child.id) {
                      <li>
                        <a
                          [routerLink]="['/categories', category.slug, child.slug]"
                          class="text-slate-700 underline-offset-2 hover:text-brand-700 hover:underline"
                          >{{ child.name }}</a
                        >
                      </li>
                    }
                  </ul>
                }
              </section>
            }
          </div>
        }
        @case ('error') {
          <div class="card mt-6 p-6" role="alert">
            <p class="text-sm text-slate-700">The categories could not be loaded.</p>
            <button type="button" class="btn btn-primary mt-4" (click)="store.retry()">
              Try again
            </button>
          </div>
        }
        @default {
          <div
            class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
            aria-label="Loading categories"
          >
            @for (placeholder of placeholders; track placeholder) {
              <div class="skeleton h-40" aria-hidden="true"></div>
            }
          </div>
        }
      }
    </section>
  `,
})
export class Categories {
  protected readonly store = inject(CategoryStore);
  protected readonly placeholders = [1, 2, 3, 4, 5, 6];

  constructor() {
    this.store.load();
  }
}
