import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Toasts } from '../../core/notifications/toasts';
import { ToastOutlet } from './toast-outlet';

describe('ToastOutlet', () => {
  let fixture: ComponentFixture<ToastOutlet>;
  let toasts: Toasts;
  let root: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [ToastOutlet] }).compileComponents();
    toasts = TestBed.inject(Toasts);
    fixture = TestBed.createComponent(ToastOutlet);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  const polite = () => root.querySelector('[role="status"]') as HTMLElement;
  const assertive = () => root.querySelector('[role="alert"]') as HTMLElement;

  it('has both live regions in the page before the first message arrives', () => {
    // A live region that appears together with its content is often not announced.
    expect(polite()).not.toBeNull();
    expect(assertive()).not.toBeNull();
    expect(root.querySelectorAll('app-toast')).toHaveLength(0);
  });

  it('announces success and info politely and errors at once', () => {
    toasts.success('Profile saved.');
    toasts.info('Signed out.');
    toasts.error('Could not save.');
    fixture.detectChanges();

    expect(polite().textContent).toContain('Profile saved.');
    expect(polite().textContent).toContain('Signed out.');
    expect(polite().textContent).not.toContain('Could not save.');
    expect(assertive().textContent).toContain('Could not save.');
  });

  it('gives every dismiss button a name', () => {
    toasts.success('Profile saved.');
    toasts.error('Could not save.');
    fixture.detectChanges();

    const buttons = Array.from(root.querySelectorAll('button'));
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBe('Dismiss notification');
    }
  });

  it('removes a message when its dismiss button is pressed', () => {
    toasts.error('Could not save.');
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    expect(toasts.list()).toEqual([]);
    expect(root.querySelectorAll('app-toast')).toHaveLength(0);
  });

  it('removes a success message by itself after a while', () => {
    toasts.success('Profile saved.');
    fixture.detectChanges();
    expect(root.querySelectorAll('app-toast')).toHaveLength(1);

    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();

    expect(root.querySelectorAll('app-toast')).toHaveLength(0);
  });

  it('colours a message by its kind', () => {
    toasts.success('Profile saved.');
    toasts.error('Could not save.');
    fixture.detectChanges();

    expect(polite().querySelector('app-toast')?.className).toContain('bg-emerald-50');
    expect(assertive().querySelector('app-toast')?.className).toContain('bg-red-50');
  });
});
