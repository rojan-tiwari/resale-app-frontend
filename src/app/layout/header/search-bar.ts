import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

/**
 * The keyword search in the header. Submitting opens the search page with the keyword in the address (`/search?q=...`), so the result is a
 * link that can be shared. While the person is on the search page the box shows the keyword in the address.
 */
@Component({
  selector: 'app-search-bar',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <form role="search" class="flex w-full gap-2" (submit)="$event.preventDefault(); submit()">
      <label class="sr-only" [for]="inputId">Search ads</label>
      <input
        [id]="inputId"
        name="q"
        type="search"
        class="field-input"
        placeholder="Search phones, bikes, furniture…"
        autocomplete="off"
        maxlength="100"
        enterkeyhint="search"
        [ngModel]="text()"
        (ngModelChange)="typed.set($event)"
      />
      <button type="submit" class="btn btn-primary shrink-0 px-3">
        <svg
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span class="sr-only">Search</span>
      </button>
    </form>
  `,
})
export class SearchBar {
  private readonly router = inject(Router);

  /** Two bars exist on one page (one is hidden by CSS on each screen size); their ids must differ. */
  private static counter = 0;
  protected readonly inputId = `search-bar-${++SearchBar.counter}`;

  /** What the person typed since they last searched; null until they type. */
  private readonly typed = signal<string | null>(null);

  /** The keyword of the address, so the box shows what was searched. */
  private readonly keyword = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        const url = this.router.parseUrl(this.router.url);
        const onSearch = url.root.children['primary']?.segments[0]?.path === 'search';
        const q = url.queryParams['q'];
        return onSearch && typeof q === 'string' ? q : '';
      }),
    ),
    { initialValue: '' },
  );

  protected readonly text = computed(() => this.keyword());

  protected submit(): void {
    const q = (this.typed() ?? this.keyword()).trim();
    this.typed.set(null);
    void this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }
}
