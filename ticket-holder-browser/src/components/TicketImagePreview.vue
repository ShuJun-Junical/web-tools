<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  generateTicketImage,
  downloadImage,
  TICKET_PLACEHOLDERS,
  type PlaceholderKey,
} from '../utils/ticketImageGenerator'
import { text, type Ticket } from '../types/ticket'

interface Props {
  ticket: Ticket
}

const props = defineProps<Props>()

const imageUrl = ref<string>('')
const generating = ref(false)
const error = ref<string | null>(null)
const useTemplate = ref(true)
const templateUrl = ref('/ticket-template.svg')
const hideIdNumber = ref(false)

// 可用模板列表。red.svg 尚未从 design/red.ai 导出，选中它会回退到 Canvas 绘制。
const templates = [
  { label: '经典样式', value: '/ticket-template.svg' },
  { label: '现代样式', value: '/templates/modern.svg' },
  { label: '红票（待导出）', value: '/templates/red.svg' }
]

/**
 * 可用占位符清单
 *
 * 直接渲染自 `TICKET_PLACEHOLDERS`——和模板渲染器读的是同一个常量，
 * 所以做模板时看到的清单永远不过期。
 */
const placeholderList = computed(() =>
  (Object.keys(TICKET_PLACEHOLDERS) as PlaceholderKey[]).map((key) => ({
    key,
    label: TICKET_PLACEHOLDERS[key].label,
  }))
)

// 模板里不能直接写 `{{` 字面量——Vue 会当成插值开头，所以从脚本注入
const placeholderSyntax = '{{key}}'

// 监听 ticket 变化，自动生成图片
watch(() => props.ticket, async (newData) => {
  if (newData) {
    await generateImage()
  }
}, { immediate: true })

// 监听模板选择和隐私设置变化，重新生成
watch([useTemplate, templateUrl, hideIdNumber], async () => {
  if (props.ticket) {
    await generateImage()
  }
})

async function generateImage() {
  generating.value = true
  error.value = null
  
  try {
    const options = {
      ...(useTemplate.value ? { templateUrl: templateUrl.value } : {}),
      hideIdNumber: hideIdNumber.value
    }
    const dataUrl = await generateTicketImage(props.ticket, options)
    imageUrl.value = dataUrl
  } catch (err) {
    error.value = err instanceof Error ? err.message : '生成图片失败'
  } finally {
    generating.value = false
  }
}

function handleDownload() {
  if (!imageUrl.value) return
  
  const ticketNumber = text(props.ticket.invoiceNumber) || 'ticket'
  downloadImage(imageUrl.value, `${ticketNumber}.png`)
}
</script>

<template>
  <div class="ticket-image-preview">
    <div class="preview-header">
      <h3>车票图片</h3>
      <div class="header-actions">
        <label class="template-toggle">
          <input type="checkbox" v-model="useTemplate" />
          使用 SVG 模板
        </label>
        <select 
          v-if="useTemplate" 
          v-model="templateUrl" 
          class="template-select"
        >
          <option 
            v-for="tpl in templates" 
            :key="tpl.value" 
            :value="tpl.value"
          >
            {{ tpl.label }}
          </option>
        </select>
        <label class="template-toggle">
          <input type="checkbox" v-model="hideIdNumber" />
          隐藏身份证号
        </label>
        <button
          v-if="imageUrl && !generating"
          @click="handleDownload"
          class="download-button"
        >
          下载图片
        </button>
      </div>
    </div>

    <div v-if="generating" class="loading">
      生成图片中...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="imageUrl" class="preview-container">
      <img :src="imageUrl" alt="车票图片" class="ticket-image" />
      <p class="image-info">
        尺寸: 85.6mm × 54mm @ 300dpi (1011 × 638 像素)
        <span v-if="useTemplate" class="template-badge">SVG 模板</span>
        <span v-else class="template-badge canvas-badge">Canvas 绘制</span>
      </p>
    </div>

    <details v-if="useTemplate" class="placeholder-help">
      <summary>可用占位符（{{ placeholderList.length }} 个）</summary>
      <p class="placeholder-note">
        在 SVG 模板里写 <code>{{ placeholderSyntax }}</code> 引用。写错会在上方直接报错并指出正确写法。
      </p>
      <table class="placeholder-table">
        <tbody>
          <tr v-for="p in placeholderList" :key="p.key">
            <td class="ph-key">{{ p.key }}</td>
            <td class="ph-label">{{ p.label }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>
</template>

<style scoped>
.ticket-image-preview {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.preview-header h3 {
  margin: 0;
  color: #2c3e50;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.template-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #555;
}

.template-toggle input[type="checkbox"] {
  cursor: pointer;
}

.template-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  background: white;
  color: #555;
}

.template-select:hover {
  border-color: #999;
}

.download-button {
  padding: 0.5rem 1rem;
  background: #9b59b6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s;
  white-space: nowrap;
}

.download-button:hover {
  background: #8e44ad;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #7f8c8d;
}

.error {
  background: #ffe5e5;
  color: #c0392b;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #e74c3c;
}

.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ticket-image {
  max-width: 100%;
  height: auto;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.image-info {
  margin-top: 1rem;
  color: #7f8c8d;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.template-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.canvas-badge {
  background: #f3e5f5;
  color: #7b1fa2;
}

.placeholder-help {
  margin-top: 1.25rem;
  font-size: 0.85rem;
  color: #5a6c7d;
}

.placeholder-help summary {
  cursor: pointer;
  color: #7f8c8d;
  user-select: none;
}

.placeholder-note {
  margin: 0.75rem 0 0.5rem;
  color: #95a5a6;
}

.placeholder-note code {
  background: #f4f6f8;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
}

.placeholder-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.placeholder-table td {
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid #f2f4f6;
  vertical-align: top;
}

.ph-key {
  width: 15rem;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #2c3e50;
  word-break: break-all;
}

.ph-label {
  color: #7f8c8d;
}

@media (max-width: 640px) {
  .ticket-image-preview {
    padding: 1.5rem;
  }
  
  .preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>
