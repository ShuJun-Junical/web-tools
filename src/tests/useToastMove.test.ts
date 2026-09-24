// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { useToastMove } from '@/composables/useToastMove';

function mountMoveTracker(signature: { value: string }) {
  return mount(
    defineComponent({
      setup() {
        useToastMove('.toast-root', () => signature.value);
        return () => null;
      },
    })
  );
}

function stubTop(el: Element, top: number) {
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
}

describe('useToastMove', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('补间被挤动的弹窗：从旧位置过渡到新位置', async () => {
    document.body.innerHTML = '<li class="toast-root" data-toast-id="a-0"></li>';
    const el = document.querySelector('.toast-root') as HTMLElement;
    stubTop(el, 100);

    const signature = ref('a-0');
    const wrapper = mountMoveTracker(signature);

    // 队列变更时先记录旧位置，渲染提交后才量到新位置。
    signature.value = 'a-0,b-0';
    stubTop(el, 48);
    await nextTick();

    expect(el.classList.contains('toast-move')).toBe(true);
    expect(el.style.transform).toBe('');

    wrapper.unmount();
  });

  it('位置没变的弹窗不加过渡', async () => {
    document.body.innerHTML = '<li class="toast-root" data-toast-id="a-0"></li>';
    const el = document.querySelector('.toast-root') as HTMLElement;
    stubTop(el, 100);

    const signature = ref('a-0');
    const wrapper = mountMoveTracker(signature);

    signature.value = 'a-0,b-0';
    await nextTick();

    expect(el.classList.contains('toast-move')).toBe(false);

    wrapper.unmount();
  });
});
