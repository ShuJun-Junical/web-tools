import { ref } from 'vue'

const message = ref('')
const variant = ref<'success' | 'error'>('success')
let timer: ReturnType<typeof setTimeout> | undefined

export function useToast() {
  function showToast(value: string, type: 'success' | 'error' = 'error') {
    message.value = value
    variant.value = type
    clearTimeout(timer)
    timer = setTimeout(() => {
      message.value = ''
    }, 2500)
  }

  return { message, variant, showToast }
}
