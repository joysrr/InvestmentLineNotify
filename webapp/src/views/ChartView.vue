<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">收益率趨勢</h2>
      <span class="view-subtitle" v-if="reports.length">近 {{ reports.length }} 個交易日</span>
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

    <template v-else>
      <div class="chart-wrapper">
        <v-chart :option="chartOption" autoresize class="chart" />
      </div>

      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">最新收益率</span>
          <span class="summary-value" :class="latestReport.signals.priceChangePercent >= 0 ? 'pos' : 'neg'">
            {{ latestReport.signals.priceChangePercent >= 0 ? '+' : '' }}{{ latestReport.signals.priceChangePercentText }}%
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">最新評分</span>
          <span class="summary-value">{{ latestReport.signals.weightScore }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">決策</span>
          <span class="summary-value summary-target">{{ latestReport.signals.target }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, GridComponent, MarkLineComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { fetchReports } from '../api/index.js'

use([LineChart, TitleComponent, TooltipComponent, GridComponent, MarkLineComponent, CanvasRenderer])

const reports = ref([])
const loading = ref(true)
const error = ref(null)

const latestReport = computed(() => reports.value[reports.value.length - 1])

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await fetchReports(30)
    // ASC 排序，最新在右
    reports.value = [...data].sort((a, b) => a.date.localeCompare(b.date))
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const chartOption = computed(() => ({
  grid: { left: 48, right: 12, top: 12, bottom: 40 },
  xAxis: {
    type: 'category',
    data: reports.value.map(r => r.date.slice(5)), // MM-DD
    axisLabel: { fontSize: 10, color: 'var(--tg-theme-hint-color, #999)', rotate: 30 },
    axisLine: { lineStyle: { color: 'var(--tg-theme-hint-color, #ddd)' } }
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      fontSize: 10,
      color: 'var(--tg-theme-hint-color, #999)',
      formatter: v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
    },
    splitLine: { lineStyle: { color: 'var(--tg-theme-hint-color, #eee)', type: 'dashed' } }
  },
  tooltip: {
    trigger: 'axis',
    formatter(params) {
      const p = params[0]
      const r = reports.value[p.dataIndex]
      const pct = r.signals.priceChangePercent
      const color = pct >= 0 ? '#26a17b' : '#e84855'
      return [
        `<b>${r.date}</b>`,
        `收益率：<span style="color:${color}">${pct >= 0 ? '+' : ''}${r.signals.priceChangePercentText}%</span>`,
        `評分：${r.signals.weightScore}`,
        `決策：${r.signals.target}`
      ].join('<br/>')
    }
  },
  series: [{
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    data: reports.value.map(r => ({
      value: r.signals.priceChangePercent,
      itemStyle: { color: r.signals.priceChangePercent >= 0 ? '#26a17b' : '#e84855' }
    })),
    lineStyle: { color: '#2481cc', width: 2 },
    markLine: {
      silent: true,
      symbol: 'none',
      data: [{ yAxis: 0 }],
      lineStyle: { color: 'var(--tg-theme-hint-color, #ccc)', type: 'dashed', width: 1 }
    }
  }]
}))

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

.chart-wrapper {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 12px 4px 4px;
  margin-bottom: 12px;
}

.chart {
  width: 100%;
  height: 240px;
}

.summary-bar {
  display: flex;
  gap: 8px;
}

.summary-item {
  flex: 1;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  text-align: center;
}

.summary-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}

.summary-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.summary-target {
  font-size: 11px;
}

.pos { color: #26a17b; }
.neg { color: #e84855; }

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
