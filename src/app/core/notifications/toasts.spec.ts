import { TestBed } from '@angular/core/testing';
import { TOAST_DISMISS_AFTER_MS, Toasts } from './toasts';

describe('Toasts', () => {
  let toasts: Toasts;

  beforeEach(() => {
    vi.useFakeTimers();
    toasts = TestBed.inject(Toasts);
  });

  afterEach(() => vi.useRealTimers());

  const messages = () => toasts.list().map((toast) => `${toast.kind}: ${toast.message}`);

  it('starts with nothing to show', () => {
    expect(toasts.list()).toEqual([]);
  });

  it('shows messages with their kind, oldest first', () => {
    toasts.success('Saved.');
    toasts.info('Heads up.');
    toasts.error('Broken.');

    expect(messages()).toEqual(['success: Saved.', 'info: Heads up.', 'error: Broken.']);
  });

  it('gives every message its own id', () => {
    toasts.success('One');
    toasts.success('Two');

    const ids = toasts.list().map((toast) => toast.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('removes success and info messages by themselves after a while, and not before', () => {
    toasts.success('Saved.');
    toasts.info('Heads up.');

    vi.advanceTimersByTime(TOAST_DISMISS_AFTER_MS - 1);
    expect(messages()).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(messages()).toEqual([]);
  });

  it('keeps an error until it is dismissed: it may need to be read twice', () => {
    toasts.error('Broken.');

    vi.advanceTimersByTime(TOAST_DISMISS_AFTER_MS * 10);

    expect(messages()).toEqual(['error: Broken.']);
  });

  it('dismisses one message and leaves the others alone', () => {
    toasts.error('First');
    toasts.error('Second');
    const [first] = toasts.list();

    toasts.dismiss(first.id);

    expect(messages()).toEqual(['error: Second']);
  });

  it('dismissing an unknown message does nothing', () => {
    toasts.error('Broken.');

    toasts.dismiss(9999);

    expect(messages()).toEqual(['error: Broken.']);
  });

  it('shows the same message once, so a double click does not stack it', () => {
    toasts.success('Saved.');
    toasts.success('Saved.');

    expect(messages()).toEqual(['success: Saved.']);
  });

  it('allows the same words in another kind', () => {
    toasts.success('Done.');
    toasts.error('Done.');

    expect(messages()).toHaveLength(2);
  });

  it('shows a message again after the earlier one was dismissed', () => {
    toasts.error('Broken.');
    toasts.dismiss(toasts.list()[0].id);

    toasts.error('Broken.');

    expect(messages()).toEqual(['error: Broken.']);
  });

  it('keeps at most four messages and drops the oldest', () => {
    for (const word of ['a', 'b', 'c', 'd', 'e']) {
      toasts.error(word);
    }

    expect(messages()).toEqual(['error: b', 'error: c', 'error: d', 'error: e']);
  });

  it('a message that was pushed out cannot dismiss a newer one later', () => {
    toasts.success('old');
    for (const word of ['b', 'c', 'd']) {
      toasts.error(word);
    }
    toasts.error('newest'); // pushes "old" out; its timer must be gone

    vi.advanceTimersByTime(TOAST_DISMISS_AFTER_MS * 2);

    expect(messages()).toEqual(['error: b', 'error: c', 'error: d', 'error: newest']);
  });
});
