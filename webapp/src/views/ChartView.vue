<template>
  <div class="view-container">
    <!-- 標題列 -->
    <div class="view-header">
      <h2 class="view-title">📊 資產趨勢</h2>
      <span class="view-subtitle" v-if="!loading && dataPoints.length">
        {{ granularityLabel }}，{{ dataPoints.length }} 筆
      </span>
    </div>

    <!-- 粒度切換 -->
    <div class="seg-bar">
      <button
        v-for="g in granularities"
        :key="g.key"
        class="seg-btn"
        :class="{ active: granularity === g.key }"
        @click="setGranularity(g.key)"
      >
        {{ g.label }}
      </button>
    </div>

    <!-- 載入中 -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>載入中...</p>
    </div>

    <!-- 錯誤 -->
    <div v-else-if="error" class="state-box state-error">
      <p>⚠️ {{ error }}</p>
      <button class="retry-btn" @click="load">重試</button>
    </div>

    <!-- 無快照 -->
    <div v-else-if="!hasEncryption" class="state-box">
      <p>🔐 快照功能未啟用</p>
      <p class="state-hint">請設定 SNAPSHOT_ENCRYPT_KEY 環境變數</p>
    </div>

    <!-- 空資料 -->
    <div v-else-if="dataPoints.length === 0" class="state-box">
      <p>📫 尚無快照資料</p>
      <p class="state-hint">將從明日日報後開始累積</p>
    </div>

    <!-- 圖表主體 -->
    <template v-else>
      <!-- ECharts -->
      <div class="chart-wrapper">
        <v-chart :option="chartOption" autoresize class="chart" />
      </div>

      <!-- 指標切換 chips -->
      <div class="metric-bar">
        <button
          v-for="m in metrics"
          :key="m.key"
          class="metric-chip"
          :class="{ active: metric === m.key }"
          @click="metric = m.key"
        >
          {{ m.label }}
        </button>
      </div>

      <!-- 最新快照摘要 -->
      <div class="summary-grid" v-if="latest">
        <div class="summary-card">
          <span class="s-label">市價淨値</span>
          <span class="s-value" :class="valueClass(latest.netValueMarket)">
            {{ formatNTD(latest.netValueMarket) }}
          </span>
        </div>
        <div class="summary-card">
          <span class="s-label">0050 市價</span>
          <span class="s-value">{{
            latest.price0050 != null ? `$${latest.price0050}` : "—"
          }}</span>
        </div>
        <div class="summary-card">
          <span class="s-label">00675L 市價</span>
          <span class="s-value">{{
            latest.priceZ2 != null ? `$${latest.priceZ2}` : "—"
          }}</span>
        </div>
        <div class="summary-card">
          <span class="s-label">融資餘額</span>
          <span class="s-value neg">{{ formatNTD(latest.totalLoan) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  fetchSnapshots,
  fetchSnapshotsWeekly,
  fetchSnapshotsMonthly,
} from "../api/index.js";

use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
  LegendComponent,
  CanvasRenderer,
]);

// ── 粒度設定 ────────────────────────────────────────────────────────────────────
const granularities = [
  { key: "daily", label: "日 90", limit: 90 },
  { key: "weekly", label: "週 52", limit: 52 },
  { key: "monthly", label: "月 120", limit: 120 },
];
const granularity = ref("daily");
const granularityLabel = computed(
  () => granularities.find((g) => g.key === granularity.value)?.label ?? "",
);

// ── 指標設定 ────────────────────────────────────────────────────────────────────
const metrics = [
  { key: "netValueMarket", label: "市價淨値" },
  { key: "qty0050", label: "0050 股數" },
  { key: "qtyZ2", label: "675L 股數" },
  { key: "totalLoan", label: "融資餘額" },
];
const metric = ref("netValueMarket");

// ── 資料狀態 ────────────────────────────────────────────────────────────────────
const dataPoints = ref([]); // ASC 排序
const loading = ref(true);
const error = ref(null);
const hasEncryption = ref(true); // 預設 true，如後端明確回傳 false 才覆寫

