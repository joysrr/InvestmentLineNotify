<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">報告摘要</h2>
      <span class="view-subtitle" v-if="reports.length">共 {{ reports.length }} 份</span>
    </div>

    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>載入中...</p>
    </div>

    <div v-else-if="error" class="state-box state-error">
      <p>⚠️ {{ error }}</p>
      <button class="retry-btn" @click="load">重試</button>
    </div>

    <div v-else-if="reports.length === 0" class="state-box">
      <p>📭 尚無報告資料</p>
    </div>

    <div v-else class="report-list">
      <div
        v-for="r in reports"
        :key="r.date"
        class="report-card"
        @click="toggle(r.date)"
      >
        <!-- 摘要列 -->
        <div class="report-summary">
          <div class="report-meta">
            <span class="report-date">{{ r.date }}</span>
            <span class="report-status">{{ r.signals.marketStatus }}</span>
          </div>
          <div class="report-suggestion">{{ r.signals.targetSuggestion }}</div>
          <div class="report-badges">
            <span class="badge" :class="r.signals.priceChangePercent >= 0 ? 'badge-pos' : 'badge-neg'">
              {{ r.signals.priceChangePercent >= 0 ? '+' : '' }}{{ r.signals.priceChangePercentText }}%
            </span>
            <span class="badge badge-score">評分 {{ r.signals.weightScore }}</span>
            <span class="badge badge-expand">{{ expanded[r.date] ? '▲' : '▼' }}</span>
          </div>
        </div>

        <!-- 展開詳情 -->
        <div v-show="expanded[r.date]" class="report-detail" @click.stop>
          <div v-if="r.ai?.action_items?.length" class="detail-section">
            <h4 class="detail-title">✅ 行動建議</h4>
            <ul class="detail-list">
              <li v-for="(item, i) in r.ai.action_items" :key="i">{{ item }}</li>
            </ul>
          </div>

          <div v-if="r.ai?.risk_warnings?.length" class="detail-section">
            <h4 class="detail-title">⚠️ 風險警告</h4>
            <ul class="detail-list detail-list--warn">
              <li v-for="(item, i) in r.ai.risk_warnings" :key="i">{{ item }}</li>
            </ul>
          </div>

          <div v-if="r.ai?.mindset_advice?.length" class="detail-section">
            <h4 class="detail-title">🧘 心態建議</h4>
            <ul class="detail-list">
              <li v-for="(item, i) in r.ai.mindset_advice" :key="i">{{ item }}</li>
            </ul>
          </div>

          <details v-if="r.ai?.coach_internal_thinking" class="thinking-section">
            <summary class="thinking-summary">🤖 AI 推理過程</summary>
            <p class="thinking-content">{{ r.ai.coach_internal_thinking }}</p>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { fetchReports } from '../api/index.js'

const reports = ref([])
const loading = ref(true)
const error = ref(null)
const expanded = reactive({})

function toggle(date) {
  expanded[date] = !expanded[date]
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await fetchReports(30)
    // DESC 排序，最新在上
    reports.value = [...data].sort((a, b) => b.date.localeCompare(a.date))
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.view-container {
  padding: 16px;
  min-height: 100%;
}

.view-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

.view-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.view-subtitle {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  user-select: none;
}

.report-summary {}

.report-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.report-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.report-status {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

.report-suggestion {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  margin-bottom: 8px;
  line-height: 1.4;
}

.report-badges {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 20px;
  font-weight: 600;
}

.badge-pos { background: #e6f7f1; color: #26a17b; }
.badge-neg { background: #fdecea; color: #e84855; }
.badge-score { background: var(--tg-theme-hint-color, #eee); color: var(--tg-theme-text-color, #555); opacity: 0.7; }
.badge-expand { background: transparent; color: var(--tg-theme-hint-color, #aaa); font-size: 10px; margin-left: auto; }

.report-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--tg-theme-hint-color, #e0e0e0);
  opacity: 0.9;
}

.detail-section {
  margin-bottom: 10px;
}

.detail-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-list {
  padding-left: 16px;
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
}

.detail-list--warn li { color: #c0392b; }

.thinking-section {
  margin-top: 8px;
}

.thinking-summary {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #aaa);
  cursor: pointer;
  user-select: none;
}

.thinking-content {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-top: 6px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  color: var(--tg-theme-hint-color, #999);
  font-size: 14px;
}

.state-error { color: #e84855; }

.retry-btn {
  padding: 8px 20px;
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--tg-theme-hint-color, #ddd);
  border-top-color: var(--tg-theme-button-color, #2481cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
