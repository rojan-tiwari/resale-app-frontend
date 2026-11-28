import { Service, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'error';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
}

/** How long a success or info message stays. Errors stay until they are dismissed: they may need to be read twice or acted on. */
export const TOAST_DISMISS_AFTER_MS = 8000;

/** No more than this many messages at once; a new one pushes the oldest out. */
const MAX_VISIBLE = 4;

/**
 * Short messages about something that just happened, which are not tied to one form field: "Profile saved", "You were signed
 * out". Anything the person must act on belongs next to the thing it is about (a form error, an inline alert), not here.
 *
 * The messages are shown by `ToastOutlet` (in the app shell), which announces them to screen readers. Success and info
 * messages go away by themselves after {@link TOAST_DISMISS_AFTER_MS}; errors stay until dismissed. Every message can be
 * dismissed.
 */
@Service()
export class Toasts {
  private readonly items = signal<readonly Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  /** The messages on screen, oldest first. */
  readonly list = this.items.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  dismiss(id: number): void {
    this.stopTimer(id);
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string): void {
    // The same message twice in a row (a double click) is one message.
    if (this.items().some((toast) => toast.kind === kind && toast.message === message)) {
      return;
    }
    const id = this.nextId++;
    const kept = this.items().slice(-(MAX_VISIBLE - 1));
    this.items()
      .filter((toast) => !kept.includes(toast))
      .forEach((toast) => this.stopTimer(toast.id));
    this.items.set([...kept, { id, kind, message }]);

    if (kind !== 'error') {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), TOAST_DISMISS_AFTER_MS),
      );
    }
  }

  private stopTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
