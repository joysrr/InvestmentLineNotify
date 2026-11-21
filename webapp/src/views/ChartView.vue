<template>
  <div class="chart-hub iln-page">
    <header class="hub-header">
      <div>
        <h1 class="hub-title">
          {{ activeTab === "trend" ? "資產趨勢" : "技術指標" }}
        </h1>
        <p class="hub-sub tabular">
          <template v-if="activeTab === 'trend'">
            {{ trendVm.granularityLabel }} · {{ timeRange }}
            <span v-if="dataPoints.length"> · {{ dataPoints.length }} 筆</span>
            <span v-if="trendVm.latestDateText"> · 最新：{{ trendVm.latestDateText }}</span>
          </template>
          <template v-else>
            波動、情緒、估值與槓桿訊號 · 視窗 {{ timeRange }}
            <span v-if="techVm.updatedAt"> · 更新：{{ formatDateTimeInTaipei(techVm.updatedAt) }}</span>
          </template>
        </p>
      </div>

      <button
        type="button"
        class="refresh-btn"
        :disabled="activeTab === 'trend' ? loadingTrend : loadingTech"
        @click="activeTab === 'trend' ? loadTrend() : loadTechnical()"
      >
        {{ (activeTab === "trend" ? loadingTrend : loadingTech) ? "載入中..." : "重新整理" }}
      </button>
    </header>

    <!-- 雙分頁切換（維持 ?tab=trend / ?tab=technical 路由相容） -->
    <nav class="tab-bar" role="tablist" aria-label="圖表功能分頁">
      <button
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ 'is-active': activeTab === 'trend' }"
        :aria-selected="activeTab === 'trend'"
        @click="switchTab('trend')"
      >
        資產趨勢
      </button>
      <button
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ 'is-active': activeTab === 'technical' }"
        :aria-selected="activeTab === 'technical'"
        @click="switchTab('technical')"
      >
        技術指標
      </button>
    </nav>

    <!-- 共用時間範圍列 -->
    <div class="range-bar" role="group" aria-label="時間範圍">
      <button
        v-for="t in TIME_RANGES"
        :key="t.key"
        type="button"
        class="range-btn tabular"
        :class="{ 'is-active': timeRange === t.key }"
        :aria-pressed="timeRange === t.key"
        @click="setTimeRange(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- ==================== 分頁 1：資產趨勢 ==================== -->
    <template v-if="activeTab === 'trend'">
      <!-- 粒度切換 -->
      <div class="gran-bar" role="group" aria-label="資料粒度">
        <button
          v-for="g in GRANULARITIES"
          :key="g.key"
          type="button"
          class="gran-btn tabular"
          :class="{ 'is-active': granularity === g.key }"
          :aria-pressed="granularity === g.key"
          @click="setGranularity(g.key)"
        >
          {{ g.label }}
        </button>
      </div>

      <!-- 指標切換 -->
      <div class="metric-bar" role="group" aria-label="趨勢指標">
        <button
          v-for="m in TREND_METRICS"
          :key="m.key"
          type="button"
          class="metric-chip tabular"
          :class="{ 'is-active': metric === m.key }"
          :aria-pressed="metric === m.key"
          @click="setMetric(m.key)"
        >
          {{ m.label }}
        </button>
      </div>

      <!-- 圖表輔助選項：區間均線 & 雙軸疊加標的價格 -->
      <div v-if="dataPoints.length >= 2" class="aux-bar" role="group" aria-label="圖表疊加設定">
        <button
          type="button"
          class="aux-chip tabular"
          :class="{ 'is-active': showMa }"
          :aria-pressed="showMa"
          @click="showMa = !showMa"
        >
          {{ trendVm.maLabel }}
        </button>
        <button
          v-if="trendVm.hasPriceOverlay"
          type="button"
          class="aux-chip tabular"
          :class="{ 'is-active': overlayTarget !== 'none' }"
          :aria-pressed="overlayTarget !== 'none'"
          @click="cycleOverlayTarget"
        >
          疊加價格：{{ overlayLabel }}
        </button>
      </div>

      <div v-if="trendError" class="alert-banner" role="alert">
        <span>{{ trendError }}</span>
        <button type="button" class="link-btn" @click="loadTrend">重試</button>
      </div>

      <div v-else-if="loadingTrend && !dataPoints.length" class="card muted">
        正在載入資產快照資料...
      </div>

      <div v-else-if="!hasEncryption" class="card empty-card">
        <div class="empty-title">快照功能未啟用</div>
        <p class="muted">請設定 SNAPSHOT_ENCRYPT_KEY 環境變數後重新整理。</p>
      </div>

      <div v-else-if="!dataPoints.length" class="card empty-card">
        <div class="empty-title">尚無快照資料</div>
        <p class="muted">將從每日報表執行後開始累積。</p>
      </div>

      <template v-else>
        <!-- 區間重點摘要卡（含最大回撤與連漲/連跌） -->
        <section v-if="trendVm.stats" class="card stats-strip tabular" aria-label="區間統計">
          <div class="stat-box">
            <span class="stat-k">最新 {{ trendVm.activeMetric.label }}</span>
            <strong class="stat-v" :class="valueToneClass(trendVm.stats.latest)">
              {{ formatMetricValue(trendVm.stats.latest, metric) }}
            </strong>
            <span class="stat-sub" :class="valueToneClass(trendVm.stats.delta)">
              較期初 {{ formatSignedMetric(trendVm.stats.delta, metric) }}
              <template v-if="trendVm.stats.deltaPct != null">
                ({{ trendVm.stats.deltaPct >= 0 ? "+" : "" }}{{ trendVm.stats.deltaPct.toFixed(1) }}%)
              </template>
            </span>
          </div>
          <div class="stat-box">
            <span class="stat-k">區間最高 / 最低</span>
            <strong class="stat-v">
              {{ formatCompactNum(trendVm.stats.max) }} / {{ formatCompactNum(trendVm.stats.min) }}
            </strong>
            <span class="stat-sub">
              均價：{{ formatCompactNum(trendVm.stats.avg) }}
            </span>
          </div>
          <div class="stat-box">
            <span class="stat-k">區間最大回撤 (MDD)</span>
            <strong class="stat-v neg">
              {{ trendVm.stats.mddPct != null ? `-${trendVm.stats.mddPct.toFixed(1)}%` : "—" }}
            </strong>
            <span class="stat-sub">
              {{ formatSignedMetric(-trendVm.stats.mddAbs, metric) }} · {{ trendVm.stats.streakText }}
            </span>
          </div>
        </section>

        <!-- ECharts 走勢圖 -->
        <section class="card chart-card" aria-label="資產走勢圖">
          <div class="chart-head">
            <span class="card-label">{{ trendVm.activeMetric.label }}走勢</span>
            <span class="chart-hint tabular">
              {{ granularity === "daily" ? "每日收盤快照" : granularity === "weekly" ? "每週彙總" : "每月彙總" }}
              <template v-if="showMa"> · 含{{ trendVm.maLabel }}</template>
              <template v-if="overlayTarget !== 'none'"> · 右軸 {{ overlayLabel }}</template>
            </span>
          </div>
          <div class="chart-canvas-wrap">
            <v-chart :option="chartOption" autoresize class="chart-canvas" />
          </div>
        </section>

        <!-- 最新快照四宮格 -->
        <section v-if="trendVm.latest" class="snapshot-grid tabular" aria-label="最新快照明細">
          <div class="snap-card">
            <span class="snap-k">市價淨值</span>
            <strong class="snap-v" :class="valueToneClass(trendVm.latest.netValueMarket)">
              {{ formatNTD(trendVm.latest.netValueMarket) }}
            </strong>
          </div>
          <div class="snap-card">
            <span class="snap-k">0050 市價</span>
            <strong class="snap-v">
              {{ trendVm.latest.price0050 != null ? `$${trendVm.latest.price0050}` : "—" }}
            </strong>
          </div>
          <div class="snap-card">
            <span class="snap-k">00675L 市價</span>
            <strong class="snap-v">
              {{ trendVm.latest.priceZ2 != null ? `$${trendVm.latest.priceZ2}` : "—" }}
            </strong>
          </div>
          <div class="snap-card">
            <span class="snap-k">融資餘額</span>
            <strong class="snap-v neg">
              {{ formatNTD(trendVm.latest.totalLoan) }}
            </strong>
          </div>
        </section>
      </template>
    </template>

    <!-- ==================== 分頁 2：技術指標 ==================== -->
    <template v-else>
      <div v-if="techError" class="alert-banner" role="alert">
        <span>{{ techError }}</span>
        <button type="button" class="link-btn" @click="loadTechnical">重試</button>
      </div>

      <div v-else-if="loadingTech && !techVm.items.length" class="card muted">
        正在載入技術指標與估值資料...
      </div>

      <div v-else-if="!techVm.items.length" class="card empty-card">
        <div class="empty-title">尚無技術指標資料</div>
        <p class="muted">請確認狀態與最新報表 API 是否已回傳指標數據。</p>
      </div>

      <template v-else>
        <!-- 技術訊號總覽 -->
        <section class="card tech-summary-card tabular" aria-label="技術訊號總覽">
          <div class="tech-sum-top">
            <div>
              <div class="card-label">技術面與估值判讀</div>
              <div class="tech-sum-headline">{{ techVm.summary.headline }}</div>
            </div>
            <span class="status-pill" :class="`pill-${techVm.summary.tone}`">
              {{ techVm.summary.badge }}
            </span>
          </div>
          <div class="tech-counts">
            <span class="count-chip is-bull">偏多 {{ techVm.summary.bullCount }} 項</span>
            <span class="count-chip is-bear">警戒／偏空 {{ techVm.summary.bearCount }} 項</span>
            <span class="count-chip is-neutral">中性 {{ techVm.summary.neutralCount }} 項</span>
          </div>
        </section>

        <!-- 指標篩選列 -->
        <div class="filter-bar" role="group" aria-label="指標狀態篩選">
          <button
            v-for="f in techFilters"
            :key="f.key"
            type="button"
            class="filter-chip tabular"
            :class="{ 'is-active': techFilter === f.key }"
            :aria-pressed="techFilter === f.key"
            @click="techFilter = f.key"
          >
            {{ f.label }}
          </button>
        </div>

        <!-- 指標卡片網格 -->
        <section class="card" aria-label="核心技術與估值指標">
          <div class="card-label">
            核心指標明細
            <span class="card-label-sub">（顯示 {{ filteredTechItems.length }} / {{ techVm.items.length }} 項）</span>
          </div>
          <div v-if="filteredTechItems.length" class="tech-grid tabular">
            <div
              v-for="item in filteredTechItems"
              :key="item.key"
              class="tech-cell"
              :class="`tone-${item.status}`"
            >
              <div class="tech-cell-top">
                <span class="tech-name">{{ item.label }}</span>
                <span class="tech-tag">{{ item.badge }}</span>
              </div>
              <strong class="tech-val">{{ item.valueText }}</strong>
              <span class="tech-sub">{{ item.subText }}</span>
            </div>
          </div>
          <p v-else class="muted">目前篩選條件下無符合指標。</p>
        </section>

        <!-- 融資、槓桿與匯率補充指標 -->
        <section v-if="techVm.extraRows.length" class="card" aria-label="補充監控指標">
          <div class="card-label">融資、槓桿與匯率補充</div>
          <div class="kv-list tabular">
            <div
              v-for="row in techVm.extraRows"
              :key="row.key"
              class="kv-row"
            >
              <span class="kv-k">{{ row.label }}</span>
              <span class="kv-v" :class="row.tone ? `tone-text-${row.tone}` : ''">
                {{ row.value }}
              </span>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  fetchSnapshots,
  fetchSnapshotsWeekly,
  fetchSnapshotsMonthly,
  fetchStatus,
  fetchReports,
} from "../api/index.js";
import {
  TIME_RANGES,
  GRANULARITIES,
  TREND_METRICS,
  toFiniteNumber,
  extractLatestReport,
  normalizeSnapshotList,
  buildTrendViewModel,
  buildTechnicalViewModel,
} from "../composables/buildChartViewModel.js";
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";

