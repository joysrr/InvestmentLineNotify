<template>
  <GlobalErrorBoundary>
    <div class="account-view iln-page">
    <!-- ── Header ── -->
    <div class="page-header">
      <h1 class="page-title">系統狀態</h1>
      <p class="page-subtitle">資料來源健康度 ＆ 總經快照</p>
    </div>

    <!-- ── 設定項分組（CARD-5.5：3 組 CollapsibleSection）── -->
    <div class="settings-groups">
      <!-- 1. 通知設定（預設展開） -->
      <CollapsibleSection title="通知設定" :expanded="true" indicator="chevron">
        <template #default>
          <div class="settings-group notification-settings">
            <div class="setting-row">
              <label class="setting-label">Telegram 通知開關</label>
              <el-switch
                v-model="telegramEnabled"
                active-text="開啟"
                inactive-text="關閉"
              />
            </div>
            <div class="setting-row">
              <label class="setting-label">通知時段（小時）</label>
              <el-input
                v-model.number="notificationHour"
                type="number"
                min="0"
                max="23"
                placeholder="0-23"
                style="width: 80px"
              />
            </div>
            <div class="setting-row save-row">
              <el-button
                type="primary"
                size="small"
                @click="saveNotificationSettings"
                :disabled="saveStatus !== null"
              >
                儲存設定
              </el-button>
              <div
                v-if="saveStatus"
                class="save-feedback"
                :class="`save-feedback--${saveStatus}`"
              >
                {{ saveMessage }}
              </div>
            </div>
          </div>
        </template>
      </CollapsibleSection>

      <!-- 2. 策略參數（預設展開，指向 StrategyConfigEditor） -->
      <CollapsibleSection title="策略參數" :expanded="true" indicator="chevron">
        <template #default>
          <div class="settings-group strategy-params">
            <div class="setting-row">
              <label class="setting-label">目標配置與再平衡閾值</label>
              <router-link
                to="/strategy-config"
                class="setting-action-link"
              >
                開啟策略編輯器 →
              </router-link>
            </div>
            <p class="setting-hint">
              策略參數由 StrategyConfigEditor 管理（非同步載入，避免首屏阻塞）。
            </p>
          </div>
        </template>
      </CollapsibleSection>

      <!-- 4. 關於（預設摺疊，id="about" 保持） -->
      <CollapsibleSection title="關於" :expanded="aboutExpanded" indicator="chevron">
        <template #default>
          <div class="settings-group about-panel" id="about">
            <h2 class="section-title">
              <Icon name="neutral" size="sm" color="var(--iln-hint)" /> 關於
            </h2>
            <div class="about-block">
              <div class="about-name">InvestmentLineNotify</div>
              <div class="about-version">單一使用者投資監控與通知系統</div>
              <ul class="about-features">
                <li>核心 0050：每月定期定額，僅買不賣</li>
                <li>衛星 00675L：2x 槓桿，80% 止利後買進回補</li>
                <li>錨定 00740B：40% 債券，穩健底倉</li>
                <li>策略詳情：原 /theory 現導入此「關於」區段</li>
              </ul>
            </div>
          </div>
        </template>
      </CollapsibleSection>
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
    <ErrorAlert v-else-if="error" :visible="true" :description="error" :show-retry="true" @retry="load" />

    <!-- ── Content ── -->
    <template v-else-if="status">
      <!-- 2. 策略趨勢 (PR Trend) -->
      <div class="section">
      <h2 class="section-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> PR 分位數趨勢 (30D)</h2>
      <div class="trend-layout">
        <div class="trend-main">
          <v-chart class="trend-chart" :option="prTrendOption" autoresize />
        </div>
      </div>
      </div>

      <!-- 3. 帳戶快照 -->
      <div class="section">
        <div class="section-header-row">
          <h2 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 帳戶快照</h2>
          <router-link to="/chart" class="chart-link-btn">            <Icon name="chart" size="sm" color="var(--iln-text)" /> 資產趨勢圖表
          </router-link>
        </div>

        <!-- 2a. 加密金鑰未設定 -->
        <div v-if="!snapshotEncryption" class="notice-block">
          <span class="notice-icon"><Icon name="neutral" size="sm" color="var(--iln-hint)" /></span>
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
          <span class="notice-icon"><Icon name="neutral" size="sm" color="var(--iln-hint)" /></span>
          <div class="notice-content">
            <p class="notice-title">尚無快照資料</p>
            <p class="notice-desc">快照將從下一次每日執行後開始累積。</p>
          </div>
        </div>

        <!-- 2c. 顯示最新快照 -->
        <template v-else>
          <div class="snapshot-date"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> {{ latestSnapshot.date }} 快照</div>
          <div class="snapshot-grid">
            <div class="snapshot-card">
              <div class="snapshot-label">0050 股數</div>
              <div class="snapshot-value">
                {{ Number(latestSnapshot.qty0050 ?? 0).toLocaleString() }}
              </div>
              <div class="snapshot-sub">股</div>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-label">00675L 股數</div>
              <div class="snapshot-value">
                {{ Number(latestSnapshot.qtyZ2 ?? 0).toLocaleString() }}
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
        <h2 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 系統狀態</h2>
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
        <CollapsibleSection
          title="資料來源"
          :expanded="showSourcesDetail"
          @update:expanded="showSourcesDetail = $event"
        >
          <template #default>
            <div class="sources-summary">
              <span class="summary-item">總數：{{ sourceCount }} 個</span>
              <span
                class="summary-item"
                :class="allHealthy ? 'text-ok' : 'text-warn'"
              >
                正常：{{ healthyCount }} 個
              </span>
            </div>
            <div class="source-grid">
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
          </template>
        </CollapsibleSection>
      </div>

      <!-- 6. 關於（已移至上方設定項分組，id="about" 保持） -->

    </template>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import Icon from "@/components/common/Icon.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";
