<template>
  <GlobalErrorBoundary>
    <div class="view-container iln-page">
      <!-- 統一頁首與一級切換（圖表 / 技術指標） -->
      <header class="view-header view-header--with-switch">
        <div class="view-header-leading">
          <div class="view-header-text">
            <h2 class="view-title">
              <Icon
                :name="activeViewTabValue === 'chart' ? 'chart' : 'gauge'"
                size="sm"
                color="var(--iln-text)"
              />
              <span>{{ activeViewTabValue === 'chart' ? '資產趨勢' : '技術指標詳情' }}</span>
            </h2>
            <span
              v-if="activeViewTabValue === 'chart' && !loading && dataPoints.length"
              class="view-subtitle tabular"
            >
              {{ granularityLabel }}，{{ dataPoints.length }} 筆
            </span>
          </div>
        </div>

        <SegmentedControl
          v-model="activeViewTabValue"
          :options="viewTabOptions"
          size="md"
          aria-label="圖表與技術指標切換"
          @change="onViewTabChange"
        />
      </header>

      <!-- Tab 1：資產趨勢圖表 -->
      <template v-if="activeViewTabValue === 'chart'">
        <div v-show="activeTab === 'trend'">
          <!-- 粒度切換 -->
          <div class="seg-bar" role="group" aria-label="資料粒度切換">
            <button
              v-for="g in granularities"
              :key="g.key"
              type="button"
              class="seg-btn tabular"
              :class="{ active: granularity === g.key }"
              :aria-pressed="granularity === g.key"
              @click="setGranularity(g.key)"
            >
              {{ g.label }}
            </button>
          </div>

          <!-- 時間範圍切換 -->
          <div class="time-range-bar" role="group" aria-label="時間範圍切換">
            <button
              v-for="t in timeRanges"
              :key="t.key"
              type="button"
              class="time-range-btn tabular"
              :class="{ active: timeRange === t.key }"
              :aria-pressed="timeRange === t.key"
              @click="() => { timeRange = t.key; selectionChanged(); }"
            >
              {{ t.label }}
            </button>
          </div>

          <!-- 載入中 -->
          <EmptyState v-if="loading" title="載入中..." />

          <!-- 錯誤 -->
          <ErrorAlert
            v-else-if="error"
            :visible="true"
            :description="error"
            :show-retry="true"
            @retry="load"
          />

          <!-- 無快照 -->
          <EmptyState
            v-else-if="!hasEncryption"
            title="快照功能未啟用"
            message="請設定 SNAPSHOT_ENCRYPT_KEY 環境變數"
          />

          <!-- 空資料 -->
          <EmptyState
            v-else-if="dataPoints.length === 0"
            title="尚無快照資料"
            message="將從明日日報後開始累積"
          />

          <!-- 圖表主體 -->
          <template v-else>
            <!-- ECharts -->
            <div class="chart-wrapper">
              <v-chart :option="chartOption" autoresize class="chart" />
            </div>

            <!-- 指標切換 chips -->
            <div class="metric-bar" role="group" aria-label="指標切換">
              <button
                v-for="m in metrics"
                :key="m.key"
                type="button"
                class="metric-chip tabular"
                :class="{ active: metric === m.key }"
                :aria-pressed="metric === m.key"
                @click="() => { metric = m.key; selectionChanged(); }"
              >
                {{ m.label }}
              </button>
            </div>

            <!-- 最新快照摘要 -->
            <div class="summary-grid" v-if="latest">
              <div class="summary-card">
                <span class="s-label">市價淨値</span>
                <span class="s-value iln-num-tabular tabular" :class="valueClass(latest.netValueMarket)">
                  {{ formatNTD(latest.netValueMarket) }}
                </span>
              </div>
              <div class="summary-card">
                <span class="s-label">0050 市價</span>
                <span class="s-value iln-num-tabular tabular">
                  {{ latest.price0050 != null ? `$${latest.price0050}` : "—" }}
                </span>
              </div>
              <div class="summary-card">
                <span class="s-label">00675L 市價</span>
                <span class="s-value iln-num-tabular tabular">
                  {{ latest.priceZ2 != null ? `$${latest.priceZ2}` : "—" }}
                </span>
              </div>
              <div class="summary-card">
                <span class="s-label">融資餘額</span>
                <span class="s-value neg iln-num-tabular tabular">
                  {{ formatNTD(latest.totalLoan) }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Tab 2：技術指標 -->
      <div v-else class="technical-panel-wrap">
        <TechnicalPanel :time-range="timeRange" />
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
import { resolveCssColor } from "@/utils/cssColor.js";
import {
  fetchSnapshots,
  fetchSnapshotsWeekly,
  fetchSnapshotsMonthly,
} from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import SegmentedControl from "@/components/common/SegmentedControl.vue";
import TechnicalPanel from "@/components/chart/TechnicalPanel.vue";
import { selectionChanged } from "@/composables/useTelegram.js";

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

// ── 時間範圍切換 ─────────────────────────────────────────────────────────────────
const timeRanges = [
  { key: "1M", label: "1M", limit: 22 },
  { key: "3M", label: "3M", limit: 66 },
  { key: "6M", label: "6M", limit: 132 },
  { key: "1Y", label: "1Y", limit: 252 },
  { key: "ALL", label: "ALL", limit: null },
];
const timeRange = ref("ALL");
const activeTab = ref("trend");

// ── 一級分頁：圖表 / 技術指標 ─────────────────────────────────────────────────
const viewTabOptions = [
  { value: "chart", label: "圖表", icon: "chart" },
  { value: "technical", label: "技術指標", icon: "gauge" },
];

const route = useRoute();
const router = useRouter();

const normalizeViewTab = (val) => (val === "technical" ? "technical" : "chart");
const activeViewTabValue = ref(normalizeViewTab(route.query.tab));

watch(
  () => route.query.tab,
  (nextTab) => {
    activeViewTabValue.value = normalizeViewTab(nextTab);
  },
);

function goBack() {
  const source = route.query.source;
  if (source === "account") {
    router.push("/account");
  } else {
    router.push("/dashboard");
  }
}

const onViewTabChange = (val) => {
  const normalized = normalizeViewTab(val);
  activeViewTabValue.value = normalized;
  router.replace({ query: { ...route.query, tab: normalized } }).catch(() => {});
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
const dataPoints = ref([]);
const loading = ref(true);
const error = ref(null);
const hasEncryption = ref(true);

const latest = computed(() =>
  dataPoints.value.length
    ? dataPoints.value[dataPoints.value.length - 1]
    : null,
);

// ── 載入邏輯 ────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true;
  error.value = null;
  try {
    const g = granularities.find((g) => g.key === granularity.value);
    let raw;

    const rangeLimit =
      timeRange.value === "ALL"
        ? g.limit
        : timeRanges.find((t) => t.key === timeRange.value)?.limit ?? g.limit;

    if (granularity.value === "daily") {
      const res = await fetchSnapshots(rangeLimit);
      hasEncryption.value = res.hasEncryption ?? true;
      raw = [...(res.snapshots ?? [])].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    } else if (granularity.value === "weekly") {
      const res = await fetchSnapshotsWeekly(rangeLimit);
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
    } else {
      const res = await fetchSnapshotsMonthly(rangeLimit);
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
  selectionChanged();
}

watch([granularity, timeRange], load);
onMounted(load);

// ── X 軸標籤格式化 ────────────────────────────────────────────────────────────────────
function xLabel(pt) {
  if (granularity.value === "daily") return (pt.date ?? "").slice(5);
  if (granularity.value === "weekly")
    return pt.period ?? (pt.endDate ?? pt.date ?? "").slice(5);
  return (pt.period ?? pt.endDate ?? pt.date ?? "").slice(0, 7);
}

// ── 指標取值與格式化 ───────────────────────────────────────────────────────────────────
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
  if (val == null || !Number.isFinite(val)) return "—";
  const m = metric.value;
  if (m === "netValueMarket") {
    if (Math.abs(val) >= 10000) return `${(val / 10000).toFixed(1)}萬`;
    return `$${val.toLocaleString()}`;
  }
  if (m === "totalLoan") {
    if (Math.abs(val) >= 10000) return `${(val / 10000).toFixed(1)}萬`;
    return `$${val.toLocaleString()}`;
  }
  return `${val}股`;
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

  const lineToken =
    metric.value === "totalLoan"
      ? "--iln-viz-bear"
      : metric.value === "netValueMarket"
        ? "--iln-viz-bull"
        : "--iln-viz-neutral";
  const lineColor = resolveCssColor(lineToken);
  const lineFillTop = resolveCssColor(lineToken, 0.16);
  const lineFillBottom = resolveCssColor(lineToken, 0.016);

  const markLine =
    metric.value === "netValueMarket"
      ? {
          silent: true,
          symbol: "none",
          data: [{ yAxis: 0 }],
          lineStyle: {
            color: resolveCssColor("--iln-hint"),
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
        color: resolveCssColor("--iln-hint"),
        rotate: granularity.value === "monthly" ? 0 : 30,
        interval: "auto",
      },
      axisLine: { lineStyle: { color: resolveCssColor("--iln-hint") } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        fontSize: 10,
        color: resolveCssColor("--iln-hint"),
        formatter: (v) => formatY(v),
      },
      splitLine: {
        lineStyle: {
          color: resolveCssColor("--iln-hint"),
          type: "dashed",
        },
      },
    },
    tooltip: {
      trigger: "axis",
      textStyle: {
        color: resolveCssColor("--iln-text"),
        fontSize: 12,
      },
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
              { offset: 0, color: lineFillTop },
              { offset: 1, color: lineFillBottom },
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
  padding: var(--iln-space-4) var(--iln-space-4) calc(var(--iln-space-6) + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--iln-space-3);
  flex-wrap: wrap;
  margin-bottom: var(--iln-space-3);
}

.view-header-leading {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2-5, 10px);
  min-width: 0;
}

.chart-back-button {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1, 4px);
  min-height: var(--iln-touch-min, 44px);
  padding: 0 var(--iln-space-3);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-full);
  background: var(--iln-surface);
  color: var(--iln-text);
  font: inherit;
  font-size: var(--iln-font-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.chart-back-button:hover {
  background: var(--iln-surface-alt, var(--iln-bg));
}

.chart-back-button:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.view-header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.view-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  font-size: var(--iln-font-lg);
  font-weight: 800;
  color: var(--iln-text);
  margin: 0;
}

.view-subtitle {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.technical-panel-wrap :deep(.view-container) {
  padding-left: 0;
  padding-right: 0;
  padding-bottom: 0;
}

.seg-bar,
.time-range-bar {
  display: flex;
  gap: 6px;
  margin-bottom: var(--iln-space-3);
}

.seg-btn,
.time-range-btn {
  min-width: 44px;
  min-height: var(--iln-touch-min, 44px);
  flex: 1;
  padding: var(--iln-space-1) 0;
  border-radius: var(--iln-radius-sm);
  border: 1px solid var(--iln-border-subtle);
  font-size: var(--iln-font-sm);
  font-weight: 600;
  background: var(--iln-surface);
  color: var(--iln-hint);
  cursor: pointer;
  transition:
    background var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.time-range-btn {
  padding: var(--iln-space-2) 0;
}

.seg-btn.active,
.time-range-btn.active {
  background: var(--iln-brand);
  border-color: var(--iln-brand);
  color: var(--iln-text-on-brand);
}

.seg-btn:focus-visible,
.time-range-btn:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.chart-wrapper {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-card, 20px);
  padding: var(--iln-space-4, 16px);
  margin-bottom: var(--iln-space-3);
  min-height: 360px;
}

.chart {
  height: 360px;
  width: 100%;
}

.metric-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: var(--iln-space-3);
}

.metric-chip {
  min-width: 44px;
  min-height: var(--iln-touch-min, 44px);
  padding: var(--iln-space-1) var(--iln-space-3);
  border-radius: var(--iln-radius-full, 999px);
  border: 1px solid var(--iln-border-subtle);
  font-size: var(--iln-font-sm);
  font-weight: 600;
  background: var(--iln-surface);
  color: var(--iln-hint);
  cursor: pointer;
  transition:
    background var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.metric-chip.active {
  background: var(--iln-brand);
  border-color: var(--iln-brand);
  color: var(--iln-text-on-brand);
}

.metric-chip:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--iln-space-2);
}

@media (min-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.summary-card {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1);
}

.s-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.s-value {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}

.s-value.pos {
  color: var(--iln-viz-bull-text);
}

.s-value.neg {
  color: var(--iln-viz-bear-text);
}

@media (prefers-reduced-motion: reduce) {
  .chart-back-button,
  .seg-btn,
  .time-range-btn,
  .metric-chip {
    transition: none;
  }
}
</style>
