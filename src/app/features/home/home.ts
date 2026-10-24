import { Component } from '@angular/core';
import { SystemStatus } from './system-status';

/**
 * Phase 1 landing page. Phase 4 replaces the hero with the real homepage (search, categories,
 * featured / recent / nearby listings); the status panel then moves to an admin-only diagnostics page.
 */
@Component({
  selector: 'app-home',
  imports: [SystemStatus],
  template: `
    <section class="bg-linear-to-b from-brand-50 to-slate-50">
      <div class="container-page py-14 sm:py-20">
        <span class="badge badge-brand">Nepal's second-hand marketplace</span>
        <h1 class="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Buy and sell pre-loved things, close to home.
        </h1>
        <p class="mt-4 max-w-2xl text-lg text-slate-600">
          Phones, laptops, vehicles, furniture and more — priced in NPR and listed by province, district and city.
        </p>
      </div>
    </section>

    <section class="container-page pb-16">
      <app-system-status />
      <p class="mt-4 text-sm text-slate-600">
        This is the foundation build. Accounts, listings, search and messaging arrive in the next phases.
      </p>
    </section>
  `,
})
export class Home {}
