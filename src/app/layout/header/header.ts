import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Logo } from '../../shared/components/logo';

/**
 * Site header. Phase 1 ships the brand and primary navigation; search, location selector, "Post an ad",
 * favourites, messages, notifications and the profile menu are added by the phases that deliver those features.
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, Logo],
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
          class="nav-link"
        >
          Home
        </a>
        @if (apiDocsUrl) {
          <a [href]="apiDocsUrl" target="_blank" rel="noopener" class="nav-link">
            API docs<span class="sr-only"> (opens in a new tab)</span>
          </a>
        }
      </nav>
    </div>
  `,
})
export class Header {
  protected readonly appName = environment.appName;
  protected readonly apiDocsUrl = environment.apiDocsUrl;
}