use([LineChart, TooltipComponent, GridComponent, MarkLineComponent, CanvasRenderer]);

const route = useRoute();
const router = useRouter();

const normalizeTab = (val) => (val === "technical" ? "technical" : "trend");
const activeTab = ref(normalizeTab(route.query.tab));

watch(
  () => route.query.tab,
  (next) => {
    activeTab.value = normalizeTab(next);
  },
);

function switchTab(tab) {
  const normalized = normalizeTab(tab);
  activeTab.value = normalized;
  router.replace({ query: { ...route.query, tab: normalized } }).catch(() => {});
  if (normalized === "technical" && !techVm.value.items.length && !loadingTech.value) {
    loadTechnical();
  }
}

// ── 篩選與圖表控制狀態 ──────────────────────────────────────────────────────────
const timeRange = ref("ALL");
const granularity = ref("daily");
const metric = ref("netValueMarket");
const showMa = ref(true);
const overlayTarget = ref("none"); // 'none' | 'price0050' | 'priceZ2'

function setTimeRange(key) {
  if (timeRange.value !== key) timeRange.value = key;
}

function setGranularity(key) {
  if (granularity.value !== key) granularity.value = key;
}

function setMetric(key) {
  metric.value = key;
}

// ── 分頁 1：資產趨勢資料載入與 ViewModel ─────────────────────────────────────────
const dataPoints = ref([]);
const loadingTrend = ref(false);
const trendError = ref("");
const hasEncryption = ref(true);

