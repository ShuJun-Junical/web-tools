import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'

export function useClipboardActions() {
  const { copy, copyPending, isSupported } = useClipboard()
  const { showToast } = useToast()
  const clipboardError = ref('')

  async function copyText(value: string, successMessage = '已复制到剪贴板。') {
    clipboardError.value = ''
    if (!isSupported.value) {
      clipboardError.value = '当前浏览器或页面环境不支持复制。'
      return false
    }

    try {
      await copy(value)
      showToast(successMessage, 'success')
      return true
    } catch {
      clipboardError.value = '复制失败，请检查浏览器的剪贴板权限。'
      return false
    }
  }

  async function readText() {
    clipboardError.value = ''
    if (!navigator.clipboard?.readText) {
      clipboardError.value = '当前浏览器或页面环境不支持读取剪贴板。'
      return null
    }

    try {
      return await navigator.clipboard.readText()
    } catch {
      clipboardError.value = '读取剪贴板失败，请检查浏览器权限。'
      return null
    }
  }

  return { copyPending, clipboardError, copyText, readText }
}
