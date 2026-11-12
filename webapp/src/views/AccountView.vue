<template>
  <GlobalErrorBoundary>
    <div class="account-view">
    <!-- ── Header ── -->
    <div class="page-header">
      <h1 class="page-title">系統狀態</h1>
      <p class="page-subtitle">資料來源健康度 ＆ 總經快照</p>
    </div>

    <!-- ── Skeleton ── -->
    <template v-if="loading">
      <div class="section">
        <div class="sk sk-title"></div>
        <div class="sk sk-row"></div>
        <div class="sk sk-row"></div>
        <div class="sk sk-row short"></div>
      </div>
      <div class="section">
        <div class="sk sk-title"></div>
        <div class="source-grid">
          <div v-for="n in 6" :key="n" class="sk sk-card"></div>
        </div>
      </div>
    </template>

    <!-- ── Error ── -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="load">重試</button>
    </div>

    <!-- ── Content ── -->
    <template v-else-if="status">
      <!-- 2. 策略趨勢 (PR Trend) -->
      <div class="section">
      <h2 class="section-title">📈 PR 分位數趨勢 (30D)</h2>
      <div class="trend-layout">
        <div class="trend-main">
          <v-chart class="trend-chart" :option="prTrendOption" autoresize />
        </div>
      </div>
      </div>

      <!-- 3. 帳戶快照 -->
      <div class="section">
        <div class="section-header-row">
          <h2 class="section-title">💼 帳戶快照</h2>
          <router-link to="/chart" class="chart-link-btn">
            📊 資產趨勢圖表 ↗
          </router-link>
        </div>

        <!-- 2a. 加密金鑰未設定 -->
        <div v-if="!snapshotEncryption" class="notice-block">
          <span class="notice-icon">🔐</span>
          <div class="notice-content">
            <p class="notice-title">尚未啟用帳戶快照</p>
            <p class="notice-desc">
              請在伺服器設定 SNAPSHOT_ENCRYPT_KEY 環境變數以啟用加密快照功能。
            </p>
          </div>
        </div>

        <!-- 2b. 有加密但尚無歷史資料 -->
        <div
          v-else-if="snapshotEncryption && !latestSnapshot"
          class="notice-block notice-empty"
        >
          <span class="notice-icon">📭</span>
          <div class="notice-content">
            <p class="notice-title">尚無快照資料</p>
            <p class="notice-desc">快照將從下一次每日執行後開始累積。</p>
          </div>
        </div>

        <!-- 2c. 顯示最新快照 -->
        <template v-else>
          <div class="snapshot-date">📅 {{ latestSnapshot.date }} 快照</div>
          <div class="snapshot-grid">
            <div class="snapshot-card">
              <div class="snapshot-label">0050 股數</div>
              <div class="snapshot-value">
                {{ latestSnapshot.qty0050.toLocaleString() }}
              </div>
              <div class="snapshot-sub">股</div>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-label">00675L 股數</div>
              <div class="snapshot-value">
                {{ latestSnapshot.qtyZ2.toLocaleString() }}
              </div>
              <div class="snapshot-sub">股</div>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-label">融資餘額</div>
              <div class="snapshot-value">
                {{ formatMoney(latestSnapshot.totalLoan) }}
              </div>
              <div class="snapshot-sub">元</div>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-label">現金儲備</div>
              <div class="snapshot-value">
                {{ formatMoney(latestSnapshot.cash) }}
              </div>
              <div class="snapshot-sub">元</div>
            </div>
            <div
              class="snapshot-card"
              v-if="latestSnapshot.avgCost0050 != null"
            >
              <div class="snapshot-label">0050 均價</div>
              <div class="snapshot-value">
                {{ Number(latestSnapshot.avgCost0050).toFixed(2) }}
              </div>
              <div class="snapshot-sub">元/股</div>
            </div>
            <div class="snapshot-card" v-if="latestSnapshot.avgCostZ2 != null">
              <div class="snapshot-label">00675L 均價</div>
              <div class="snapshot-value">
                {{ Number(latestSnapshot.avgCostZ2).toFixed(2) }}
              </div>
              <div class="snapshot-sub">元/股</div>
            </div>
          </div>
          <div v-if="latestSnapshot.lastBuyDate" class="snapshot-buyday">
            最後買進日：{{ latestSnapshot.lastBuyDate }}
          </div>
        </template>
      </div>

      <!-- 3. 系統最後更新時間 -->
      <div class="section">
        <h2 class="section-title">🕐 系統狀態</h2>
        <div class="info-row">
          <span class="info-label">資料最後更新</span>
          <span class="info-value">{{ lastRunLabel }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">資料來源數量</span>
          <span class="info-value">{{ sourceCount }} 個</span>
        </div>
        <div class="info-row">
          <span class="info-label">來源健康度</span>
          <span
            class="info-value"
            :class="allHealthy ? 'text-ok' : 'text-warn'"
          >
            {{ healthyCount }}/{{ sourceCount }} 正常
          </span>
        </div>
      </div>

      <!-- 4. 部署管理（管理員操作） -->
      <div class="section">
        <DeploymentControl />
      </div>

      <!-- 5. 資料來源健康度 -->
      <div class="section">
        <DataEvidenceCard />
      </div>

      <div class="section">
        <div class="section-header-row">
          <h2 class="section-title">📡 資料來源</h2>
          <button
            type="button"
            class="toggle-btn"
            @click="showSourcesDetail = !showSourcesDetail"
          >
            {{ showSourcesDetail ? "收合詳細" : "展開詳細" }}
          </button>
        </div>
        <div class="sources-summary">
          <span class="summary-item">總數：{{ sourceCount }} 個</span>
          <span
            class="summary-item"
            :class="allHealthy ? 'text-ok' : 'text-warn'"
          >
            正常：{{ healthyCount }} 個
          </span>
        </div>
        <div v-if="showSourcesDetail" class="source-grid">
          <div
            v-for="info in sourcesDisplay"
            :key="info.key"
            class="source-card"
            :class="{
              'source-ok': info.state === 'OK',
              'source-fail': info.state === 'FAIL',
              'source-stale': info.state === 'STALE',
            }"
          >
            <div class="source-header">
              <span class="source-name">{{ info.label }}</span>
              <span
                class="source-badge"
                :class="{
                  'badge-ok': info.state === 'OK',
                  'badge-fail': info.state === 'FAIL',
                  'badge-stale': info.state === 'STALE',
                }"
              >
                {{ info.state }}
              </span>
            </div>
            <div class="source-time">{{ info.lastFetch }}</div>
            <div v-if="info.ageLabel" class="source-age">
              {{ info.ageLabel }}
            </div>
            <div v-if="info.error" class="source-error">
              {{ info.error }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus, fetchReports } from "../api/index.js";
