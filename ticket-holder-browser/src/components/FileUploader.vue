<script setup lang="ts">
import { ref } from 'vue'
import { extractXmlFromOFD } from '../utils/ofdParser'
import { extractXmlFromPDF } from '../utils/pdfParser'
import { parseXBRL, type ParsedData } from '../utils/xmlParser'
import TicketImagePreview from './TicketImagePreview.vue'

const selectedFile = ref<File | null>(null)
const parsing = ref(false)
const error = ref<string | null>(null)
const result = ref<ParsedData | null>(null)
const xmlFileName = ref<string | null>(null)

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
    
    <TicketImagePreview v-if="result" :ticketData="result" />
    
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
      
      <pre class="result-content">{{ JSON.stringify(result, null, 2) }}</pre>
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
