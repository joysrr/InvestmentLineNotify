<template>
  <div class="strategy-config-panel">
    <div v-if="loading" class="config-skeleton">
      <div v-for="i in 3" :key="i" class="sk-card"></div>
    </div>
    
    <div v-else-if="error" class="config-error">
      {{ error }}
    </div>

    <div v-else class="config-sections">
      <!-- 遍歷各個模組 (asset, indicator, guard, system) -->
      <div v-for="(module, modKey) in filteredConfig" :key="modKey" class="module-section">
        <div class="module-header" @click="toggleModule(modKey)">
          <div class="module-info">
            <h3 class="module-title">{{ module.label }}</h3>
            <p class="module-desc">{{ module.desc }}</p>
          </div>
          <span class="module-arrow" :class="{ 'is-expanded': expandedModules[modKey] }">▾</span>
        </div>

        <div v-if="expandedModules[modKey]" class="params-list">
          <!-- 遞迴遍歷渲染所有參數 -->
          <div 
            v-for="item in getFlatParamsForModule(modKey)" 
            :key="item.path" 
            class="param-item"
          >
            <div class="param-main" :class="{ 'is-array': Array.isArray(item.value) }">
              <div class="param-label-group">
                <span class="param-label">{{ item.label }}</span>
                <span class="param-path">{{ item.path }}</span>
              </div>
              <div class="param-value-box">
                <div class="array-container" v-if="Array.isArray(item.value)">
                  <div class="array-card" v-for="(row, idx) in item.value" :key="idx">
                    <div v-if="typeof row === 'object' && row !== null">
                      <div v-for="(v, k) in row" :key="k" class="array-row">
                        <span class="array-key">{{ k }}</span>
                        <span class="array-val" :class="{'highlight-val': ['note', 'comment', 'label'].includes(k)}">{{ String(v) }}</span>
                      </div>
                    </div>
                    <div v-else class="array-primitive">
                      {{ String(row) }}
                    </div>
                  </div>
                </div>
                <div v-else class="scalar-value-box">
                  <span class="param-value">{{ String(item.value) }}</span>
                  <span v-if="item.unit" class="param-unit">{{ item.unit }}</span>
                </div>
              </div>
            </div>
            <p v-if="item.desc" class="param-desc">{{ item.desc }}</p>
          </div>

          <!-- 原有的 JSON 檢視 (折疊) -->
          <details class="raw-json-details">
            <summary>查看原始 JSON</summary>
            <pre class="json-content">{{ formatJson(module.content) }}</pre>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { fetchStrategyConfig } from '../api/index.js'

const config = ref(null)
const meta = ref({})
const loading = ref(true)
const error = ref(null)
const expandedModules = reactive({})

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await fetchStrategyConfig()
    meta.value = res._meta || {}
    const { _meta, ...modules } = res
    config.value = modules
    // 自動展開所有收到的模組 (例如 strategy)
    for (const key of Object.keys(modules)) {
      expandedModules[key] = true
    }
  } catch (e) {
    error.value = '無法載入策略參數'
  } finally {
    loading.value = false
  }
}

const filteredConfig = computed(() => config.value || {})

// 遞迴攤平 JSON 物件
const flattenConfig = (obj, prefix = '') => {
  let result = []
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    
    // 陣列或基本型別視為葉節點
    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      result.push({ path, value: val })
    } else {
      result = result.concat(flattenConfig(val, path))
    }
  }
  return result
}

const getFlatParamsForModule = (modKey) => {
  const module = config.value[modKey]
  if (!module || !module.content) return []
  
  const flats = flattenConfig(module.content)
  return flats.map(item => {
    const metaInfo = meta.value[item.path] || {}
    return {
      path: item.path,
      value: item.value,
      label: metaInfo.label || item.path.split('.').pop(),
      desc: metaInfo.description || metaInfo.desc || '',
      unit: metaInfo.unit || ''
    }
  })
}

const toggleModule = (key) => {
  expandedModules[key] = !expandedModules[key]
}

const formatJson = (obj) => JSON.stringify(obj, null, 2)

onMounted(load)
</script>

<style scoped>
.strategy-config-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.module-section {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.module-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  cursor: pointer;
}

.module-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--tg-theme-text-color, #222);
}

.module-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  margin: 0;
}

.module-arrow {
  font-size: 20px;
  color: var(--tg-theme-hint-color, #ccc);
  transition: transform 0.3s;
}
.module-arrow.is-expanded { transform: rotate(180deg); }

.params-list {
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.param-item {
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}
.param-item:first-child { border-top: none; }

.param-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.param-label-group {
  display: flex;
  flex-direction: column;
}

.param-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #333);
}

.param-path {
  font-size: 10px;
  font-family: monospace;
  color: var(--tg-theme-hint-color, #aaa);
}

.param-value-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.param-main.is-array {
  flex-direction: column;
}

.param-main.is-array .param-value-box {
  align-items: stretch;
  max-width: 100%;
  width: 100%;
}

.scalar-value-box {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.param-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-button-color, #2481cc);
}

.param-unit {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
}

.array-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.array-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.array-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.4;
  gap: 12px;
}
.array-row:last-child {
  margin-bottom: 0;
}

.array-key {
  color: var(--tg-theme-hint-color, #888);
  font-family: monospace;
  font-size: 11px;
}

.array-val {
  color: var(--tg-theme-text-color, #333);
  font-weight: 500;
  text-align: right;
  word-break: break-word;
}

.highlight-val {
  color: #d9534f;
  font-weight: 600;
  background: rgba(217, 83, 79, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}

.array-primitive {
  font-size: 13px;
  color: var(--tg-theme-text-color, #333);
  font-family: monospace;
}

.param-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--tg-theme-hint-color, #666);
  margin: 0;
}

.raw-json-details {
  margin-top: 20px;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
  padding-top: 12px;
}

.raw-json-details summary {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  cursor: pointer;
  outline: none;
}

.json-content {
  font-family: 'SF Mono', monospace;
  font-size: 10px;
  background: #fdfdfd;
  padding: 10px;
  border-radius: 8px;
  margin-top: 8px;
  overflow-x: auto;
}

.json-inline {
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  background: rgba(0,0,0,0.03);
  padding: 6px;
  border-radius: 6px;
  margin: 0;
  max-width: 250px;
  overflow-x: auto;
  color: var(--tg-theme-text-color, #222);
}

.sk-card {
  height: 80px;
  background: #eee;
  border-radius: 16px;
  margin-bottom: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>