import { usePortfolioSnapshots } from "../composables/usePortfolioSnapshots.js";
import { waitReady } from "../composables/useTelegram.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import DataEvidenceCard from "../components/dashboard/DataEvidenceCard.vue";
import DeploymentControl from "../components/common/DeploymentControl.vue";

// ECharts
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  CanvasRenderer,
]);

// ── 系統狀態 ──────────────────────────────────────────
const status = ref(null);
const reports = ref([]);
const loading = ref(true);
const error = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [sData, rData] = await Promise.all([fetchStatus(), fetchReports(30)]);
    status.value = sData;
    // 按日期升序排列供圖表使用
    reports.value = (rData || []).reverse();
  } catch (e) {
    console.error("[AccountView] 無法載入運作狀態:", e);
    error.value = "無法載入運作狀態，請稍後再試";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await waitReady();
  load();
  loadSnapshots();
});

// ── 帳戶快照 ──────────────────────────────────────────
const {
  latestSnapshot,
  hasEncryption: snapshotEncryption,
  load: loadSnapshots,
} = usePortfolioSnapshots(1);

// ── 金額格式化 ────────────────────────────────────────
function formatMoney(val) {
  if (val == null) return "N/A";
  return Math.round(val).toLocaleString();
}

// ── _meta.lastRun ──
const lastRunLabel = computed(() => {
  const ts = status.value?._meta?.lastRun;
  if (!ts) return "N/A";
  return new Date(ts).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
});

