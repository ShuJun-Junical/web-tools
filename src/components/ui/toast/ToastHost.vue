<script setup lang="ts">
import { ToastDescription, ToastProvider, ToastRoot, ToastViewport } from 'reka-ui'
import { useToast } from '@/composables/useToast'

const { message, open, variant } = useToast()
</script>

<template>
  <ToastProvider :duration="2500">
    <ToastRoot v-model:open="open" :type="variant === 'error' ? 'foreground' : 'background'" class="rounded-lg px-4 py-3 text-sm text-white shadow-lg" :class="variant === 'error' ? 'bg-destructive' : 'bg-primary'">
      <ToastDescription>{{ message }}</ToastDescription>
    </ToastRoot>
    <ToastViewport class="fixed right-6 bottom-6 z-50 flex w-full max-w-sm flex-col gap-2 outline-none" />
  </ToastProvider>
</template>
