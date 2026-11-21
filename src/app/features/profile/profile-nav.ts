import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Switches between the pages of the signed-in person's account: their details and their password. */
@Component({
  selector: 'app-profile-nav',
  imports: [RouterLink, RouterLinkActive],
  host: { class: 'block' },
  template: `
    <nav aria-label="Account" class="flex gap-1 border-b border-slate-200">
      <a
        routerLink="/profile"
        routerLinkActive="border-brand-600 text-brand-800"
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{ exact: true }"
        class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
      >
        Your details
      </a>
      <a
        routerLink="/profile/password"
        routerLinkActive="border-brand-600 text-brand-800"
        ariaCurrentWhenActive="page"
        class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
      >
        Password
      </a>
    </nav>
  `,
})
export class ProfileNav {}