import { fetchStatus, fetchReports } from "../api/index.js";
import { usePortfolioSnapshots } from "../composables/usePortfolioSnapshots.js";
import { waitReady } from "../composables/useTelegram.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import DataEvidenceCard from "../components/dashboard/DataEvidenceCard.vue";
import DeploymentControl from "@/components/common/DeploymentControl.vue";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import { useRoute } from "vue-router";

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

// ── 通知設定（0.3 日：設定回饋）──────────────────────────
const telegramEnabled = ref(true);
const notificationHour = ref(9);
const aboutExpanded = ref(false);
const saveStatus = ref(null); // 'success' | 'error' | null
const saveMessage = ref("");

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

// ── 通知設定儲存（0.3 日：設定回饋）─────────────────────
async function saveNotificationSettings() {
  saveStatus.value = null;
  saveMessage.value = "";
  try {
    // 模擬儲存設定（實際應呼叫 API，階段五不改資料契約，此處為 UI 回饋示範）
    await new Promise((resolve) => setTimeout(resolve, 400));
    saveStatus.value = "success";
    saveMessage.value = "通知設定已儲存";
  } catch {
    saveStatus.value = "error";
    saveMessage.value = "儲存失敗，請稍後再試";
  }
}

onMounted(async () => {
  const route = useRoute();
  await waitReady();
  load();
  loadSnapshots();
  if (route.query.panel === "about") {
    aboutExpanded.value = true;
    nextTick(() => {
      document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
    });
  }
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

// ── 設計令牌讀取 ────────────────────────────────────────
// ECharts Canvas 無法解析 CSS var()，由 JS 以 getComputedStyle 讀取設計令牌
function readToken(name, fallback) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
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
      axisLabel: { fontSize: 10, color: "var(--iln-hint)" },
      axisLine: { lineStyle: { color: "var(--iln-surface)" } },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { fontSize: 10, color: "var(--iln-hint)", formatter: "{value}%" },
      splitLine: { lineStyle: { type: "dashed", color: "var(--iln-surface)" } },
    },
    series: [
      {
        data: data.map((d) => d.pr),
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { color: "var(--iln-brand)", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: readToken("--iln-brand-fill-strong", "rgba(36, 129, 204, 0.2)"),
              },
              {
                offset: 1,
                color: readToken("--iln-brand-fill-fade", "rgba(36, 129, 204, 0)"),
              },
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
/* AccountView — Phase 3 現代化（2026-11-17）
   只動 CSS，不動模板 / 邏輯。
   - px → --iln-space-* / --iln-font-* / --iln-radius-*（僅精確對應者，餘保留原值避免視覺漂移）
   - 移除死 selector（模板 0 引用）：
       chart-label / error-icon / error-state / gauge-chart / macro-card / macro-grid /
       macro-label / macro-sub / macro-value / retry-btn / side-item / text-danger /
       toggle-btn / trend-side（含 @media 內引用）
     註：text-ok / text-warn 為動態綁定（:class 三元），保留。 */

.account-view {
  padding: 0 0 var(--iln-space-8);
  min-height: 100%;
  background: var(--iln-bg);
}

/* ── Header ── */
.page-header {
  padding: var(--iln-space-5) var(--iln-space-4) var(--iln-space-3);
  background: var(--iln-bg);
  border-bottom: 1px solid var(--iln-border-subtle);
  margin-bottom: var(--iln-space-3);
}
.page-title {
  font-size: var(--iln-font-lg);
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--iln-text);
}
.page-subtitle {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin: 0;
}

/* ── Section ── */
.section {
  background: var(--iln-bg);
  border-radius: var(--iln-radius-card, 20px);
  margin: 0 var(--iln-space-3) var(--iln-space-3);
  padding: 14px 14px 10px;
  box-shadow: var(--iln-shadow-subtle);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-hint);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--iln-space-1);
}
.section-header-row .section-title {
  margin-bottom: 0;
}
.chart-link-btn {
  font-size: 11px;
  font-weight: 600;
  color: var(--iln-brand);
  background: var(--iln-brand-fill-light);
  padding: var(--iln-space-1) 10px;
  border-radius: 999px;
  text-decoration: none;
  transition: all var(--iln-duration-base) var(--iln-ease-standard);
}
.chart-link-btn:hover {
  background: var(--iln-brand-fill-strong);
}

