import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast, __resetToastsForTests } from '@/composables/useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetToastsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flips open=false on the proxied item after the auto-close timer fires', () => {
    const { showToast, toasts } = useToast();

    showToast('hello', 'success');
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].open).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(toasts.value[0].open).toBe(false);
  });

  it('closes the existing item in place when the same message is triggered again', () => {
    const { showToast, toasts } = useToast();

    showToast('hello', 'success');
    const item = toasts.value[0];

    showToast('hello', 'success');
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0]).toBe(item);
    expect(toasts.value[0].open).toBe(false);
  });

  it('enqueues a fresh identical toast once the repeated one has left the DOM', () => {
    const { showToast, toasts, handleToastLeft } = useToast();

    showToast('hello', 'success');
    showToast('hello', 'success');
    const repeated = toasts.value[0];

    handleToastLeft(repeated);
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0]).not.toBe(repeated);
    expect(toasts.value[0]).toMatchObject({ message: 'hello', variant: 'success', open: true });
  });

  it('gives the re-enqueued toast its own auto-close window', () => {
    const { showToast, toasts, handleToastLeft } = useToast();

    showToast('hello', 'success');
    vi.advanceTimersByTime(2000);
    showToast('hello', 'success');
    expect(toasts.value[0].open).toBe(false);

    handleToastLeft(toasts.value[0]);
    vi.advanceTimersByTime(2000);
    expect(toasts.value[0].open).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(toasts.value[0].open).toBe(false);
  });

  it('keeps a single pending repeat when triggered again while the toast is closing', () => {
    const { showToast, toasts, handleToastLeft } = useToast();

    showToast('hello', 'success');
    showToast('hello', 'success');
    showToast('hello', 'success');

    const closing = toasts.value[0];
    expect(toasts.value).toHaveLength(1);
    expect(closing.open).toBe(false);

    handleToastLeft(closing);
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].open).toBe(true);
  });

  it('treats different variants as independent toasts', () => {
    const { showToast, toasts } = useToast();

    showToast('hello', 'success');
    showToast('hello', 'error');
    expect(toasts.value).toHaveLength(2);
  });

  it('handleToastLeft drops the item from the array', () => {
    const { showToast, toasts, handleToastLeft } = useToast();

    showToast('hello', 'success');
    const item = toasts.value[0];
    handleToastLeft(item);
    expect(toasts.value).toHaveLength(0);

    // 出队时它的计时器也要一起停掉，不能留个空转的 timeout
    vi.advanceTimersByTime(3000);
    expect(toasts.value).toHaveLength(0);
  });

  it('mints unique ids for toasts created in the same tick', () => {
    const { showToast, toasts } = useToast();

    showToast('hello', 'success');
    showToast('world', 'error');

    const ids = toasts.value.map((toast) => toast.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
