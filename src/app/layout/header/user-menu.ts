import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';

/**
 * The signed-in person's menu in the header: their name, email and "Sign out". A disclosure button (not an ARIA menu):
 * it opens a small panel that stays in the tab order after the button. Escape, a click outside or tabbing away closes it.
 */
@Component({
  selector: 'app-user-menu',
  host: {
    class: 'relative ml-2 block',
    '(document:click)': 'closeOnOutsideClick($event)',
    // On the document, not the host: Safari does not focus a button that was clicked, so Escape would never reach the host.
    '(document:keydown.escape)': 'closeAndRefocus()',
    '(focusout)': 'closeWhenFocusLeaves($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="btn btn-ghost"
      aria-controls="user-menu-panel"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      <span
        class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800"
        aria-hidden="true"
      >
        {{ initial() }}
      </span>
      <span class="max-w-32 truncate max-sm:sr-only">{{ session.user()?.displayName }}</span>
    </button>

    @if (open()) {
      <div id="user-menu-panel" class="card absolute right-0 z-50 mt-2 w-64 p-4">
        <p class="truncate font-semibold text-slate-900">{{ session.user()?.displayName }}</p>
        <p class="mt-0.5 text-sm break-all text-slate-600">{{ session.user()?.email }}</p>
        <button type="button" class="btn btn-secondary mt-4 w-full" (click)="signOut()">
          Sign out
        </button>
      </div>
    }
  `,
})
export class UserMenu {
  protected readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  protected readonly initial = computed(() =>
    (this.session.user()?.displayName ?? '').trim().charAt(0).toUpperCase(),
  );

  protected closeOnOutsideClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected closeAndRefocus(): void {
    if (this.open()) {
      this.open.set(false);
      this.trigger().nativeElement.focus();
    }
  }

  protected closeWhenFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.open() && next && !this.host.nativeElement.contains(next)) {
      this.open.set(false);
    }
  }

  protected signOut(): void {
    this.open.set(false);
    this.session.logout().subscribe();
    // The page the person was on may need a sign-in, and guards only run on navigation, so always go home.
    void this.router.navigateByUrl('/');
  }
}