const trendVm = computed(() =>
  buildTrendViewModel({
    dataPoints: dataPoints.value,
    granularity: granularity.value,
    metric: metric.value,
    showMa: showMa.value,
    overlayTarget: overlayTarget.value,
  }),
);

const overlayLabel = computed(() => {
  if (overlayTarget.value === "price0050") return "0050 市價";
  if (overlayTarget.value === "priceZ2") return "00675L 市價";
  return "關閉";
});

function cycleOverlayTarget() {
  const { has50, hasZ2 } = trendVm.value;
  if (overlayTarget.value === "none") {
    if (has50) overlayTarget.value = "price0050";
    else if (hasZ2) overlayTarget.value = "priceZ2";
  } else if (overlayTarget.value === "price0050") {
    overlayTarget.value = hasZ2 ? "priceZ2" : "none";
  } else {
    overlayTarget.value = "none";
  }
}

async function loadTrend() {
  loadingTrend.value = true;
  trendError.value = "";
  try {
    const g = GRANULARITIES.find((item) => item.key === granularity.value) ?? GRANULARITIES[0];
    const rangeDef = TIME_RANGES.find((t) => t.key === timeRange.value);
    const limit =
      timeRange.value === "ALL" || !rangeDef?.limit
        ? g.limit
        : Math.min(g.limit, rangeDef.limit);

    let res;
    if (granularity.value === "daily") {
      res = await fetchSnapshots(limit);
    } else if (granularity.value === "weekly") {
      res = await fetchSnapshotsWeekly(limit);
    } else {
      res = await fetchSnapshotsMonthly(limit);
    }

    const normalized = normalizeSnapshotList(res, granularity.value);
    hasEncryption.value = normalized.hasEncryption;
    dataPoints.value = normalized.snapshots;
  } catch (err) {
    trendError.value = err?.message || "無法載入資產快照資料，請稍後再試。";
  } finally {
    loadingTrend.value = false;
  }
}