const latest = computed(() =>
  dataPoints.value.length
    ? dataPoints.value[dataPoints.value.length - 1]
    : null,
);

// ── 載入逻輯 ────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const g = granularities.find((g) => g.key === granularity.value);
    let raw;

    if (granularity.value === "daily") {
      const res = await fetchSnapshots(g.limit);
      // daily API 回傳 { snapshots: [], hasEncryption: bool }
      hasEncryption.value = res.hasEncryption ?? true;
      raw = [...(res.snapshots ?? [])].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    } else if (granularity.value === "weekly") {
      const res = await fetchSnapshotsWeekly(g.limit);
      // weekly API 可能回傳 [] （未啟用快照）或陣列
      if (Array.isArray(res)) {
        hasEncryption.value = true;
        raw = [...res].sort((a, b) =>
          (a.endDate ?? a.date ?? "").localeCompare(b.endDate ?? b.date ?? ""),
        );
      } else {
        // 如果後端未來扤充 hasEncryption 欄位，在此門一擴充
        hasEncryption.value = res.hasEncryption ?? true;
        raw = [...(res.snapshots ?? [])].sort((a, b) =>
          (a.endDate ?? a.date ?? "").localeCompare(b.endDate ?? b.date ?? ""),
        );
      }
    } else {
      const res = await fetchSnapshotsMonthly(g.limit);
      if (Array.isArray(res)) {
        hasEncryption.value = true;
        raw = [...res].sort((a, b) =>
          (a.endDate ?? a.date ?? "").localeCompare(b.endDate ?? b.date ?? ""),
        );
      } else {
        hasEncryption.value = res.hasEncryption ?? true;
        raw = [...(res.snapshots ?? [])].sort((a, b) =>
          (a.endDate ?? a.date ?? "").localeCompare(b.endDate ?? b.date ?? ""),
        );
      }
    }

    dataPoints.value = raw;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function setGranularity(key) {
  if (granularity.value === key) return;
  granularity.value = key;
}

watch(granularity, load);
onMounted(load);

// ── X 軸標籤格式化 ────────────────────────────────────────────────────────────────────
function xLabel(pt) {
  if (granularity.value === "daily") return (pt.date ?? "").slice(5); // MM-DD
  if (granularity.value === "weekly")
    return pt.period ?? (pt.endDate ?? pt.date ?? "").slice(5);
  return (pt.period ?? pt.endDate ?? pt.date ?? "").slice(0, 7); // YYYY-MM
}

// ── 指標取値與格式化 ───────────────────────────────────────────────────────────────────
function getValue(pt) {
  return pt[metric.value] ?? null;
}

