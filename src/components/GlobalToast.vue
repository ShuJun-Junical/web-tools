<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { message, variant } = useToast()
</script>

<template>
  <div
    v-if="message"
    :role="variant === 'error' ? 'alert' : 'status'"
    :aria-live="variant === 'error' ? 'assertive' : 'polite'"
    class="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg"
    :class="variant === 'error' ? 'bg-destructive' : 'bg-primary'"
  >
    {{ message }}
  </div>
</template>