// ── PR Trend Chart Option ──
const prTrendOption = computed(() => {
  const data = reports.value
    .map((r) => ({
      date: r.date.split("-").slice(1).join("/"),
      pr: r.signals?.valuationGuardResult?.currentPR ?? null,
    }))
    .filter((d) => d.pr !== null);

  return {
    tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
    grid: { left: "10%", right: "5%", top: "15%", bottom: "15%" },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLabel: { fontSize: 10, color: "#999" },
      axisLine: { lineStyle: { color: "#eee" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { fontSize: 10, color: "#999", formatter: "{value}%" },
      splitLine: { lineStyle: { type: "dashed", color: "#f0f0f0" } },
    },
    series: [
      {
        data: data.map((d) => d.pr),
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { color: "#2481cc", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(36, 129, 204, 0.2)" },
              { offset: 1, color: "rgba(36, 129, 204, 0)" },
            ],
          },
        },
      },
    ],
  };
});

// ── Sources ──
const SOURCE_LABELS = {
  ndcBusinessIndicator: "國發會景氣燈號",
  marginKgi: "台股融資餘額 (KGI)",
  cnnFearGreed: "CNN 恐懼貪婪",
  usMarketFred: "美股風險 (FRED)",
  twMarketValuation: "大盤 PB/PE",
  usdTwdYahoo: "USD/TWD 匯率",
  dailyQuote: "每日一句",
};

const showSourcesDetail = ref(false);

const sourcesDisplay = computed(() => {
  const raw = status.value?._meta?.sources || {};
  const now = Date.now();
  const list = [];
  for (const [key, src] of Object.entries(raw)) {
    const label = SOURCE_LABELS[key] || key;
    const statusText = src.status || "UNKNOWN";
    const lastFetchIso = src.lastFetch || null;
    let lastFetchLabel = "尚無資料";
    let ageLabel = "";
    let stale = false;
    if (lastFetchIso) {
      const ts = new Date(lastFetchIso);
      lastFetchLabel = ts.toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const diffHours = (now - ts.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 1) ageLabel = `${diffHours.toFixed(1)} 小時前更新`;
      else ageLabel = `${Math.max(1, Math.round(diffHours * 60))} 分鐘前更新`;

      // 智慧 STALE 判斷：景氣燈號(月更)容忍 35 天，其餘放寬至 72 小時
      const staleThreshold = key === "ndcBusinessIndicator" ? 35 * 24 : 72;
      if (diffHours > staleThreshold) stale = true;
    }
    let state = "UNKNOWN";
    if (statusText === "SUCCESS") state = stale ? "STALE" : "OK";
    else if (statusText === "FAILED") state = "FAIL";
    list.push({
      key,
      label,
      status: statusText,
      state,
      lastFetch: lastFetchLabel,
      ageLabel,
      error: src.error || null,
    });
  }
  const order = { FAIL: 0, STALE: 1, OK: 2, UNKNOWN: 3 };
  list.sort(
    (a, b) =>
      (order[a.state] ?? 3) - (order[b.state] ?? 3) ||
      a.label.localeCompare(b.label, "zh-Hant"),
  );
  return list;
});

const sourceCount = computed(() => sourcesDisplay.value.length);
const healthyCount = computed(
  () => sourcesDisplay.value.filter((s) => s.state === "OK").length,
);
const allHealthy = computed(
  () => sourceCount.value > 0 && healthyCount.value === sourceCount.value,
);

</script>

