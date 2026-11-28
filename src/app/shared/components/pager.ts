import { Component, computed, input, output } from '@angular/core';

/**
 * "Previous / Page 2 of 5 / Next" for a paginated list. Pages are numbered from 1 for people and from 0 for the API: this takes and
 * gives the API's zero-based index. Renders nothing for a single page.
 */
@Component({
  selector: 'app-pager',
  host: { class: 'block' },
  template: `
    @if (totalPages() > 1) {
      <nav aria-label="Pages" class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="btn btn-secondary"
          [disabled]="page() <= 0"
          (click)="pageChange.emit(page() - 1)"
        >
          Previous
        </button>
        <p class="text-sm text-slate-700" aria-live="polite">
          Page {{ humanPage() }} of {{ totalPages() }}
        </p>
        <button
          type="button"
          class="btn btn-secondary"
          [disabled]="page() >= totalPages() - 1"
          (click)="pageChange.emit(page() + 1)"
        >
          Next
        </button>
      </nav>
    }
  `,
})
export class Pager {
  /** Zero-based index of the page being shown. */
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly humanPage = computed(() => this.page() + 1);
}
