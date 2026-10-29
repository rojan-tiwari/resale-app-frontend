import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthSession } from '../../core/auth/auth-session';
import { Logo } from '../../shared/components/logo';
import { UserMenu } from './user-menu';

/**
 * Site header: the brand, primary navigation and the account area: "Sign in" and "Create account" for visitors, the user
 * menu for signed-in people. Search, location selector, "Post an ad", favourites, messages and notifications are added by
 * the features that deliver them. On phones the secondary links and "Create account" are hidden so "Sign in" fits (the
 * logo already links home, and the sign-in page links to registration).
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, Logo, UserMenu],
  host: { role: 'banner', class: 'sticky top-0 z-40 block border-b border-slate-200 bg-white/90 backdrop-blur' },
  template: `
    <div class="container-page flex h-16 items-center justify-between gap-4">
      <a routerLink="/" class="rounded-lg" aria-label="ResaleMarket, go to the home page">
        <app-logo [name]="appName" />
      </a>

      <nav aria-label="Primary" class="flex items-center gap-1">
        <a
          routerLink="/"
          routerLinkActive="bg-brand-50 text-brand-800"
          [routerLinkActiveOptions]="{ exact: true }"
          class="nav-link hidden sm:block"
        >
          Home
        </a>
        @if (apiDocsUrl) {
          <a [href]="apiDocsUrl" target="_blank" rel="noopener" class="nav-link hidden sm:block">
            API docs<span class="sr-only"> (opens in a new tab)</span>
          </a>
        }
        @switch (session.status()) {
          @case ('authenticated') {
            <app-user-menu />
          }
          @case ('anonymous') {
            <a routerLink="/auth/login" class="nav-link">Sign in</a>
            <a routerLink="/auth/register" class="btn btn-primary ml-2 max-sm:hidden">Create account</a>
          }
          @default {
            <!-- Placeholder while the session is being restored, so the header does not jump. -->
            <span class="skeleton ml-2 h-10 w-28" aria-hidden="true"></span>
          }
        }
      </nav>
    </div>
  `,
})
export class Header {
  protected readonly session = inject(AuthSession);
  protected readonly appName = environment.appName;
  protected readonly apiDocsUrl = environment.apiDocsUrl;
}
