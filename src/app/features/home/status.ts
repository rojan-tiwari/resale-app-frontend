import { Component } from '@angular/core';
import { SystemStatus } from './system-status';

/** The developer-facing connectivity check of Phase 1 (browser -> API -> database), kept at `/status` now that the home page is the real one. */
@Component({
  selector: 'app-status',
  imports: [SystemStatus],
  template: `
    <section class="container-page py-10">
      <h1 class="mb-4 text-2xl font-bold tracking-tight text-slate-900">Platform status</h1>
      <app-system-status />
    </section>
  `,
})
export class Status {}
