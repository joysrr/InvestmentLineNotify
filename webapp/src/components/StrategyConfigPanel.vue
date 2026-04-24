<template>
  <div class="strategy-config-panel">
    <div v-if="loading" class="config-skeleton">
      <div v-for="i in 4" :key="i" class="sk-card"></div>
    </div>
    <div v-else-if="error" class="config-error">
      {{ error }}
    </div>
    <div v-else class="config-cards">
      <div v-for="(data, key) in config" :key="key" class="config-card">
        <div class="card-header">
          <h3 class="card-title">{{ data.label }}</h3>
          <span class="card-desc">{{ data.desc }}</span>
        </div>
        <div class="card-body">
          <pre class="json-content">{{ formatJson(data.content) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchStrategyConfig } from '../api/index.js'

const config = ref(null)
const loading = ref(true)
const error = ref(null)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    config.value = await fetchStrategyConfig()
  } catch (e) {
    error.value = '無法載入策略參數'
  } finally {
    loading.value = false
  }
}

const formatJson = (obj) => {
  return JSON.stringify(obj, null, 2)
}

onMounted(load)
</script>

<style scoped>
.strategy-config-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-card {
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.card-header {
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 2px;
}

.card-desc {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
}

.card-body {
  padding: 10px;
}

.json-content {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 10px;
  line-height: 1.4;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--tg-theme-text-color, #333);
}

.sk-card {
  height: 120px;
  background: #eee;
  border-radius: 12px;
  margin-bottom: 12px;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.config-error {
  text-align: center;
  padding: 20px;
  color: #e84855;
  font-size: 13px;
}
</style>