function formatNTD(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatY(val) {
  if (val == null) return "—";
  const m = metric.value;
  if (m === "netValueMarket") {
    if (Math.abs(val) >= 10000) return `${(val / 10000).toFixed(1)}萬`;
    return `$${val.toLocaleString()}`;
  }
  if (m === "totalLoan") {
    if (Math.abs(val) >= 10000) return `${(val / 10000).toFixed(1)}萬`;
    return `$${val.toLocaleString()}`;
  }
  return `${val}股`; // qty
}

function valueClass(v) {
  if (v == null) return "";
  return v >= 0 ? "pos" : "neg";
}

// ── 圖表選項 (computed) ──────────────────────────────────────────────────────────────────
const metricConfig = computed(
  () => metrics.find((m) => m.key === metric.value) ?? metrics[0],
);

const isMonetary = computed(
  () => metric.value === "netValueMarket" || metric.value === "totalLoan",
);

const chartOption = computed(() => {
  const pts = dataPoints.value;
  if (!pts.length) return {};

  const xData = pts.map(xLabel);
  const series0 = pts.map((p) => getValue(p));

  const lineColor =
    metric.value === "totalLoan"
      ? "#e84855"
      : metric.value === "netValueMarket"
        ? "#2481cc"
        : "#26a17b";

  const markLine =
    metric.value === "netValueMarket"
      ? {
          silent: true,
          symbol: "none",
          data: [{ yAxis: 0 }],
          lineStyle: {
            color: "var(--tg-theme-hint-color, #ccc)",
            type: "dashed",
            width: 1,
          },
        }
      : {};

  return {
    grid: { left: 56, right: 12, top: 16, bottom: 44 },
    xAxis: {
      type: "category",
      data: xData,
      axisLabel: {
        fontSize: 10,
        color: "var(--tg-theme-hint-color, #999)",
        rotate: granularity.value === "monthly" ? 0 : 30,
        interval: "auto",
      },
      axisLine: { lineStyle: { color: "var(--tg-theme-hint-color, #ddd)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        fontSize: 10,
        color: "var(--tg-theme-hint-color, #999)",
        formatter: (v) => formatY(v),
      },
      splitLine: {
        lineStyle: {
          color: "var(--tg-theme-hint-color, #eee)",
          type: "dashed",
        },
      },
    },
    tooltip: {
      trigger: "axis",
      formatter(params) {
        const idx = params[0].dataIndex;
        const pt = pts[idx];
        const v = getValue(pt);
        const date =
          granularity.value === "daily"
            ? pt.date
            : `${pt.startDate} – ${pt.endDate}`;
        const lines = [
          `<b>${date}</b>`,
          `${metricConfig.value.label}：${isMonetary.value ? formatNTD(v) : `${v} 股`}`,
        ];
        if (pt.netValueMarket != null && metric.value !== "netValueMarket") {
          lines.push(`市價淨値：${formatNTD(pt.netValueMarket)}`);
        }
        if (pt.price0050 != null) lines.push(`0050：$${pt.price0050}`);
        if (pt.priceZ2 != null) lines.push(`00675L：$${pt.priceZ2}`);
        if (pt.totalLoan != null && metric.value !== "totalLoan") {
          lines.push(`融資：${formatNTD(pt.totalLoan)}`);
        }
        return lines.join("<br/>");
      },
    },
    series: [
      {
        type: "line",
        connectNulls: false,
        smooth: true,
        symbol: pts.length <= 60 ? "circle" : "none",
        symbolSize: 4,
        data: series0,
        lineStyle: { color: lineColor, width: 2 },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${lineColor}28` },
              { offset: 1, color: `${lineColor}04` },
            ],
          },
        },
        markLine,
      },
    ],
  };
});
</script>

<style scoped>
.view-container {
  padding: 16px 16px 8px;
  min-height: 100%;
}

/* ── Header ── */
.view-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
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

/* ── 粒度切換 ── */
.seg-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.seg-btn {
  flex: 1;
  padding: 6px 0;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
  color: var(--tg-theme-hint-color, #888);
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.seg-btn.active {
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
}

/* ── 圖表 ── */
.chart-wrapper {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 8px 4px 4px;
  margin-bottom: 10px;
}
.chart {
  height: 230px;
  width: 100%;
}

/* ── 指標 chips ── */
.metric-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.metric-chip {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 500;
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
  color: var(--tg-theme-hint-color, #888);
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.metric-chip.active {
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
}

/* ── 摘要卡片 ── */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.summary-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.s-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}
.s-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.s-value.pos {
  color: #26a17b;
}
.s-value.neg {
  color: #e84855;
}

/* ── 狀態區 ── */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 16px;
  color: var(--tg-theme-hint-color, #999);
  font-size: 14px;
  text-align: center;
}
.state-hint {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #bbb);
}
.state-error {
  color: #e84855;
}
.retry-btn {
  margin-top: 4px;
  padding: 6px 18px;
  border-radius: 8px;
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  font-size: 13px;
  border: none;
  cursor: pointer;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid var(--tg-theme-hint-color, #ddd);
  border-top-color: var(--tg-theme-button-color, #2481cc);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
