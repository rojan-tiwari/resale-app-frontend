import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthSession } from '../../core/auth/auth-session';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { Logo } from '../../shared/components/logo';
import { CategoryNav } from './category-nav';
import { LocationPicker } from './location-picker';
import { SearchBar } from './search-bar';
import { UserMenu } from './user-menu';

/**
 * Site header, in up to three rows. First the brand, the keyword search (a second copy under it on phones), the favourites heart,
 * "Post an ad" and the account area ("Sign in" and "Create account" for visitors, the user menu for signed-in people). Then the location
 * picker beside the search on phones. And a strip of category links. Messages and notifications are added by the features that deliver
 * them. On phones the secondary links and "Create account" are hidden so "Sign in" fits (the logo links home, and the sign-in page links
 * to registration), and the header is not sticky there: three rows would cover too much of a small screen.
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, Logo, UserMenu, SearchBar, CategoryNav, LocationPicker],
  host: {
    role: 'banner',
    class: 'z-40 block border-b border-slate-200 bg-white/95 backdrop-blur sm:sticky sm:top-0',
  },
  template: `
    <div class="container-page flex h-16 items-center gap-3">
      <a routerLink="/" class="shrink-0 rounded-lg" aria-label="ResaleMarket, go to the home page">
        <app-logo [name]="appName" [compact]="true" />
      </a>

      <app-search-bar class="hidden min-w-0 flex-1 sm:block" />

      <nav aria-label="Primary" class="ml-auto flex shrink-0 items-center gap-1">
        @if (apiDocsUrl) {
          <a [href]="apiDocsUrl" target="_blank" rel="noopener" class="nav-link hidden lg:block">
            API docs<span class="sr-only"> (opens in a new tab)</span>
          </a>
        }
        <app-location-picker class="hidden sm:block" />
        <a
          routerLink="/favorites"
          routerLinkActive="bg-brand-50 text-brand-800"
          class="nav-link relative flex items-center gap-1 max-sm:px-2"
          [attr.aria-label]="favoritesLabel()"
        >
          <svg
            class="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M12 20.5s-7.4-4.5-9.3-9.1C1.5 8.5 3.1 5.5 6.2 5.5c1.9 0 3.3 1 4.1 2.4.4.6 1.1.6 1.4 0 .8-1.4 2.2-2.4 4.1-2.4 3.1 0 4.7 3 3.5 5.9-1.9 4.6-9.3 9.1-9.3 9.1Z"
            />
          </svg>
          @if (favorites.count() > 0) {
            <span class="badge badge-brand" aria-hidden="true">{{ favorites.count() }}</span>
          }
        </a>
        <a routerLink="/listings/new" class="btn btn-primary ml-1 whitespace-nowrap max-sm:px-3">
          <span class="sm:hidden">Post ad</span><span class="max-sm:hidden">Post an ad</span>
        </a>
        @switch (session.status()) {
          @case ('authenticated') {
            <app-user-menu />
          }
          @case ('anonymous') {
            <a routerLink="/auth/login" class="nav-link max-sm:px-2">Sign in</a>
            <a routerLink="/auth/register" class="btn btn-secondary ml-1 max-md:hidden"
              >Create account</a
            >
          }
          @default {
            <!-- Placeholder while the session is being restored, so the header does not jump. -->
            <span class="skeleton ml-2 h-10 w-28" aria-hidden="true"></span>
          }
        }
      </nav>
    </div>

    <div class="container-page flex items-center gap-2 pb-3 sm:hidden">
      <app-search-bar class="min-w-0 flex-1" />
      <app-location-picker />
    </div>

    <div class="border-t border-slate-100">
      <div class="container-page">
        <app-category-nav />
      </div>
    </div>
  `,
})
export class Header {
  protected readonly session = inject(AuthSession);
  protected readonly favorites = inject(FavoritesStore);
  protected readonly appName = environment.appName;
  protected readonly apiDocsUrl = environment.apiDocsUrl;

  protected favoritesLabel(): string {
    const count = this.favorites.count();
    return count > 0 ? `Favourites, ${count} saved` : 'Favourites';
  }
}
