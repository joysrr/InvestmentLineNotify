<template>
    <GlobalErrorBoundary>
    <div class="view-container">
    <SubTabBar
      :tabs="viewTabs"
      :active-tab="activeViewTab"
      @tab-change="onViewTabChange"
    />

    <div v-if="activeViewTab === '圖表'">
    <!-- ChartView 內建 tabs -->
    <div class="chart-tabs">
      <button
        :class="{ active: activeTab === 'trend' }"
        @click="activeTab = 'trend'"
      >        <Icon name="chart" size="sm" color="var(--iln-text)" /> 資產趨勢
      </button>
    </div>

    <div v-show="activeTab === 'trend'">
    <!-- 標題列 -->
    <div class="view-header">
      <h2 class="view-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> 資產趨勢</h2>
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
    <EmptyState v-if="loading" title="載入中..." />

    <!-- 錯誤 -->
    <ErrorAlert v-else-if="error" :visible="true" :description="error" :show-retry="true" @retry="load" />

    <!-- 無快照 -->
    <EmptyState v-else-if="!hasEncryption" title="快照功能未啟用" message="請設定 SNAPSHOT_ENCRYPT_KEY 環境變數" />

    <!-- 空資料 -->
    <EmptyState v-else-if="dataPoints.length === 0" title="尚無快照資料" message="將從明日日報後開始累積" />

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
    </div>     <!-- 閉合 v-show="activeTab === 'trend'" -->

    </div>     <!-- 閉合 v-if="activeViewTab === '圖表'" -->

    <div v-else>
      <TechnicalPanel />
    </div>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "@/components/common/Icon.vue";
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
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import SubTabBar from "@/components/common/SubTabBar.vue";
import TechnicalPanel from "@/components/chart/TechnicalPanel.vue";

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
const activeTab = ref("trend"); // 'trend' | 'reports'

// ── 一級分頁：圖表 / 技術指標 ─────────────────────────────────────────────────
const viewTabs = [
  { label: "圖表", query: { tab: "chart" } },
  { label: "技術指標", query: { tab: "technical" } },
];

const activeViewTab = ref("圖表");

const route = useRoute();
const router = useRouter();

// 從 query 還原 active tab（深層連結）
if (route.query.tab === "technical") {
  activeViewTab.value = "技術指標";
}

const onViewTabChange = (label) => {
  activeViewTab.value = label;
  const query = label === "技術指標" ? { tab: "technical" } : { tab: "chart" };
  router.replace({ query });
};

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
      ? "var(--iln-danger-text)"
      : metric.value === "netValueMarket"
        ? "var(--iln-brand)"
        : "var(--iln-ok-text)";

  const markLine =
    metric.value === "netValueMarket"
      ? {
          silent: true,
          symbol: "none",
          data: [{ yAxis: 0 }],
          lineStyle: {
            color: "var(--iln-hint)",
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
        color: "var(--iln-hint)",
        rotate: granularity.value === "monthly" ? 0 : 30,
        interval: "auto",
      },
      axisLine: { lineStyle: { color: "var(--iln-hint)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        fontSize: 10,
        color: "var(--iln-hint)",
        formatter: (v) => formatY(v),
      },
      splitLine: {
        lineStyle: {
          color: "var(--iln-hint)",
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
  color: var(--iln-text);
}
.view-subtitle {
  font-size: 12px;
  color: var(--iln-hint);
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
  background: var(--iln-surface);
  color: var(--iln-hint);
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.seg-btn.active {
  background: var(--iln-brand);
  color: var(--iln-text-on-brand);
}

/* ── 圖表 ── */
.chart-wrapper {
  background: var(--iln-surface);
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
  background: var(--iln-surface);
  color: var(--iln-hint);
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.metric-chip.active {
  background: var(--iln-brand);
  color: var(--iln-text-on-brand);
}

/* ── 摘要卡片 ── */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.summary-card {
  background: var(--iln-surface);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.s-label {
  font-size: 11px;
  color: var(--iln-hint);
}
.s-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--iln-text);
}
.s-value.pos {
  color: var(--iln-ok-text);
}
.s-value.neg {
  color: var(--iln-danger-text);
}

/* ── 狀態區 ── */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 16px;
  color: var(--iln-hint);
  font-size: 14px;
  text-align: center;
}
.state-hint {
  font-size: 12px;
  color: var(--iln-hint);
}
.state-error {
  color: var(--iln-danger-text);
}
.retry-btn {
  margin-top: 4px;
  padding: 6px 18px;
  border-radius: 8px;
  background: var(--iln-brand);
  color: var(--iln-text-on-brand);
  font-size: 13px;
  border: none;
  cursor: pointer;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid var(--iln-hint);
  border-top-color: var(--iln-brand);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chart-tabs {
  display: flex;
  gap: 8px;
  margin: 12px 0 8px 0;
  border-bottom: 1px solid var(--iln-hint);
  padding-bottom: 8px;
}

.chart-tabs button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--iln-hint);
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.chart-tabs button.active {
  color: var(--iln-brand);
  border-bottom: 2px solid var(--iln-brand);
  font-weight: 600;
}
</style>
