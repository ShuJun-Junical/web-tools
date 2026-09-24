// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, nextTick, ref, type Ref } from 'vue';
import { useToastMove } from '@/composables/useToastMove';

interface Item {
  id: number;
}

function mountMoveTracker(items: Ref<Item[]>) {
  return mount(
    defineComponent({
      setup() {
        useToastMove('.toast-root', items);
        return () => null;
      },
    })
  );
}

function stubTop(el: Element, top: number) {
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
}

function endTransformTransition(el: Element) {
  el.dispatchEvent(Object.assign(new Event('transitionend'), { propertyName: 'transform' }));
}

describe('useToastMove', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('弹窗被挤动时补位移过渡，过渡结束时摘掉过渡类', async () => {
    document.body.innerHTML = '<li class="toast-root" data-toast-id="1"></li>';
    const el = document.querySelector('.toast-root') as HTMLElement;
    stubTop(el, 100);

    const items = ref<Item[]>([{ id: 1 }]);
    const wrapper = mountMoveTracker(items);

    // 队列变更时先记录旧位置，渲染提交后才量到新位置。
    items.value = [{ id: 2 }, { id: 1 }];
    stubTop(el, 48);
    await nextTick();

    expect(el.classList.contains('toast-move')).toBe(true);
    expect(el.style.transform).toBe('');

    endTransformTransition(el);
    expect(el.classList.contains('toast-move')).toBe(false);

    wrapper.unmount();
  });

  it('位置没变的弹窗不加过渡', async () => {
    document.body.innerHTML = '<li class="toast-root" data-toast-id="1"></li>';
    const el = document.querySelector('.toast-root') as HTMLElement;
    stubTop(el, 100);

    const items = ref<Item[]>([{ id: 1 }]);
    const wrapper = mountMoveTracker(items);

    items.value = [{ id: 1 }, { id: 2 }];
    await nextTick();

    expect(el.classList.contains('toast-move')).toBe(false);

    wrapper.unmount();
  });
});
