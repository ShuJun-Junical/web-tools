import { watch } from 'vue';

const MOVE_DURATION = 400;

function measure(selector: string) {
  const positions = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const id = el.dataset.toastId;
    if (id) positions.set(id, el.getBoundingClientRect());
  });
  return positions;
}

/**
 * 弹窗队列 signature 变化时，让留在 DOM 里的弹窗做 FLIP 位移补间。
 * 弹窗由 reka-ui 以 Teleport 追加到 viewport，DOM 顺序恒为创建顺序，
 * 新弹窗入队后旧弹窗的布局位置会上移，这里补上过渡。
 */
export function useToastMove(selector: string, signature: () => string) {
  let positions = new Map<string, DOMRect>();

  // 队列变更发生在 DOM 更新之前，用 sync 抢在渲染前记录旧位置。
  watch(
    signature,
    () => {
      positions = measure(selector);
    },
    { flush: 'sync' }
  );

  // 本次更新提交后再量新位置，给被挤动的弹窗补位移过渡。
  watch(
    signature,
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
        window.setTimeout(() => el.classList.remove('toast-move'), MOVE_DURATION);
      });
    },
    { flush: 'post' }
  );
}
