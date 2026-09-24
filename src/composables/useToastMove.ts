import { watch, type Ref } from 'vue';

function measure(selector: string) {
  const positions = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const id = el.dataset.toastId;
    if (id) positions.set(id, el.getBoundingClientRect());
  });
  return positions;
}

/**
 * 弹窗队列变化时，让留在 DOM 里的弹窗做 FLIP 位移补间。
 * 弹窗由 reka-ui 以 Teleport 渲染进 viewport，DOM 顺序和视觉顺序并不一致，
 * 队列一变旧弹窗的布局位置就会动，这里按 id 补上位移过渡。
 */
export function useToastMove(selector: string, items: Ref<{ id: number }[]>) {
  const ids = () => items.value.map((item) => item.id).join();
  let positions = new Map<string, DOMRect>();

  // 队列变更发生在 DOM 更新之前，用 sync 抢在渲染前记录旧位置。
  watch(
    ids,
    () => {
      positions = measure(selector);
    },
    { flush: 'sync' }
  );

  // 本次更新提交后再量新位置，给被挤动的弹窗补位移过渡。
  watch(
    ids,
    () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        const id = el.dataset.toastId;
        const previous = id ? positions.get(id) : undefined;
        if (!previous) return;

        const dy = previous.top - el.getBoundingClientRect().top;
        if (Math.abs(dy) < 0.5) return;

        el.style.transform = `translateY(${dy}px)`;
        el.getBoundingClientRect();
        el.classList.add('toast-move');
        el.style.transform = '';
        // 过渡时长写在 .toast-move 的 CSS 里，结束时自己摘掉类，不在 JS 里重复一份
        const finish = (event: TransitionEvent) => {
          if (event.propertyName !== 'transform') return;
          el.removeEventListener('transitionend', finish);
          el.classList.remove('toast-move');
        };
        el.addEventListener('transitionend', finish);
      });
    },
    { flush: 'post' }
  );
}
