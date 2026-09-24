<script setup lang="ts">
import { ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui';
import { TOAST_DURATION, useToast, type ToastItem } from '@/composables/useToast';
import { useToastMove } from '@/composables/useToastMove';

const { toasts, closeToast, handleToastLeft } = useToast();

// 宿主自身不会因队列变化 re-render（插槽依赖被 reka 的 ToastViewport 收集），
// 所以位移补间挂在队列签名上，不能用 onBeforeUpdate/onUpdated。
useToastMove('.toast-root', () => toasts.value.map((toast) => toast.id).join());

/** 出场动画放完才出队；入场动画结束时 open 还是 true，走到这里直接跳过 */
function onToastAnimationEnd(toast: ToastItem) {
  if (!toast.open) handleToastLeft(toast);
}
</script>

<template>
  <ToastProvider :duration="TOAST_DURATION">
    <ToastViewport
      class="fixed right-6 bottom-6 z-50 flex w-full max-w-sm flex-col gap-2 outline-none"
    >
      <!--
        超时、以及 hover/焦点/窗口失焦时的暂停都交给 reka（duration 由 ToastProvider 下发），
        store 只负责队列，不再自持计时器。
        出队听自己 CSS 动画的原生 animationend（toast-in 与 toast-out 都挂在同一个节点上，
        靠 open 区分），不再依赖 reka 内部 Presence 在节点上派发的 after-leave 自定义事件。
      -->
      <ToastRoot
        v-for="(toast, index) in toasts"
        :key="toast.id"
        :open="toast.open"
        :type="toast.variant === 'error' ? 'foreground' : 'background'"
        :data-toast-id="toast.id"
        :style="{ order: -index }"
        class="toast-root rounded-lg px-4 py-3 text-sm text-white shadow-lg"
        :class="toast.variant === 'error' ? 'bg-destructive' : 'bg-primary'"
        @update:open="(open) => !open && closeToast(toast)"
        @animationend="onToastAnimationEnd(toast)"
      >
        <ToastDescription>{{ toast.message }}</ToastDescription>
      </ToastRoot>
    </ToastViewport>
  </ToastProvider>
</template>

<style>
.toast-root[data-state='open'] {
  animation: toast-in 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-root[data-state='closed'] {
  animation: toast-out 250ms ease-in forwards;
}

/* 与 toast-in 同曲线同时长：两者都在写 transform，同帧冲突时 CSS animation 会盖过 transition，
   只有曲线一致才能保证"新弹窗上浮"和"旧弹窗上移"同步、中途不互相遮挡 */
.toast-move {
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 入场位移 40px 是按单行弹窗（高 44px）和槽位间距（gap-2 = 8px）定的：
   它小于弹窗高度，起手几帧会和正在上移的上一条最多重叠 4px，同帧 opacity 接近 0 所以看不出来。
   改字号、padding 或 gap 后要复核这个数（位移 ≥ 弹窗高度即可全程不重叠） */
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
}

@keyframes toast-out {
  to {
    opacity: 0;
  }
}
</style>
