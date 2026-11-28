import { Component, computed, inject, input, output } from '@angular/core';
import { Toast, ToastKind, Toasts } from '../../core/notifications/toasts';

const KIND_CLASSES: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-slate-300 bg-white text-slate-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

/** One message with its dismiss button. */
@Component({
  selector: 'app-toast',
  host: {
    class: 'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 text-sm shadow-lg',
    '[class]': 'classes()',
  },
  template: `
    <p class="min-w-0 flex-1 break-words">{{ toast().message }}</p>
    <button
      type="button"
      class="-m-1 grid size-8 shrink-0 place-items-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
      aria-label="Dismiss notification"
      (click)="dismissed.emit(toast().id)"
    >
      <svg
        viewBox="0 0 20 20"
        class="size-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  `,
})
export class ToastItem {
  readonly toast = input.required<Toast>();
  readonly dismissed = output<number>();

  protected readonly classes = computed(() => KIND_CLASSES[this.toast().kind]);
}

/**
 * Shows the messages of `Toasts`, bottom right on larger screens and along the bottom on phones. It is part of the app shell
 * and always in the page, with its two live regions already there when the first message arrives (a region that appears
 * together with its content is often not announced): success and info are read out politely, errors at once.
 */
@Component({
  selector: 'app-toasts',
  imports: [ToastItem],
  host: {
    class:
      'pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:justify-end',
  },
  template: `
    <div class="flex w-full flex-col gap-2 sm:max-w-sm">
      <div role="status" class="flex flex-col gap-2">
        @for (toast of polite(); track toast.id) {
          <app-toast [toast]="toast" (dismissed)="dismiss($event)" />
        }
      </div>
      <div role="alert" class="flex flex-col gap-2">
        @for (toast of alerts(); track toast.id) {
          <app-toast [toast]="toast" (dismissed)="dismiss($event)" />
        }
      </div>
    </div>
  `,
})
export class ToastOutlet {
  private readonly toasts = inject(Toasts);

  protected readonly polite = computed(() =>
    this.toasts.list().filter((toast) => toast.kind !== 'error'),
  );
  protected readonly alerts = computed(() =>
    this.toasts.list().filter((toast) => toast.kind === 'error'),
  );

  protected dismiss(id: number): void {
    this.toasts.dismiss(id);
  }
}
