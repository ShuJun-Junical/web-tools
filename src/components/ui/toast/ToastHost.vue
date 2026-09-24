<script setup lang="ts">
import { ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui';
import { TOAST_DURATION, useToast, type ToastItem } from '@/composables/useToast';
import { useToastMove } from '@/composables/useToastMove';

const { toasts, closeToast, handleToastLeft } = useToast();

// 宿主自身不会因队列变化 re-render（插槽依赖被 reka 的 ToastViewport 收集），
// 所以位移补间挂在队列变化上，不能用 onBeforeUpdate/onUpdated。
useToastMove('.toast-root', toasts);

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

/* 与 toast-in 同曲线同时长，保证"新弹窗上浮"和"旧弹窗上移"同步；
   两者分别写 transform 和 translate，同帧是叠加关系而不是互相覆盖 */
.toast-move {
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 入场位移取"一条弹窗高度 + 槽位间距"（单行弹窗高 44px，gap-2 = 8px），
   正好等于新弹窗把上一条挤上去的距离，所以入场全程间距恒定、不会互相遮挡；
   改字号、padding 或 gap 后要一起复核这个数。
   用 translate 而不是 transform，避免和位移补间抢同一个属性 */
@keyframes toast-in {
  from {
    opacity: 0;
    translate: 0 52px;
  }
}

@keyframes toast-out {
  to {
    opacity: 0;
  }
}
</style>