<style scoped>
.account-view {
  padding: 0 0 32px;
  min-height: 100%;
  background: var(--tg-theme-bg-color, #f5f5f5);
}

/* ── Header ── */
.page-header {
  padding: 20px 16px 12px;
  background: var(--tg-theme-bg-color, #fff);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--tg-theme-text-color, #111);
}
.page-subtitle {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  margin: 0;
}

/* ── Section ── */
.section {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  margin: 0 12px 12px;
  padding: 14px 14px 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #777);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.section-header-row .section-title {
  margin-bottom: 0;
}
.chart-link-btn {
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-theme-button-color, #2481cc);
  background: rgba(36, 129, 204, 0.1);
  padding: 4px 10px;
  border-radius: 999px;
  text-decoration: none;
  transition: all 0.2s ease;
}
.chart-link-btn:hover {
  background: rgba(36, 129, 204, 0.2);
}

/* ── Info rows ── */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 14px;
}
.info-row:last-child {
  border-bottom: none;
}
.info-label {
  color: var(--tg-theme-hint-color, #888);
}
.info-value {
  font-weight: 600;
  color: var(--tg-theme-text-color, #111);
}

/* ── Source grid ── */
.source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.source-card {
  border-radius: 8px;
  padding: 9px 10px;
  border: 1px solid transparent;
}
.source-ok {
  background: rgba(52, 199, 89, 0.08);
  border-color: rgba(52, 199, 89, 0.2);
}
.source-fail {
  background: rgba(255, 59, 48, 0.08);
  border-color: rgba(255, 59, 48, 0.2);
}
.source-stale {
  background: rgba(255, 204, 0, 0.08);
  border-color: rgba(255, 204, 0, 0.2);
}
.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.source-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #111);
}
.source-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.3px;
}
.badge-ok {
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
}
.badge-fail {
  background: var(--iln-danger-bg);
  color: var(--iln-danger-text);
}
.badge-stale {
  background: var(--iln-warn-bg);
  color: var(--iln-warn-text);
}
.source-time {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #aaa);
}
.source-age {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #999);
  margin-top: 2px;
}
.source-error {
  font-size: 10px;
  color: #c0392b;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sources-summary {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
  margin: 0 0 8px;
}
.summary-item {
  white-space: nowrap;
}

.toggle-btn {
  border: none;
  background: transparent;
  color: var(--tg-theme-button-color, #2481cc);
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 999px;
  cursor: pointer;
}

/* ── Trend Section ── */
.trend-layout {
  display: flex;
  gap: 12px;
  min-height: 180px;
}
.trend-main {
  flex: 1.5;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}
.trend-side {
  flex: 0.8;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.side-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.chart-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 2px;
}
.trend-chart {
  flex: 1;
  width: 100%;
  height: 160px;
}
.gauge-chart {
  width: 100%;
  height: 90px;
}

@media (max-width: 320px) {
  .trend-layout {
    flex-direction: column;
  }
  .trend-side {
    height: 140px;
  }
}

/* ── Macro grid ── */
.macro-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.macro-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
  padding: 10px 10px 8px;
  text-align: center;
}
.macro-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 4px;
}
.macro-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  line-height: 1;
}
.macro-sub {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-top: 3px;
}

/* ── Notice block ── */
.notice-block {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  background: rgba(36, 129, 204, 0.06);
  border-radius: 10px;
  border: 1px solid rgba(36, 129, 204, 0.15);
}
.notice-empty {
  background: rgba(180, 180, 180, 0.06);
  border-color: rgba(180, 180, 180, 0.2);
}
.notice-icon {
  font-size: 22px;
  flex-shrink: 0;
  margin-top: 1px;
}
.notice-content {
  flex: 1;
}
.notice-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 4px;
}
.notice-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.5;
  margin: 0;
}

/* ── Snapshot ── */
.snapshot-date {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 10px;
}
.snapshot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.snapshot-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
  padding: 10px 10px 8px;
  text-align: center;
}
.snapshot-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 4px;
}
.snapshot-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  line-height: 1;
}
.snapshot-sub {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-top: 3px;
}
.snapshot-buyday {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  text-align: right;
  margin-top: 4px;
}

/* ── About ── */
.about-block {
  text-align: center;
  padding: 4px 0 6px;
}
.about-name {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--tg-theme-text-color, #111);
}
.about-version {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 12px;
}
.about-features {
  list-style: none;
  margin: 0;
  padding: 0;
  text-align: left;
  display: inline-block;
}
.about-features li {
  font-size: 13px;
  color: var(--tg-theme-text-color, #333);
  padding: 4px 0;
  padding-left: 18px;
  position: relative;
}
.about-features li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--tg-theme-button-color, #2481cc);
  font-weight: 700;
}

/* ── Color helpers ── */
.text-ok {
  color: var(--iln-ok-text) !important;
}
.text-warn {
  color: var(--iln-warn-text) !important;
}
.text-danger {
  color: var(--iln-danger-text) !important;
}

/* ── Skeleton ── */
.sk {
  background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
}
.sk-title {
  height: 14px;
  width: 40%;
  margin-bottom: 12px;
}
.sk-row {
  height: 38px;
  margin-bottom: 6px;
  border-radius: 8px;
}
.sk-row.short {
  width: 60%;
}
.sk-card {
  height: 64px;
  border-radius: 8px;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

/* ── Error ── */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 16px;
  gap: 10px;
  color: var(--tg-theme-hint-color, #888);
  font-size: 14px;
}
.error-icon {
  font-size: 32px;
}
.retry-btn {
  margin-top: 6px;
  padding: 8px 20px;
  border-radius: 20px;
  border: none;
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  font-size: 14px;
  cursor: pointer;
}
</style>
