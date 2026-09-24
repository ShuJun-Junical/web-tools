import { nextTick, ref } from 'vue';

const message = ref('');
const variant = ref<'success' | 'error'>('success');
const open = ref(false);

export function useToast() {
  function showToast(value: string, type: 'success' | 'error' = 'error') {
    message.value = value;
    variant.value = type;
    open.value = false;
    nextTick(() => {
      open.value = true;
    });
  }

  return { message, open, variant, showToast };
}
