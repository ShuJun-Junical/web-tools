<script setup lang="ts">
import { ref, computed } from 'vue'
import { extractXmlFromOFD } from '../utils/ofdParser'
import { extractXmlFromPDF } from '../utils/pdfParser'
import { parseXBRL } from '../utils/xmlParser'
import {
  departureWeekday,
  formatDepartureAt,
  ticketFieldRows,
  toTicket,
  type TicketParseResult,
} from '../types/ticket'
import TicketImagePreview from './TicketImagePreview.vue'

const selectedFile = ref<File | null>(null)
const parsing = ref(false)
const error = ref<string | null>(null)
const result = ref<TicketParseResult | null>(null)
const xmlFileName = ref<string | null>(null)
/** 默认隐藏乘车凭证用不上的字段（税额、拼音、企业专票信息） */
const showAllFields = ref(false)

/** 领域模型，供车票图片渲染与业务逻辑使用 */
const ticket = computed(() => (result.value ? toTicket(result.value.ticket) : null))

/** 按中文标签展示的非空字段，比直接怼 JSON 直观 */
const fieldRows = computed(() =>
  result.value
    ? ticketFieldRows(result.value.ticket, { includeHidden: showAllFields.value })
    : []
)

/** 架构外的意外元素，正常情况下为空 */
const extraEntries = computed(() => Object.entries(result.value?.extra ?? {}))

/** 发车时刻（绝对时间），排序 / 分组用 */
const departureAtText = computed(() => {
  const at = ticket.value?.departureAt
  if (!at) return ''
  return `${formatDepartureAt(at)} ${departureWeekday(at)}`.trim()
})

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]!
    // 清空之前的结果
    result.value = null
    error.value = null
    xmlFileName.value = null
  }
}

async function parseFile() {
  if (!selectedFile.value) {
    error.value = '请先选择文件'
    return
  }
  
  parsing.value = true
  error.value = null
  result.value = null
  xmlFileName.value = null
  
  try {
    const fileName = selectedFile.value.name.toLowerCase()
    let xmlContent: string
    let extractedFileName: string
    
    if (fileName.endsWith('.ofd')) {
      // 解析 OFD 文件
      const ofdResult = await extractXmlFromOFD(selectedFile.value)
      xmlContent = ofdResult.xmlContent
      extractedFileName = ofdResult.fileName
    } else if (fileName.endsWith('.pdf')) {
      // 解析 PDF 文件
      const pdfResult = await extractXmlFromPDF(selectedFile.value)
      xmlContent = pdfResult.xmlContent
      extractedFileName = pdfResult.fileName
    } else {
      throw new Error('不支持的文件格式，仅支持 .ofd 和 .pdf 文件')
    }
    
    // 解析 XML
    const parsed = parseXBRL(xmlContent)
    
    result.value = parsed
    xmlFileName.value = extractedFileName
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解析失败'
  } finally {
    parsing.value = false
  }
}

