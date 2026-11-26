import { Component, computed, input } from '@angular/core';

/** Brand mark + wordmark. The tag shape doubles as the favicon. */
@Component({
  selector: 'app-logo',
  host: { class: 'inline-flex items-center gap-2' },
  template: `
    <svg class="size-9 shrink-0" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="currentColor" class="text-brand-600" />
      <path
        fill="#fff"
        d="M32 12a4 4 0 0 1 2.83 1.17l16 16a4 4 0 0 1 0 5.66l-14 14a4 4 0 0 1-5.66 0l-16-16A4 4 0 0 1 14 30.34V16a4 4 0 0 1 4-4h14Zm-9 9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      />
    </svg>
    <span [class]="wordmarkClass()">{{ name() }}</span>
  `,
})
export class Logo {
  readonly name = input('ResaleMarket');
  /**
   * For the header, where a signed-in person's row (heart, "Post ad", account) leaves room for only the mark on the narrowest phones:
   * below 360px the wordmark is hidden from the eye but stays readable to a screen reader.
   */
  readonly compact = input(false);

  protected readonly wordmarkClass = computed(() =>
    this.compact()
      ? 'text-xl font-bold tracking-tight text-slate-900 max-[419px]:text-base max-[359px]:sr-only'
      : 'text-xl font-bold tracking-tight text-slate-900 max-[359px]:text-base',
  );
}
