import { beforeEach, describe, expect, it } from 'vitest';
import { useToast, __resetToastsForTests } from '@/composables/useToast';

describe('useToast', () => {
  beforeEach(() => {
    __resetToastsForTests();
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
    expect(toasts.value[0].id).not.toBe(repeated.id);
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
  });

  it('mints unique ids for toasts created in the same tick', () => {
    const { showToast, toasts } = useToast();

    showToast('hello', 'success');
    showToast('world', 'error');

    const ids = toasts.value.map((toast) => toast.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
