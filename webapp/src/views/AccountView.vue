<template>
  <GlobalErrorBoundary>
    <div class="account-view iln-page">
      <!-- ── Header ── -->
      <header class="page-header">
        <div class="page-header-row">
          <div>
            <h1 class="page-title">系統狀態</h1>
            <p class="page-subtitle">資料來源健康度 ＆ 總經快照</p>
          </div>
          <button
            type="button"
            class="refresh-btn"
            :disabled="loading"
            @click="load(true)"
          >
            {{ loading ? "更新中..." : "重新整理" }}
          </button>
        </div>
      </header>

      <!-- ── 設定項分組（策略參數 & 關於） ── -->
      <div class="settings-groups">
        <CollapsibleSection title="策略參數" :expanded="true" indicator="chevron">
          <template #default>
            <div class="settings-group strategy-params">
              <div class="setting-row">
                <span class="setting-label">目標配置與再平衡閾值</span>
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

        <CollapsibleSection
          title="關於"
          :expanded="aboutExpanded"
          indicator="chevron"
          @update:expanded="aboutExpanded = $event"
        >
          <template #default>
            <div class="settings-group about-panel" id="about">
              <h2 class="section-title">
                <Icon name="info" size="sm" color="var(--iln-hint)" />
                <span>關於</span>
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
      <template v-if="loading && !status">
        <section class="section" aria-label="載入中">
          <div class="sk sk-title"></div>
          <div class="sk sk-row"></div>
          <div class="sk sk-row"></div>
          <div class="sk sk-row short"></div>
        </section>
        <section class="section" aria-label="資料來源載入中">
          <div class="sk sk-title"></div>
          <div class="source-grid">
            <div v-for="n in 6" :key="n" class="sk sk-card"></div>
          </div>
        </section>
      </template>

      <!-- ── Error ── -->
      <ErrorAlert
        v-else-if="error && !status"
        :visible="true"
        :description="error"
        :show-retry="true"
        @retry="load(true)"
      />

      <!-- ── Content ── -->
      <template v-else-if="status">
        <!-- 1. 策略趨勢 (PR Trend) -->
        <section class="section" aria-label="PR 分位數趨勢">
          <h2 class="section-title">
            <Icon name="chart" size="sm" color="var(--iln-text)" />
            <span>PR 分位數趨勢 (30D)</span>
          </h2>
          <div class="trend-layout">
            <div class="trend-main">
              <v-chart
                v-if="prTrendPoints.length"
                class="trend-chart"
                :option="prTrendOption"
                autoresize
              />
              <p v-else class="trend-empty">尚無 PR 分位數趨勢資料</p>
            </div>
          </div>
        </section>

        <!-- 2. 帳戶快照 -->
        <section class="section" aria-label="帳戶快照">
          <div class="section-header-row">
            <h2 class="section-title">
              <Icon name="wallet-outline" size="sm" color="var(--iln-hint)" />
              <span>帳戶快照</span>
            </h2>
            <router-link
              :to="{ path: '/chart', query: { source: 'account' } }"
              class="chart-link-btn"
            >
              <Icon name="chart" size="sm" color="var(--iln-text)" />
              <span>資產趨勢圖表</span>
            </router-link>
          </div>

          <div v-if="!snapshotEncryption" class="notice-block">
            <span class="notice-icon">
              <Icon name="warn" size="sm" color="var(--iln-hint)" />
            </span>
            <div class="notice-content">
              <p class="notice-title">尚未啟用帳戶快照</p>
              <p class="notice-desc">
                請在伺服器設定 SNAPSHOT_ENCRYPT_KEY 環境變數以啟用加密快照功能。
              </p>
            </div>
          </div>

          <div
            v-else-if="snapshotEncryption && !latestSnapshot"
            class="notice-block notice-empty"
          >
            <span class="notice-icon">
              <Icon name="info" size="sm" color="var(--iln-hint)" />
            </span>
            <div class="notice-content">
              <p class="notice-title">尚無快照資料</p>
              <p class="notice-desc">快照將從下一次每日執行後開始累積。</p>
            </div>
          </div>

          <template v-else>
            <div class="snapshot-date tabular">
              <Icon name="clock" size="sm" color="var(--iln-hint)" />
              <span>{{ latestSnapshot.date }} 快照</span>
            </div>
            <div class="snapshot-grid tabular">
              <div
                v-for="card in snapshotCards"
                :key="card.key"
                class="snapshot-card"
              >
                <div class="snapshot-label">{{ card.label }}</div>
                <div class="snapshot-value">{{ card.value }}</div>
                <div class="snapshot-sub">{{ card.sub }}</div>
              </div>
            </div>
            <div v-if="latestSnapshot.lastBuyDate" class="snapshot-buyday tabular">
              最後買進日：{{ latestSnapshot.lastBuyDate }}
            </div>
          </template>
        </section>

        <!-- 3. 系統狀態摘要 -->
        <section class="section" aria-label="系統狀態摘要">
          <h2 class="section-title">
            <Icon name="settings" size="sm" color="var(--iln-hint)" />
            <span>系統狀態</span>
          </h2>
          <div class="info-row">
            <span class="info-label">資料最後更新</span>
            <span class="info-value tabular">{{ lastRunLabel }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">資料來源數量</span>
            <span class="info-value tabular">{{ sourceCount }} 個</span>
          </div>
          <div class="info-row">
            <span class="info-label">來源健康度</span>
            <span
              class="info-value tabular"
              :class="allHealthy ? 'text-ok' : 'text-warn'"
            >
              {{ healthyCount }}/{{ sourceCount }} 正常
            </span>
          </div>
        </section>

        <!-- 4. 部署管理（管理員操作） -->
        <section class="section" aria-label="部署管理">
          <DeploymentControl />
        </section>

        <!-- 5. 資料來源健康度 -->
        <section class="section" aria-label="資料證據">
          <DataEvidenceCard />
        </section>

        <section class="section" aria-label="資料來源明細">
          <CollapsibleSection
            title="資料來源"
            :expanded="showSourcesDetail"
            @update:expanded="showSourcesDetail = $event"
          >
            <template #default>
              <div class="sources-summary tabular">
                <span class="summary-item">總數：{{ sourceCount }} 個</span>
                <span
                  class="summary-item"
                  :class="allHealthy ? 'text-ok' : 'text-warn'"
                >
                  正常：{{ healthyCount }} 個
                </span>
                <span v-if="alertSourceCount" class="summary-item text-warn">
                  異常／逾時：{{ alertSourceCount }} 個
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
                  <div class="source-time tabular">{{ info.lastFetch }}</div>
                  <div v-if="info.ageLabel" class="source-age tabular">
                    {{ info.ageLabel }}
                  </div>
                  <div v-if="info.error" class="source-error">
                    {{ info.error }}
                  </div>
                </div>
              </div>
            </template>
          </CollapsibleSection>
        </section>
      </template>
    </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import Icon from "@/components/common/Icon.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import DataEvidenceCard from "../components/dashboard/DataEvidenceCard.vue";
import DeploymentControl from "@/components/common/DeploymentControl.vue";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import { waitReady } from "../composables/useTelegram.js";
import { useAccountViewModel } from "../composables/useAccountViewModel.js";

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

const route = useRoute();

const {
  status,
  loading,
  error,
  aboutExpanded,
  showSourcesDetail,
  latestSnapshot,
  snapshotEncryption,
  lastRunLabel,
  prTrendPoints,
  prTrendOption,
  sourcesDisplay,
  sourceCount,
  healthyCount,
  alertSourceCount,
  allHealthy,
  snapshotCards,
  load,
  initAccountPage,
} = useAccountViewModel();

onMounted(async () => {
  await waitReady();
  await initAccountPage(route.query.panel);
  if (route.query.panel === "about") {
    nextTick(() => {
      document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
    });
  }
});
</script>

<style scoped>
.account-view {
  padding: 0 0 calc(var(--bottom-nav-height, 88px) + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
  background: var(--iln-bg);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

/* ── Header ── */
.page-header {
  padding: var(--iln-space-5) var(--iln-space-4) var(--iln-space-3);
  background: var(--iln-bg);
  border-bottom: 1px solid var(--iln-border-subtle);
  margin-bottom: var(--iln-space-3);
}
.page-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-3);
}
.page-title {
  font-size: var(--iln-font-2xl, 22px);
  font-weight: 800;
  margin: 0 0 var(--iln-space-1);
  color: var(--iln-text);
  line-height: 1.25;
}
.page-subtitle {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin: 0;
}
.refresh-btn {
  padding: 7px 12px;
  border-radius: var(--iln-radius-md, 10px);
  border: 1px solid var(--iln-border-subtle);
  background: var(--iln-surface);
  color: var(--iln-text);
  font-size: var(--iln-font-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.refresh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── Section ── */
.section {
  background: var(--iln-bg);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-card, 20px);
  margin: 0 var(--iln-space-3) var(--iln-space-3);
  padding: 14px 14px var(--iln-space-3);
  box-shadow: var(--iln-shadow-subtle);
}
.section-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  font-weight: 700;
  color: var(--iln-hint);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}
.section-header-row .section-title {
  margin-bottom: 0;
}
.chart-link-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  font-weight: 700;
  color: var(--iln-brand);
  background: var(--iln-brand-fill-light);
  padding: var(--iln-space-1) 10px;
  border-radius: var(--iln-radius-full, 999px);
  text-decoration: none;
  transition:
    background var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}
