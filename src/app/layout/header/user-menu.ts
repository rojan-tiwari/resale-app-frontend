import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { toApiError } from '../../core/models/api-error';

/**
 * The signed-in person's menu in the header: their name, email, links to their ads and profile, "Sign out" and "Sign out of all devices". A disclosure button (not an ARIA menu):
 * it opens a small panel that stays in the tab order after the button. Escape, a click outside or tabbing away closes it.
 */
@Component({
  selector: 'app-user-menu',
  imports: [RouterLink],
  host: {
    class: 'relative ml-1 block sm:ml-2',
    '(document:click)': 'closeOnOutsideClick($event)',
    // On the document, not the host: Safari does not focus a button that was clicked, so Escape would never reach the host.
    '(document:keydown.escape)': 'closeAndRefocus()',
    '(focusout)': 'closeWhenFocusLeaves($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="btn btn-ghost max-sm:px-2"
      aria-controls="user-menu-panel"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
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
        <a
          routerLink="/listings/mine"
          class="btn btn-secondary mt-4 w-full"
          (click)="open.set(false)"
          >My ads</a
        >
        <a routerLink="/profile" class="btn btn-secondary mt-2 w-full" (click)="open.set(false)"
          >Your profile</a
        >
        <button type="button" class="btn btn-secondary mt-2 w-full" (click)="signOut()">
          Sign out
        </button>
        <button
          type="button"
          class="btn btn-ghost mt-1 w-full"
          aria-describedby="user-menu-all-hint"
          [disabled]="signingOutAll()"
          (click)="signOutAll()"
        >
          {{ signingOutAll() ? 'Signing out…' : 'Sign out of all devices' }}
        </button>
        <p id="user-menu-all-hint" class="mt-1 px-1 text-xs text-slate-600">
          Ends your session on every phone and computer, including this one.
        </p>
        @if (error(); as message) {
          <p class="mt-3 text-sm text-red-700" role="alert">{{ message }}</p>
        }
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
  protected readonly signingOutAll = signal(false);
  /** Why "Sign out of all devices" did not work, so the person knows the other devices may still be signed in. */
  protected readonly error = signal<string | null>(null);
  protected readonly initial = computed(() =>
    (this.session.user()?.displayName ?? '').trim().charAt(0).toUpperCase(),
  );

  protected toggle(): void {
    this.error.set(null);
    this.open.update((isOpen) => !isOpen);
  }

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

  protected signOutAll(): void {
    if (this.signingOutAll()) {
      return;
    }
    this.signingOutAll.set(true);
    this.error.set(null);
    this.session.logoutAll().subscribe({
      next: () => {
        this.signingOutAll.set(false);
        this.open.set(false);
        void this.router.navigateByUrl('/');
      },
      // The screen stays as it is: the other devices are still signed in, and the person should know.
      error: (error: unknown) => {
        this.signingOutAll.set(false);
        this.error.set(`Could not sign out of all devices. ${toApiError(error).message}`);
      },
    });
  }
}