function formatNTD(val) {
  const n = toFiniteNumber(val);
  if (n === null) return "—";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatCompactNum(val) {
  const n = toFiniteNumber(val);
  if (n === null) return "—";
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString("zh-TW");
}

function formatMetricValue(val, mKey = metric.value) {
  const n = toFiniteNumber(val);
  if (n === null) return "—";
  if (mKey === "netValueMarket" || mKey === "totalLoan") {
    return formatNTD(n);
  }
  return `${n.toLocaleString("zh-TW")} 股`;
}

function formatSignedMetric(delta, mKey = metric.value) {
  const n = toFiniteNumber(delta);
  if (n === null) return "—";
  const prefix = n > 0 ? "+" : "";
  if (mKey === "netValueMarket" || mKey === "totalLoan") {
    return `${prefix}${formatNTD(n)}`;
  }
  return `${prefix}${n.toLocaleString("zh-TW")} 股`;
}

function formatYAxis(val) {
  const n = toFiniteNumber(val);
  if (n === null) return "—";
  if (metric.value === "netValueMarket" || metric.value === "totalLoan") {
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}萬`;
    return `$${formatCompactNum(n)}`;
  }
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}萬股`;
  return `${n}`;
}

function valueToneClass(val) {
  const n = toFiniteNumber(val);
  if (n === null) return "";
  if (metric.value === "totalLoan") return "neg";
  return n >= 0 ? "pos" : "neg";
}

function xAxisLabel(pt) {
  if (granularity.value === "daily") return String(pt?.date || "").slice(5);
  if (granularity.value === "weekly")
    return pt?.period || String(pt?.endDate ?? pt?.date ?? "").slice(5);
  return String(pt?.period ?? pt?.endDate ?? pt?.date ?? "").slice(0, 7);
}

const chartOption = computed(() => {
  const pts = dataPoints.value;
  if (!pts.length) return {};

  const { primarySeries, maSeries, overlaySeries, activeMetric, maLabel } = trendVm.value;
  const hasRightAxis = overlayTarget.value !== "none" && overlaySeries;

  const isBearMetric = metric.value === "totalLoan";
  const isBullMetric = metric.value === "netValueMarket";
  const strokeColor = isBearMetric ? "#f87171" : isBullMetric ? "#4ade80" : "#60a5fa";
  const fillTop = isBearMetric
    ? "rgba(248, 113, 113, 0.22)"
    : isBullMetric
      ? "rgba(74, 222, 128, 0.22)"
      : "rgba(96, 165, 250, 0.22)";
  const fillBottom = "rgba(22, 27, 34, 0.02)";

  const yAxes = [
    {
      type: "value",
      axisLabel: {
        fontSize: 10,
        color: "#9ca3af",
        formatter: (v) => formatYAxis(v),
      },
      splitLine: {
        lineStyle: {
          color: "rgba(156, 163, 175, 0.16)",
          type: "dashed",
        },
      },
    },
  ];

  if (hasRightAxis) {
    yAxes.push({
      type: "value",
      axisLabel: {
        fontSize: 10,
        color: "#fbbf24",
        formatter: (v) => `$${v}`,
      },
      splitLine: { show: false },
    });
  }

  const seriesList = [
    {
      name: activeMetric.label,
      type: "line",
      yAxisIndex: 0,
      smooth: true,
      connectNulls: false,
      symbol: pts.length <= 60 ? "circle" : "none",
      symbolSize: 5,
      data: primarySeries,
      lineStyle: { color: strokeColor, width: 2.2 },
      itemStyle: { color: strokeColor },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: fillTop },
            { offset: 1, color: fillBottom },
          ],
        },
      },
      markLine:
        metric.value === "netValueMarket"
          ? {
              silent: true,
              symbol: "none",
              data: [{ yAxis: 0 }],
              lineStyle: { color: "#9ca3af", type: "dashed", width: 1 },
            }
          : undefined,
    },
  ];

  if (maSeries) {
    seriesList.push({
      name: maLabel,
      type: "line",
      yAxisIndex: 0,
      smooth: true,
      connectNulls: true,
      symbol: "none",
      data: maSeries,
      lineStyle: {
        color: "#c084fc",
        width: 1.6,
        type: "dashed",
      },
      itemStyle: { color: "#c084fc" },
    });
  }

  if (hasRightAxis) {
    seriesList.push({
      name: overlayLabel.value,
      type: "line",
      yAxisIndex: 1,
      smooth: true,
      connectNulls: false,
      symbol: "none",
      data: overlaySeries,
      lineStyle: {
        color: "#fbbf24",
        width: 1.8,
      },
      itemStyle: { color: "#fbbf24" },
    });
  }

  return {
    backgroundColor: "transparent",
    grid: {
      left: 58,
      right: hasRightAxis ? 52 : 14,
      top: 18,
      bottom: 42,
    },
    xAxis: {
      type: "category",
      data: pts.map(xAxisLabel),
      axisLabel: {
        fontSize: 10,
        color: "#9ca3af",
        rotate: granularity.value === "monthly" ? 0 : 28,
        interval: "auto",
      },
      axisLine: { lineStyle: { color: "rgba(156, 163, 175, 0.35)" } },
      axisTick: { show: false },
    },
    yAxis: yAxes,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#11161d",
      borderColor: "rgba(255, 255, 255, 0.16)",
      textStyle: { color: "#f3f4f6", fontSize: 12 },
      formatter(params) {
        const idx = params?.[0]?.dataIndex ?? 0;
        const pt = pts[idx];
        if (!pt) return "";
        const val = toFiniteNumber(pt?.[metric.value]);
        const dateRange =
          granularity.value === "daily"
            ? pt.date
            : `${pt.startDate || ""} – ${pt.endDate || pt.date || ""}`;
        const lines = [
          `<b>${dateRange}</b>`,
          `${activeMetric.label}：<b>${formatMetricValue(val, metric.value)}</b>`,
        ];
        if (maSeries && maSeries[idx] != null) {
          lines.push(`${maLabel}：${formatMetricValue(maSeries[idx], metric.value)}`);
        }
        if (pt.netValueMarket != null && metric.value !== "netValueMarket") {
          lines.push(`市價淨值：${formatNTD(pt.netValueMarket)}`);
        }
        if (pt.price0050 != null) lines.push(`0050 市價：$${pt.price0050}`);
        if (pt.priceZ2 != null) lines.push(`00675L 市價：$${pt.priceZ2}`);
        if (pt.totalLoan != null && metric.value !== "totalLoan") {
          lines.push(`融資餘額：${formatNTD(pt.totalLoan)}`);
        }
        return lines.join("<br/>");
      },
    },
    series: seriesList,
  };
});

