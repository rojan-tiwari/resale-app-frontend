import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FavoritesStore } from './core/favorites/favorites-store';
import { Footer } from './layout/footer/footer';
import { Header } from './layout/header/header';
import { ToastOutlet } from './shared/components/toast-outlet';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, ToastOutlet],
  host: { class: 'flex min-h-screen flex-col' },
  template: `
    <a href="#main" class="skip-link">Skip to main content</a>
    <app-header />
    <main id="main" tabindex="-1" class="flex-1 focus:outline-none">
      <router-outlet />
    </main>
    <app-footer />
    <app-toasts />
  `,
})
export class App {
  // Created right away so it starts loading the saved ads as soon as a session is restored, whichever page is open first.
  protected readonly favorites = inject(FavoritesStore);
}
