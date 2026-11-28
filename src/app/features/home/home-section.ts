import { Component, input, output } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { ListState, ListingList } from '../../shared/components/listing-list';

/**
 * One block of the home page: a heading, an optional "See all" link to the search that shows more of the same, and the cards with their own
 * loading, empty and error states. A section that has nothing to show (and is allowed to) is hidden by the page, not by this component.
 */
@Component({
  selector: 'app-home-section',
  imports: [RouterLink, ListingList],
  host: { class: 'block' },
  template: `
    <section [attr.aria-labelledby]="headingId()">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2
            [id]="headingId()"
            class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
          >
            {{ heading() }}
          </h2>
          @if (subtitle(); as text) {
            <p class="mt-0.5 text-sm text-slate-600">{{ text }}</p>
          }
        </div>
        @if (seeAll(); as link) {
          <a
            [routerLink]="link.path"
            [queryParams]="link.query"
            class="text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
          >
            See all<span class="sr-only"> {{ heading() }}</span>
          </a>
        }
      </div>
      <app-listing-list
        [state]="state()"
        [emptyText]="emptyText()"
        [loadingLabel]="'Loading ' + heading()"
        (retry)="retry.emit()"
      />
    </section>
  `,
})
export class HomeSection {
  readonly heading = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly state = input.required<ListState>();
  readonly emptyText = input('Nothing here yet.');
  /** Where "See all" goes: a path and its query parameters, or null for no link. */
  readonly seeAll = input<{ readonly path: string; readonly query?: Params } | null>(null);
  readonly retry = output<void>();

  protected headingId(): string {
    return (
      'home-' +
      this.heading()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
    );
  }
}
