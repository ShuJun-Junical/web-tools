<script setup lang="ts">
import { ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui';
import { useToast } from '@/composables/useToast';

const { toasts } = useToast();
</script>

<template>
  <ToastProvider>
    <ToastViewport
      class="fixed right-6 bottom-6 z-50 flex w-full max-w-sm flex-col gap-2 outline-none"
    >
      <TransitionGroup name="toast">
        <ToastRoot
          v-for="toast in toasts"
          :key="toast.id"
          :type="toast.variant === 'error' ? 'foreground' : 'background'"
          class="rounded-lg px-4 py-3 text-sm text-white shadow-lg"
          :class="toast.variant === 'error' ? 'bg-destructive' : 'bg-primary'"
        >
          <ToastDescription>{{ toast.message }}</ToastDescription>
        </ToastRoot>
      </TransitionGroup>
    </ToastViewport>
  </ToastProvider>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
