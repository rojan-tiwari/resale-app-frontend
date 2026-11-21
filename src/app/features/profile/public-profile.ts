import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ApiError, toApiError } from '../../core/models/api-error';
import { PublicUser } from '../../core/models/user';
import { UserApi } from '../../core/services/user-api';
import { NepalDatePipe } from '../../shared/pipes/nepal-date-pipe';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly member: PublicUser }
  | { readonly kind: 'error'; readonly error: ApiError };

const LOADING: State = { kind: 'loading' };

/**
 * What anyone may see about a member (`/users/:id`), such as the seller of an ad: name, a few words about them, where they
 * are and since when they are a member, and the phone number only if its owner chose to show it. Never an e-mail address.
 * A member that is unknown, suspended or deleted is shown as "not found", which is also what the server says.
 */
@Component({
  selector: 'app-public-profile',
  imports: [RouterLink, NepalDatePipe],
  template: `
    <section class="container-page py-10 sm:py-14">
      <div class="mx-auto w-full max-w-xl">
        @switch (state().kind) {
          @case ('loading') {
            <div
              class="card space-y-4 p-6 sm:p-8"
              aria-busy="true"
              aria-label="Loading the profile"
            >
              <div class="flex items-center gap-4">
                <div class="skeleton size-16 rounded-full"></div>
                <div class="skeleton h-6 w-48"></div>
              </div>
              <div class="skeleton h-4 w-64"></div>
              <div class="skeleton h-16 w-full"></div>
            </div>
          }
          @case ('error') {
            <div class="card p-6 text-center sm:p-8" role="alert">
              @if (notFound()) {
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">Member not found</h1>
                <p class="mt-3 text-slate-600">
                  This member does not exist or is no longer on ResaleMarket.
                </p>
                <a routerLink="/" class="btn btn-primary mt-6">Go to the home page</a>
              } @else {
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">
                  The profile could not be loaded
                </h1>
                <p class="mt-3 text-slate-600">{{ errorMessage() }}</p>
                <button type="button" class="btn btn-primary mt-6" (click)="retry()">
                  Try again
                </button>
              }
            </div>
          }
          @case ('ready') {
            @if (member(); as person) {
              <article class="card p-6 sm:p-8">
                <div class="flex items-center gap-4">
                  <span
                    class="grid size-16 shrink-0 place-items-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-800"
                    aria-hidden="true"
                  >
                    {{ initialOf(person.displayName) }}
                  </span>
                  <div class="min-w-0">
                    <h1 class="text-2xl font-bold tracking-tight break-words text-slate-900">
                      {{ person.displayName }}
                    </h1>
                    <p class="mt-1 text-sm text-slate-600">
                      Member since {{ person.memberSince | nepalDate }}
                    </p>
                  </div>
                </div>

                <dl class="mt-6 space-y-4 text-sm">
                  @if (placeOf(person); as place) {
                    <div>
                      <dt class="font-medium text-slate-800">Place</dt>
                      <dd class="mt-0.5 text-slate-700">{{ place }}</dd>
                    </div>
                  }
                  @if (person.phone; as phone) {
                    <div>
                      <dt class="font-medium text-slate-800">Phone</dt>
                      <dd class="mt-0.5">
                        <a
                          [href]="'tel:' + phone"
                          class="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                        >
                          {{ phone }}
                        </a>
                      </dd>
                    </div>
                  }
                </dl>

                @if (person.bio; as bio) {
                  <h2 class="mt-6 text-sm font-medium text-slate-800">About</h2>
                  <p class="mt-1 text-sm whitespace-pre-line text-slate-700">{{ bio }}</p>
                }
              </article>
            }
          }
        }
      </div>
    </section>
  `,
})
export class PublicProfile {
  private readonly userApi = inject(UserApi);
  private readonly title = inject(Title);

  /** Bound from the `:id` route parameter (router input binding). */
  readonly id = input.required<string>();

  /** Bumped by "Try again", so the same id is loaded once more. */
  private readonly attempt = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), attempt: this.attempt() }))).pipe(
      switchMap(({ id }) =>
        this.userApi.publicProfile(id).pipe(
          map((member): State => ({ kind: 'ready', member })),
          catchError((error: unknown) => of<State>({ kind: 'error', error: toApiError(error) })),
          startWith(LOADING),
        ),
      ),
    ),
    { initialValue: LOADING },
  );

  protected readonly member = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.member : null;
  });
  protected readonly notFound = computed(() => {
    const state = this.state();
    return state.kind === 'error' && state.error.isNotFound;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.error.message : '';
  });

  constructor() {
    effect(() => {
      const name = this.member()?.displayName;
      this.title.setTitle(name ? `${name} · ResaleMarket` : 'Member profile · ResaleMarket');
    });
  }

  protected retry(): void {
    this.attempt.update((count) => count + 1);
  }

  protected initialOf(name: string): string {
    return name.trim().charAt(0).toUpperCase();
  }

  /** "Kathmandu, Bagmati" from the parts that are set, smallest place first; null when none is. */
  protected placeOf(member: PublicUser): string | null {
    const parts = [
      member.location.municipality,
      member.location.district,
      member.location.province,
    ].filter((part): part is string => part !== null && part !== '');
    // A municipality is often named like its district ("Kathmandu"): saying it twice reads badly.
    const unique = parts.filter((part, index) => parts.indexOf(part) === index);
    return unique.length > 0 ? unique.join(', ') : null;
  }
}