// ── 分頁 2：技術指標資料載入與 ViewModel ─────────────────────────────────────────
const loadingTech = ref(false);
const techError = ref("");
const statusPayload = ref(null);
const latestReportObj = ref(null);

const techFilters = [
  { key: "all", label: "全部指標" },
  { key: "alert", label: "警戒／偏空" },
  { key: "bull", label: "偏多／合理" },
];
const techFilter = ref("all");

const techVm = computed(() =>
  buildTechnicalViewModel({
    status: statusPayload.value,
    report: latestReportObj.value,
  }),
);

const filteredTechItems = computed(() => {
  const items = techVm.value.items;
  if (techFilter.value === "alert") {
    return items.filter((i) => i.status === "danger" || i.status === "warn");
  }
  if (techFilter.value === "bull") {
    return items.filter((i) => i.status === "ok" || i.status === "neutral");
  }
  return items;
});

async function loadTechnical() {
  loadingTech.value = true;
  techError.value = "";
  try {
    const [sRes, rRes] = await Promise.allSettled([
      fetchStatus(),
      fetchReports(3),
    ]);
    if (sRes.status === "fulfilled") statusPayload.value = sRes.value;
    if (rRes.status === "fulfilled") {
      latestReportObj.value = extractLatestReport(rRes.value);
    }
    if (sRes.status === "rejected" && rRes.status === "rejected") {
      techError.value = "無法取得技術指標資料，請稍後再試。";
    }
  } finally {
    loadingTech.value = false;
  }
}