.chart-link-btn:hover {
  background: var(--iln-brand-fill-strong);
}
.chart-link-btn:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

/* ── Info rows ── */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--iln-space-2);
  padding: 7px 0;
  border-bottom: 1px solid var(--iln-border-faint, var(--iln-border-subtle));
  font-size: var(--iln-font-sm);
}
.info-row:last-child {
  border-bottom: none;
}
.info-label {
  color: var(--iln-hint);
}
.info-value {
  font-weight: 700;
  color: var(--iln-text);
}

/* ── Source grid ── */
.source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--iln-space-2);
}
.source-card {
  border-radius: var(--iln-radius-lg, 16px);
  padding: var(--iln-space-3);
  border: 1px solid transparent;
  min-width: 0;
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
  gap: var(--iln-space-1);
  margin-bottom: var(--iln-space-1);
}
.source-name {
  font-size: var(--iln-font-xs);
  font-weight: 700;
  color: var(--iln-text);
  line-height: 1.35;
}
.source-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: var(--iln-radius-sm);
  letter-spacing: 0.3px;
  flex-shrink: 0;
}
.badge-ok {
  background: var(--iln-viz-bull-bg);
  color: var(--iln-viz-bull-text);
}
.badge-fail {
  background: var(--iln-viz-bear-bg);
  color: var(--iln-viz-bear-text);
}
.badge-stale {
  background: var(--iln-viz-alert-bg);
  color: var(--iln-viz-alert-text);
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
  color: var(--iln-viz-bear-text);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sources-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: var(--iln-space-3);
  font-size: var(--iln-font-xs);
  font-weight: 600;
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
  flex: 1;
  min-width: 0;
  background: var(--iln-surface-faintest, var(--iln-surface));
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-2);
  display: flex;
  flex-direction: column;
}
.trend-chart {
  flex: 1;
  width: 100%;
  height: 160px;
}
.trend-empty {
  margin: auto;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

/* ── Notice block ── */
.notice-block {
  display: flex;
  gap: var(--iln-space-3);
  align-items: flex-start;
  padding: var(--iln-space-3);
  background: var(--iln-brand-fill-faint, var(--iln-brand-soft));
  border-radius: var(--iln-radius-md);
  border: 1px solid var(--iln-brand-fill-border, var(--iln-border-subtle));
}
.notice-empty {
  background: var(--iln-neutral-fill-faint, var(--iln-surface));
  border-color: var(--iln-neutral-fill-border-faint, var(--iln-border-subtle));
}
.notice-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.notice-content {
  flex: 1;
  min-width: 0;
}
.notice-title {
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-text);
  margin: 0 0 var(--iln-space-1);
}
.notice-desc {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  line-height: 1.5;
  margin: 0;
}