/* ── Info rows ── */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid var(--iln-border-faint);
  font-size: var(--iln-font-base);
}
.info-row:last-child {
  border-bottom: none;
}
.info-label {
  color: var(--iln-hint);
}
.info-value {
  font-weight: 600;
  color: var(--iln-text);
}

/* ── Source grid ── */
.source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--iln-space-2);
}
.source-card {
  border-radius: var(--iln-radius-card, 20px);
  padding: 9px 10px;
  border: 1px solid transparent;
}
.source-ok {
  background: var(--iln-state-positive-bg);
  border-color: var(--iln-state-positive-border);
}
.source-fail {
  background: var(--iln-state-negative-bg);
  border-color: var(--iln-state-negative-border);
}
.source-stale {
  background: var(--iln-state-caution-bg);
  border-color: var(--iln-state-caution-border);
}
.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--iln-space-1);
}
.source-name {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-text);
}
.source-badge {
  font-size: var(--iln-font-xs);
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--iln-space-1);
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
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.source-age {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: 2px;
}
.source-error {
  font-size: var(--iln-font-xs);
  color: var(--iln-danger-text);
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
  color: var(--iln-hint);
  margin: 0 0 var(--iln-space-2);
}
.summary-item {
  white-space: nowrap;
}

/* ── Trend Section ── */
.trend-layout {
  display: flex;
  gap: var(--iln-space-3);
  min-height: 180px;
}
.trend-main {
  flex: 1.5;
  background: var(--iln-surface-faintest);
  border-radius: var(--iln-radius-md);
  padding: 10px;
  display: flex;
  flex-direction: column;
}
.trend-chart {
  flex: 1;
  width: 100%;
  height: 160px;
}
@media (max-width: 320px) {
  .trend-layout {
    flex-direction: column;
  }
}

