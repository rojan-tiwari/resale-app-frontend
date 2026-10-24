import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="container-page py-20 text-center">
      <p class="text-sm font-semibold text-brand-700">Error 404</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">This page could not be found</h1>
      <p class="mx-auto mt-3 max-w-md text-slate-600">
        The link may be broken, or the page may have been moved.
      </p>
      <a routerLink="/" class="btn btn-primary mt-8">Back to home</a>
    </section>
  `,
})
export class NotFound {}
