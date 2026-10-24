import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ApiError, toApiError } from '../../core/models/api-error';
import { SystemInfo } from '../../core/models/system-info';
import { LocationApi } from '../../core/services/location-api';
import { SystemApi } from '../../core/services/system-api';
import { NepalDatePipe } from '../../shared/pipes/nepal-date-pipe';

type StatusState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly info: SystemInfo; readonly provinceCount: number }
  | { readonly kind: 'error'; readonly error: ApiError };

/**
 * Developer-facing health panel: calls the API (which queries PostgreSQL) and the location endpoint
 * (which reads Flyway-seeded data), proving that browser -> API -> database works end to end.
 */
@Component({
  selector: 'app-system-status',
  imports: [NepalDatePipe],
  template: `
    <section class="card p-5 sm:p-6" aria-labelledby="status-heading">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="status-heading" class="text-lg font-semibold text-slate-900">Platform status</h2>
          <p class="mt-1 text-sm text-slate-600">Live check of the browser, API and database connection.</p>
        </div>
        <button type="button" class="btn btn-secondary" (click)="refresh()" [disabled]="isLoading()">
          {{ isLoading() ? 'Checking…' : 'Check again' }}
        </button>
      </div>

      <div class="mt-5" role="status" aria-live="polite" [attr.aria-busy]="isLoading()">
        @let s = state();
        @if (s.kind === 'loading') {
          <div class="space-y-3" aria-label="Checking platform status">
            <div class="skeleton h-5 w-2/3"></div>
            <div class="skeleton h-5 w-1/2"></div>
            <div class="skeleton h-5 w-3/5"></div>
            <span class="sr-only">Checking platform status…</span>
          </div>
        } @else if (s.kind === 'ready') {
          <dl class="divide-y divide-slate-100 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
              <dt class="font-medium text-slate-800">API</dt>
              <dd class="flex items-center gap-2 text-slate-700">
                <span class="badge badge-success">Online</span>
                {{ s.info.application }} v{{ s.info.version }} · {{ s.info.environment }}
              </dd>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt class="font-medium text-slate-800">Database</dt>
              <dd class="flex items-center gap-2 text-slate-700">
                @if (s.info.database.status === 'UP') {
                  <span class="badge badge-success">Connected</span>
                  PostgreSQL {{ s.info.database.version }} · {{ s.info.database.migrationsApplied }} migrations
                  (latest V{{ s.info.database.latestMigration }})
                } @else {
                  <span class="badge badge-danger">Down</span>
                  The API cannot reach PostgreSQL
                }
              </dd>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt class="font-medium text-slate-800">Seed data</dt>
              <dd class="flex items-center gap-2 text-slate-700">
                @if (s.provinceCount > 0) {
                  <span class="badge badge-success">Loaded</span>
                  {{ s.provinceCount }} provinces
                } @else {
                  <span class="badge badge-danger">Missing</span>
                  No provinces found — did the Flyway migrations run?
                }
              </dd>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 py-3 last:pb-0">
              <dt class="font-medium text-slate-800">Server time</dt>
              <dd class="text-slate-700">{{ s.info.serverTime | nepalDate: 'datetime' }} (Nepal time)</dd>
            </div>
          </dl>
        } @else {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
            <p class="font-semibold text-red-900">{{ s.error.title }}</p>
            <p class="mt-1 text-sm text-red-900">{{ s.error.message }}</p>
            <p class="mt-3 text-sm text-red-900">
              Make sure PostgreSQL and the backend are running (see the README), then check again.
            </p>
            @if (s.error.traceId) {
              <p class="mt-2 text-xs text-red-800">Reference: {{ s.error.traceId }}</p>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class SystemStatus {
  private readonly systemApi = inject(SystemApi);
  private readonly locationApi = inject(LocationApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<StatusState>({ kind: 'loading' });
  protected readonly isLoading = computed(() => this.state().kind === 'loading');

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.state.set({ kind: 'loading' });
    forkJoin({ info: this.systemApi.ping(), provinces: this.locationApi.provinces() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ info, provinces }) => this.state.set({ kind: 'ready', info, provinceCount: provinces.length }),
        error: (error: unknown) => this.state.set({ kind: 'error', error: toApiError(error) }),
      });
  }
}
