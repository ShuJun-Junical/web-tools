<script setup lang="ts">
import { ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui';
import { useToast } from '@/composables/useToast';
import { useToastMove } from '@/composables/useToastMove';

const { toasts, closeToast, handleToastLeft } = useToast();

// 宿主自身不会因队列变化 re-render（插槽依赖被 reka 的 ToastViewport 收集），
// 所以位移补间挂在队列签名上，不能用 onBeforeUpdate/onUpdated。
useToastMove('.toast-root', () => toasts.value.map((toast) => toast.id).join());
</script>

<template>
  <ToastProvider>
    <ToastViewport
      class="fixed right-6 bottom-6 z-50 flex w-full max-w-sm flex-col gap-2 outline-none"
    >
      <!--
        duration 传 Infinity：超时由 store 里的计时器负责，关掉 reka 自己的那份。
        after-leave 不是组件 emit，reka 的 Presence 是在弹窗节点上派发同名 DOM 事件、
        经属性透传落到 <li> 上被监听到的，它是唯一的出队时机。
      -->
      <ToastRoot
        v-for="(toast, index) in toasts"
        :key="toast.id"
        :open="toast.open"
        :duration="Number.POSITIVE_INFINITY"
        :type="toast.variant === 'error' ? 'foreground' : 'background'"
        :data-toast-id="toast.id"
        :style="{ order: -index }"
        class="toast-root rounded-lg px-4 py-3 text-sm text-white shadow-lg"
        :class="toast.variant === 'error' ? 'bg-destructive' : 'bg-primary'"
        @update:open="(open) => !open && closeToast(toast)"
        @after-leave="handleToastLeft(toast)"
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