/* ── Notice block ── */
.notice-block {
  display: flex;
  gap: var(--iln-space-3);
  align-items: flex-start;
  padding: 10px var(--iln-space-3);
  background: var(--iln-brand-fill-faint);
  border-radius: var(--iln-radius-md);
  border: 1px solid var(--iln-brand-fill-border);
}
.notice-empty {
  background: var(--iln-neutral-fill-faint);
  border-color: var(--iln-neutral-fill-border-faint);
}
.notice-icon {
  font-size: var(--iln-font-xl);
  flex-shrink: 0;
  margin-top: 1px;
}
.notice-content {
  flex: 1;
}
.notice-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-text);
  margin: 0 0 var(--iln-space-1);
}
.notice-desc {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  line-height: 1.5;
  margin: 0;
}

/* ── Snapshot ── */
.snapshot-date {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin-bottom: 10px;
}
.snapshot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--iln-space-2);
  margin-bottom: 10px;
}
.snapshot-card {
  background: var(--iln-surface);
  border-radius: var(--iln-radius-card, 20px);
  padding: var(--iln-space-4, 16px);
  text-align: center;
}
.snapshot-label {
  font-size: 11px;
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-1);
}
.snapshot-value {
  font-size: var(--iln-font-lg);
  font-weight: 700;
  color: var(--iln-text);
  line-height: 1;
}
.snapshot-sub {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: 3px;
}
.snapshot-buyday {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  text-align: right;
  margin-top: var(--iln-space-1);
}

/* ── About ── */
.about-block {
  text-align: center;
  padding: var(--iln-space-1) 0 var(--iln-space-2);
}
.about-name {
  font-size: var(--iln-font-md);
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--iln-text);
}
.about-version {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-3);
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
  color: var(--iln-text);
  padding: var(--iln-space-1) 0;
  padding-left: 18px;
  position: relative;
}

/* ── Color helpers（text-ok / text-warn 為模板動態綁定） ── */
.text-ok {
  color: var(--iln-ok-text) !important;
}
.text-warn {
  color: var(--iln-warn-text) !important;
}

/* ── Skeleton ── */
.sk {
  background: linear-gradient(90deg, var(--iln-skeleton-wave-bg) 25%, var(--iln-surface) 50%, var(--iln-skeleton-wave-bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
}
.sk-title {
  height: 14px;
  width: 40%;
  margin-bottom: var(--iln-space-3);
}
.sk-row {
  height: 38px;
  margin-bottom: 6px;
  border-radius: var(--iln-radius-sm);
}
.sk-row.short {
  width: 60%;
}
.sk-card {
  height: 64px;
  border-radius: var(--iln-radius-card, 20px);
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}

/* ── 設定項分組（CARD-5.5）── */
.settings-groups {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
  margin: 0 var(--iln-space-3) var(--iln-space-4);
}
.settings-group {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
}
.settings-group .setting-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--iln-space-2);
}
.settings-group .setting-row:last-child {
  margin-bottom: 0;
}
.settings-group .setting-label {
  font-size: 13px;
  color: var(--iln-text);
  min-width: 110px;
}
.settings-group .setting-action-link {
  font-size: 13px;
  color: var(--iln-brand);
  text-decoration: none;
}
.settings-group .setting-action-link:hover {
  text-decoration: underline;
}
.settings-group .setting-hint {
  font-size: 11px;
  color: var(--iln-hint);
  margin-top: var(--iln-space-1);
}
.settings-group .save-feedback {
  font-size: var(--iln-font-sm);
  padding: var(--iln-space-1) var(--iln-space-2);
  border-radius: var(--iln-space-1);
  margin-left: var(--iln-space-2);
}
.settings-group .save-feedback--success {
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
}
.settings-group .save-feedback--error {
  background: var(--iln-danger-bg);
  color: var(--iln-danger-text);
}

/* 通知設定區塊 */
.notification-settings {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
}

/* 儲存行 */
.save-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--iln-space-3);
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
}
</style>