watch([granularity, timeRange], () => {
  if (activeTab.value === "trend") {
    loadTrend();
  } else {
    loadTechnical();
  }
});

onMounted(() => {
  loadTrend();
  if (activeTab.value === "technical") {
    loadTechnical();
  }
});
</script>

<style scoped>
.chart-hub {
  max-width: 820px;
  margin: 0 auto;
  padding: 16px 16px 96px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--iln-text, #e5e7eb);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hub-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--iln-text, #f9fafb);
}

.hub-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--iln-hint, #9ca3af);
}

.refresh-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.14));
  background: var(--iln-surface, #161b22);
  color: var(--iln-text, #f3f4f6);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tab-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background: var(--iln-surface-alt, #11161d);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.1));
}

.tab-btn {
  padding: 9px 12px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--iln-hint, #9ca3af);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.tab-btn.is-active {
  background: var(--iln-surface, #1f2937);
  color: var(--iln-text, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}

.range-bar,
.gran-bar {
  display: grid;
  gap: 6px;
}

.range-bar {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.gran-bar {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.range-btn,
.gran-btn {
  min-height: 38px;
  border-radius: 10px;
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
  background: var(--iln-surface, #161b22);
  color: var(--iln-hint, #9ca3af);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.range-btn.is-active,
.gran-btn.is-active {
  background: var(--iln-brand, #3b82f6);
  border-color: var(--iln-brand, #3b82f6);
  color: #ffffff;
}

.metric-bar,
.aux-bar,
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.metric-chip,
.aux-chip,
.filter-chip {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
  background: var(--iln-surface, #161b22);
  color: var(--iln-hint, #9ca3af);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.metric-chip.is-active,
.filter-chip.is-active {
  background: var(--iln-brand, #3b82f6);
  border-color: var(--iln-brand, #3b82f6);
  color: #ffffff;
}

.aux-chip.is-active {
  background: rgba(192, 132, 252, 0.16);
  border-color: rgba(192, 132, 252, 0.45);
  color: #e9d5ff;
}

.card {
  background: var(--iln-surface, #161b22);
  color: var(--iln-text, #e5e7eb);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-hint, #9ca3af);
}

.card-label-sub {
  font-weight: 500;
}

.stats-strip {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

@media (min-width: 600px) {
  .stats-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.stat-box {
  background: var(--iln-surface-alt, #1c222b);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-k {
  font-size: 11px;
  color: var(--iln-hint, #9ca3af);
}

.stat-v {
  font-size: 16px;
  font-weight: 800;
  color: var(--iln-text, #f9fafb);
}

.stat-sub {
  font-size: 11px;
  color: var(--iln-hint, #cbd5e1);
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chart-hint {
  font-size: 11px;
  color: var(--iln-hint, #9ca3af);
}

.chart-canvas-wrap {
  width: 100%;
  height: 300px;
}

.chart-canvas {
  width: 100%;
  height: 100%;
}

.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

@media (min-width: 640px) {
  .snapshot-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.snap-card {
  background: var(--iln-surface, #161b22);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snap-k {
  font-size: 11px;
  color: var(--iln-hint, #9ca3af);
}

.snap-v {
  font-size: 15px;
  font-weight: 800;
  color: var(--iln-text, #f9fafb);
}

.pos {
  color: var(--iln-viz-bull-text, #4ade80);
}

.neg {
  color: var(--iln-viz-bear-text, #f87171);
}

.tech-summary-card {
  gap: 10px;
}

.tech-sum-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.tech-sum-headline {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 800;
  color: var(--iln-text, #f9fafb);
}

.status-pill {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.pill-bull {
  background: var(--iln-viz-bull-bg, rgba(22, 163, 74, 0.18));
  color: var(--iln-viz-bull-text, #4ade80);
  border: 1px solid var(--iln-viz-bull-border, rgba(74, 222, 128, 0.35));
}

.pill-bear {
  background: var(--iln-viz-bear-bg, rgba(220, 38, 38, 0.18));
  color: var(--iln-viz-bear-text, #f87171);
  border: 1px solid var(--iln-viz-bear-border, rgba(248, 113, 113, 0.35));
}

.pill-neutral {
  background: var(--iln-surface-alt, #1f2937);
  color: var(--iln-text, #e5e7eb);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.14));
}

.tech-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.count-chip {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--iln-surface-alt, #1c222b);
  color: var(--iln-text, #e5e7eb);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.1));
}

.count-chip.is-bull {
  color: var(--iln-viz-bull-text, #4ade80);
}

.count-chip.is-bear {
  color: var(--iln-viz-bear-text, #f87171);
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

@media (min-width: 640px) {
  .tech-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.tech-cell {
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  padding: 10px;
  background: var(--iln-surface-alt, #1c222b);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tech-cell.tone-ok {
  background: var(--iln-viz-bull-bg, rgba(22, 163, 74, 0.14));
  border-color: var(--iln-viz-bull-border, rgba(74, 222, 128, 0.3));
}

.tech-cell.tone-warn {
  background: var(--iln-viz-alert-bg, rgba(217, 119, 6, 0.15));
  border-color: rgba(251, 191, 36, 0.35);
}

.tech-cell.tone-danger {
  background: var(--iln-viz-bear-bg, rgba(220, 38, 38, 0.14));
  border-color: var(--iln-viz-bear-border, rgba(248, 113, 113, 0.3));
}

.tech-cell-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.tech-name {
  font-size: 11px;
  color: var(--iln-hint, #9ca3af);
}

.tech-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--iln-hint, #cbd5e1);
}

.tech-val {
  font-size: 16px;
  font-weight: 800;
  color: var(--iln-text, #f9fafb);
}

.tech-sub {
  font-size: 11px;
  color: var(--iln-hint, #cbd5e1);
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.kv-k {
  color: var(--iln-hint, #9ca3af);
}

.kv-v {
  font-weight: 700;
  color: var(--iln-text, #f3f4f6);
}

.tone-text-ok {
  color: var(--iln-viz-bull-text, #4ade80);
}

.tone-text-warn {
  color: #fbbf24;
}

.alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--iln-viz-bear-bg, rgba(220, 38, 38, 0.16));
  color: var(--iln-viz-bear-text, #fca5a5);
  border: 1px solid var(--iln-viz-bear-border, rgba(248, 113, 113, 0.35));
  font-size: 13px;
}

.link-btn {
  border: none;
  background: transparent;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.empty-card {
  gap: 4px;
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--iln-text, #f9fafb);
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--iln-hint, #9ca3af);
}
</style>
