import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from './layout/footer/footer';
import { Header } from './layout/header/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  host: { class: 'flex min-h-screen flex-col' },
  template: `
    <a href="#main" class="skip-link">Skip to main content</a>
    <app-header />
    <main id="main" tabindex="-1" class="flex-1 focus:outline-none">
      <router-outlet />
    </main>
    <app-footer />
  `,
})
export class App {}