function downloadResult() {
  if (!result.value) return

  // 导出规范字段；架构外元素一并带上，方便排查
  const json = JSON.stringify(result.value, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${xmlFileName.value || 'result'}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="file-uploader">
    <div class="upload-section">
      <h2>铁路电子客票解析器</h2>
      <p class="description">上传 OFD 或 PDF 格式的电子发票文件，自动提取并解析附件中的 XML 数据</p>
      
      <div class="file-input-wrapper">
        <input
          type="file"
          accept=".ofd,.pdf"
          @change="handleFileSelect"
          id="file-input"
        />
        <label for="file-input" class="file-label">
          {{ selectedFile ? selectedFile.name : '选择文件 (.ofd 或 .pdf)' }}
        </label>
      </div>
      
      <button
        @click="parseFile"
        :disabled="!selectedFile || parsing"
        class="parse-button"
      >
        {{ parsing ? '解析中...' : '开始解析' }}
      </button>
    </div>
    
    <div v-if="error" class="error-message">
      ⚠️ {{ error }}
    </div>
    
    <TicketImagePreview v-if="ticket" :ticket="ticket" />
    
    <div v-if="result" class="result-section">
      <div class="result-header">
        <h3>解析结果</h3>
        <div class="result-info">
          <span class="xml-filename">📄 {{ xmlFileName }}</span>
          <button @click="downloadResult" class="download-button">
            下载 JSON
          </button>
        </div>
      </div>

      <p v-if="departureAtText" class="departure-hint">
        🕐 发车时刻 <strong>{{ departureAtText }}</strong>（北京时间，UTC+8）
      </p>

      <h4 class="section-title">
        字段明细
        <label class="field-toggle">
          <input type="checkbox" v-model="showAllFields" />
          显示全部字段
        </label>
      </h4>
      <table class="field-table">
        <tbody>
          <tr v-for="row in fieldRows" :key="row.name" :class="{ 'is-hidden-field': row.hidden }">
            <th scope="row">{{ row.label }}</th>
            <td class="field-name">{{ row.name }}</td>
            <td class="field-value">{{ row.value }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="extraEntries.length" class="extra-note">
        以下字段不在铁路电子客票架构中，原样保留：
        <span v-for="[key, value] in extraEntries" :key="key" class="extra-chip">
          {{ key }} = {{ value }}
        </span>
      </div>

      <h4 class="section-title">原始 JSON</h4>
      <pre class="result-content">{{ JSON.stringify(result.ticket, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.file-uploader {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.upload-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

h2 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 1.75rem;
}

.description {
  color: #7f8c8d;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

.file-input-wrapper {
  margin-bottom: 1rem;
}

#file-input {
  display: none;
}

.file-label {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: #ecf0f1;
  border: 2px dashed #bdc3c7;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}

.file-label:hover {
  background: #e0e6e8;
  border-color: #95a5a6;
}

.parse-button {
  width: 100%;
  padding: 0.875rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.parse-button:hover:not(:disabled) {
  background: #2980b9;
}

.parse-button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.error-message {
  background: #ffe5e5;
  color: #c0392b;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border-left: 4px solid #e74c3c;
}

.result-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.result-header h3 {
  margin: 0;
  color: #2c3e50;
}

.result-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.xml-filename {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.download-button {
  padding: 0.5rem 1rem;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.3s;
}

.download-button:hover {
  background: #229954;
}

.result-content {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  overflow-x: auto;
  max-height: 600px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #2c3e50;
}

.section-title {
  margin: 1.5rem 0 0.75rem;
  font-size: 0.95rem;
  color: #5a6c7d;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.field-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 400;
  color: #95a5a6;
  cursor: pointer;
}

.field-toggle input {
  cursor: pointer;
}

.departure-hint {
  margin: 0;
  padding: 0.6rem 1rem;
  background: #eef7ee;
  border-left: 4px solid #58a55c;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #3d6b40;
}

.departure-hint strong {
  font-family: 'Monaco', 'Courier New', monospace;
  color: #2b5230;
}

.is-hidden-field th,
.is-hidden-field td {
  color: #b3bcc3;
  font-style: italic;
}

.field-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  table-layout: fixed;
}

.field-table th,
.field-table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid #eef1f4;
  text-align: left;
  vertical-align: top;
}

.field-table th {
  width: 7.5rem;
  color: #2c3e50;
  font-weight: 600;
}

.field-name {
  width: 14rem;
  color: #95a5a6;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.78rem;
  word-break: break-all;
}

.field-value {
  color: #2c3e50;
  word-break: break-all;
}

.extra-note {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #fff8e6;
  border-left: 4px solid #f0ad4e;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #7a5b1e;
}

.extra-chip {
  display: inline-block;
  margin: 0.25rem 0.5rem 0 0;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.78rem;
}

@media (max-width: 640px) {
  .file-uploader {
    padding: 1rem;
  }
  
  .upload-section,
  .result-section {
    padding: 1.5rem;
  }
  
  .result-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