/* ── Snapshot ── */
.snapshot-date {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  font-weight: 600;
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-2);
}
.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}
.snapshot-card {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-lg, 16px);
  padding: var(--iln-space-3);
  text-align: center;
}
.snapshot-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-1);
}
.snapshot-value {
  font-size: var(--iln-font-lg);
  font-weight: 800;
  color: var(--iln-text);
  line-height: 1.2;
}
.snapshot-sub {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: 2px;
}
.snapshot-buyday {
  font-size: var(--iln-font-xs);
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
  font-size: var(--iln-font-xs);
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
  font-size: var(--iln-font-sm);
  color: var(--iln-text);
  padding: var(--iln-space-1) 0;
  line-height: 1.45;
}

/* ── Color helpers ── */
.text-ok {
  color: var(--iln-viz-bull-text) !important;
}
.text-warn {
  color: var(--iln-viz-alert-text) !important;
}

/* ── Skeleton ── */
.sk {
  background: linear-gradient(90deg, var(--iln-skeleton-wave-bg, var(--iln-surface)) 25%, var(--iln-surface) 50%, var(--iln-skeleton-wave-bg, var(--iln-surface)) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--iln-radius-sm);
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
  border-radius: var(--iln-radius-lg, 16px);
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk,
  .chart-link-btn,
  .refresh-btn {
    animation: none;
    transition: none;
  }
}

/* ── 設定項分組 ── */
.settings-groups {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
  margin: 0 var(--iln-space-3) var(--iln-space-4);
}
.settings-group {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
}
.settings-group .setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}
.settings-group .setting-row:last-child {
  margin-bottom: 0;
}
.settings-group .setting-label {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-text);
}
.settings-group .setting-action-link {
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-brand);
  text-decoration: none;
}
.settings-group .setting-action-link:hover {
  text-decoration: underline;
}
.settings-group .setting-action-link:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}
.settings-group .setting-hint {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin: var(--iln-space-1) 0 0;
  line-height: 1.45;
}

@media (min-width: 768px) {
  .settings-groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
