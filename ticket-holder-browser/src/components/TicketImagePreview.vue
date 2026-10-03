<script setup lang="ts">
import { ref, watch } from 'vue'
import { generateTicketImage, downloadImage } from '../utils/ticketImageGenerator'
import type { ParsedData } from '../utils/xmlParser'

interface Props {
  ticketData: ParsedData
}

const props = defineProps<Props>()

const imageUrl = ref<string>('')
const generating = ref(false)
const error = ref<string | null>(null)
const useTemplate = ref(true)
const templateUrl = ref('/ticket-template.svg')
const hideIdNumber = ref(false)

// 可用模板列表
const templates = [
  { label: '经典样式', value: '/ticket-template.svg' },
  { label: '现代样式', value: '/templates/modern.svg' },
  { label: '红票', value: '/templates/red.svg' }
]

// 监听 ticketData 变化，自动生成图片
watch(() => props.ticketData, async (newData) => {
  if (newData) {
    await generateImage()
  }
}, { immediate: true })

// 监听模板选择和隐私设置变化，重新生成
watch([useTemplate, templateUrl, hideIdNumber], async () => {
  if (props.ticketData) {
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
    const dataUrl = await generateTicketImage(props.ticketData, options)
    imageUrl.value = dataUrl
  } catch (err) {
    error.value = err instanceof Error ? err.message : '生成图片失败'
  } finally {
    generating.value = false
  }
}

function handleDownload() {
  if (!imageUrl.value) return
  
  const ticketNumber = props.ticketData.ElectronicInvoiceRailwayETicketNumber || 'ticket'
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
