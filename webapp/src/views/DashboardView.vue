<template>
  <GlobalErrorBoundary>
    <div class="view-container iln-page">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-title-row">
        <h1 class="dash-title">投資儀表板</h1>
        <!-- FAB: Strategy Config -->
        <button
          class="config-fab"
          data-testid="fab-strategy-config"
          @click="configDrawerVisible = true"
          title="策略設定"
          aria-label="策略設定"
        >          <Icon name="settings" size="sm" color="var(--iln-hint)" />
        </button>
      </div>
      <span class="dash-date">{{ todayLabel }}</span>
    </div>

    <!-- Strategy Config Drawer -->
    <el-drawer
      v-model="configDrawerVisible"
      title="策略設定"
      :append-to-body="true"
      size="80%"
    >
      <StrategyConfigEditorView />
    </el-drawer>

    <!-- Strategy Status Drawer（由 HealthPanel / 摘要卡 / redirect query 開啟） -->
    <el-drawer
      v-model="strategyStatusDrawerVisible"
      title="策略狀態"
      :append-to-body="true"
      size="80%"
    >
      <component
        v-if="strategyStatusPanel"
        :is="strategyStatusPanel"
        :health="healthData"
        :loading="healthLoading"
        :error="healthError"
      />
    </el-drawer>

    <!-- Tab Contents -->
    <div class="tab-content-area fade-in">
      <!-- 1. 首屏核心決策 hero -->
      <DecisionHero
        v-if="latestReport"
        :report="latestReport"
        :loading="reportLoading"
        :error="reportError"
        :active-priority="activePriority"
        :target-class="targetClass"
        :pct-class="pctClass"
        :pct-text="pctText"
        :routing-path="routingPath"
      />
      <EmptyState
        v-else
        title="報表暫無資料"
        message="尚未收到最新的投資報表，請稍後再試"
        action-text="重新整理"
        @action="loadAll"
      />

      <!-- 2. 雙核心駕駛艙 (L2: 總經象限 + 資產安全防護) -->
      <section class="cockpit-section iln-grid iln-grid--2 fade-up fade-up--stagger-1" data-testid="dual-cockpit-section">
        <MacroCockpitCard
          :regime-level="regimeLevel"
          :vix="status?.data?.rawUsMarket?.vix ?? latestReport?.signals?.vix ?? '—'"
          :vix-override-active="vixOverrideActive"
          @open-drawer="marketDrawerVisible = true"
        />
        <PortfolioShieldCard
          :margin-ratio="latestReport?.portfolio?.maintenanceRatio ?? latestReport?.signals?.portfolio?.maintenanceRatio ?? 0"
          :warning-threshold="160"
          :gross-leverage="glValue"
          @open-drawer="riskDrawerVisible = true"
        />
      </section>

      <!-- Phase 3：Dashboard → Radar 連結 -->
      <div class="radar-entry">
        <router-link :to="{ path: '/insights', query: { tab: 'radar' } }" class="radar-entry-link">          <Icon name="arrow-right" size="sm" color="var(--iln-hint)" /> 查看完整市場雷達 →
        </router-link>
      </div>

      <!-- L3: 市場總經環境明細抽屜 -->
      <MarketDetailDrawer
        v-model:visible="marketDrawerVisible"
        :vix="status?.data?.rawUsMarket?.vix ?? latestReport?.signals?.vix ?? '—'"
        :pb-pr-value="pbPrValue"
        :pb-pr-level="pbPrLevel"
        :light-emoji="lightEmoji"
        :light-text="lightText"
        :margin-change5d="status?.data?.rawMargin?.marginBalanceChangePercent5d ?? 0"
        :margin-overheated="latestReport?.signals?.macroRegime?.isMarginOverheated ?? false"
      />

      <!-- L3: 資產風控與維持率明細抽屜 -->
      <RiskDetailDrawer
        v-model:visible="riskDrawerVisible"
        :margin-ratio="latestReport?.portfolio?.maintenanceRatio ?? latestReport?.signals?.portfolio?.maintenanceRatio ?? 0"
        :gross-leverage="glValue"
        :hard-cap-leverage="3.0"
        :warning-threshold="160"
        :drop-buffer-percent="dropBufferPercent"
      />

      <!-- 3. 帳戶健康度監控 (0-100) -->
      <section class="dashboard-card health-card fade-up fade-up--stagger-2">
        <!-- expired 降級提示（L1 區塊頂部） -->
        <div v-if="freshnessLevel === 'expired'" class="freshness-expired-alert"><Icon name="warn" size="sm"/> 資料已超過 6 小時未更新，建議確認排程狀態</div>

        <!-- FreshnessBadge 在 L1 頂部（與 expired 警示條同區塊） -->
        <FreshnessBadge
          v-if="status?._meta?.lastRun"
          :timestamp="status._meta.lastRun"
          label="資料更新"
          @level-change="handleFreshnessLevelChange"
        />

        <HealthPanel
          v-if="healthData"
          :data="healthData"
          :loading="healthLoading"
          :error="healthError"
          @open-strategy-status="strategyStatusDrawerVisible = true"
          @retry="loadAll"
        />
        <EmptyState
          v-else
          title="健康度資料暫無"
          message="帳戶健康度評估尚未產生，請稍後再試"
          action-text="重新整理"
          @action="loadAll"
        />
      </section>

      <!-- 4. AI 教練建議與推演 -->
      <CoachingAdvice
        :report="latestReport"
        :risks="aiRiskWarnings"
        :actions="aiActionItems"
        :mindset="aiMindsetAdvice"
        :thinking="aiInternalThinking"
        :insight="aiCoreInsight"
        :verdict="aiStrategyVerdict"
      />

      <!-- Strategy Status 摘要卡（Phase 3：由連結改為內嵌摘要，點擊開啟 drawer） -->
      <section class="dashboard-card strategy-status-link fade-up fade-up--stagger-1">
        <component
          v-if="strategyStatusSummary && status"
          :is="strategyStatusSummary"
          :health="healthData"
          :loading="healthLoading"
          :error="healthError"
          @click="strategyStatusDrawerVisible = true"
        />
        <EmptyState
          v-else-if="!healthLoading && !statusLoading"
          title="策略狀態暫無資料"
          message="尚未收到策略狀態，請稍後再試"
          action-text="重新整理"
          @action="loadAll"
        />
        <div v-else class="skeleton-list">
          <div class="sk sk-hero" style="height: 80px; margin-bottom: 12px"></div>
        </div>
      </section>
    </div>

    <!-- Footer meta -->
    <p v-if="status?._meta?.lastRun" class="update-time">
      資料更新：{{ formatUpdatedAt(status._meta.lastRun) }}
    </p>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted, watch, defineAsyncComponent } from "vue";
import { usePageState } from "@/composables/usePageState.js";
import { useRoute } from "vue-router";
import Icon from "@/components/common/Icon.vue";
import {
  fetchStatus,
  fetchReports,
  fetchPortfolioHealth,
} from "../api/index.js";
import { prefetch } from "../composables/useRoutePrefetch.js";
import { viewLoaders } from "../router/index.js";
import { getPrLevel } from "@/utils/metricThresholds.js";

// Components
import MacroCockpitCard from "../components/dashboard/MacroCockpitCard.vue";
import PortfolioShieldCard from "../components/dashboard/PortfolioShieldCard.vue";
import MarketDetailDrawer from "../components/dashboard/MarketDetailDrawer.vue";
import RiskDetailDrawer from "../components/dashboard/RiskDetailDrawer.vue";
import DecisionHero from "../components/dashboard/DecisionHero.vue";
import HealthPanel from "../components/dashboard/HealthPanel.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import FreshnessBadge from "@/components/common/FreshnessBadge.vue";
import CoachingAdvice from "@/components/dashboard/CoachingAdvice.vue";
const StrategyConfigEditorView = defineAsyncComponent(() =>
  import("@/views/StrategyConfigEditor.vue"),
);
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";

// ── State ──
// Single-page card layout: no top-level tab switcher
const configDrawerVisible = ref(false); // Strategy Config drawer
const strategyStatusDrawerVisible = ref(false); // 策略狀態 drawer（由 HealthPanel / 摘要卡 開啟）
const route = useRoute();

// Lazy-loaded 策略狀態元件（避免佔用初始體積預算）
const strategyStatusSummary = ref(null);
const strategyStatusPanel = ref(null);

const loadStrategyStatusSummary = async () => {
  if (!strategyStatusSummary.value) {
    const mod = await import("../components/dashboard/StrategyStatusSummary.vue");
    strategyStatusSummary.value = mod.default;
  }
};
const loadStrategyStatusPanel = async () => {
  if (!strategyStatusPanel.value) {
    const mod = await import("../components/dashboard/StrategyStatusPanel.vue");
    strategyStatusPanel.value = mod.default;
  }
};
const statusState = usePageState();
const reportState = usePageState();
const healthState = usePageState();

// 合併別名：保持 template 與現有 computed 的引用名稱不變
const status = computed(() => statusState.data.value);
const statusLoading = computed(() => statusState.loading.value);

const latestReport = computed(() => {
  const r = reportState.data.value;
  if (!r) return null;
  return Array.isArray(r) ? r[0] : (r.data?.[0] ?? null);
});
const reportLoading = computed(() => reportState.loading.value);
const reportError = computed(() => reportState.error.value);

const healthData = computed(() => healthState.data.value);
const healthLoading = computed(() => healthState.loading.value);
const healthError = computed(() => healthState.error.value);

// L3 Drawers 顯示控制
const marketDrawerVisible = ref(false);
const riskDrawerVisible = ref(false);

// FreshnessBadge level 追蹤（用於 expired 降級提示）
const freshnessLevel = ref("fresh");

const handleFreshnessLevelChange = (level) => {
  freshnessLevel.value = level;
};

const dropBufferPercent = computed(() => {
  const m = Number(latestReport.value?.portfolio?.maintenanceRatio ?? latestReport.value?.signals?.portfolio?.maintenanceRatio) || 0;
  if (m <= 160) return 0;
  return Math.round(((m - 160) / m) * 100);
});

// ── Computed: Market Indicators ──
const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

const regimeLevel = computed(() => {
  const sigs = latestReport.value?.signals;
  // 優先讀取 Macro Regime 2.0 四象限狀態，回退至舊版 regimeResult
  const macroState = sigs?.macroRegime?.state || sigs?.regimeState;

  if (macroState === "BULL_TREND") {
    return {
      label: "強趨勢多頭",
      cardClass: "card-ok",
      textClass: "text-ok",
      subLabel: "動能 70% 順勢進攻",
    };
  }
  if (macroState === "BULL_VOLATILE") {
    return {
      label: "劇烈震盪多頭",
      cardClass: "card-warn",
      textClass: "text-warn",
      subLabel: "左側逢低超跌買進",
    };
  }
  if (macroState === "BEAR_CHOPPY") {
    return {
      label: "陰跌盤整期",
      cardClass: "card-warn",
      textClass: "text-warn",
      subLabel: "持有成本濾網 (僅DCA)",
    };
  }
  if (macroState === "BEAR_PANIC" || macroState === "CRISIS") {
    return {
      label: "極端恐慌危機",
      cardClass: "card-danger",
      textClass: "text-danger",
      subLabel: "強制 Sell-only 保全部位",
    };
  }
  if (macroState === "CAUTIOUS") {
    return {
      label: "高壓警戒",
      cardClass: "card-warn",
      textClass: "text-warn",
      subLabel: "降槓桿防守",
    };
  }
  return { label: "正常", cardClass: "card-ok", textClass: "text-ok", subLabel: "常態運作" };
});

const vixOverrideActive = computed(() => {
  return (
    !!latestReport.value?.marketState?.sentiment?.vixOverrideActive ||
    !!latestReport.value?.signals?.macroSentiment?.vixOverrideActive
  );
});

const pbPrValue = computed(() => {
  const sigs = latestReport.value?.signals;
  const v =
    sigs?.valuationGuardResult?.currentPR ??
    sigs?.marketState?.valuation?.currentPR ??
    sigs?.currentPR;
  return v != null ? Math.round(v) : "—";
});

const pbPrLevel = computed(() => {
  const r = getPrLevel(pbPrValue.value);
  return { label: r.label, cardClass: r.cls, textClass: r.textCls };
});

const glValue = computed(() => {
  const v = latestReport.value?.signals?.grossLeverage;
  return v != null ? Number(v).toFixed(2) : "—";
});

const lightEmoji = computed(() => {
  const sig = status.value?.data?.rawNdc?.light ?? "";
  if (sig.includes("黃紅") || sig.includes("活絡")) return "warn";
  if (sig.includes("黃藍") || sig.includes("趨緩")) return "warn";
  if (sig.includes("紅")) return "danger";
  if (sig.includes("綠")) return "ok";
  if (sig.includes("藍")) return "neutral";
  return "neutral";
});

const lightText = computed(() => status.value?.data?.rawNdc?.light || "—");

// ── Computed: Decision & Analysis ──
const activePriority = computed(() => {
  const sigs = latestReport.value?.signals;
  if (sigs?.maintenanceRisk?.level === "Critical") return "P1 維持率危機";
  if (Number(sigs?.grossLeverage) >= 2.5) return "P2 槓桿上限";
  if (sigs?.panicBypassActive) return "P3 恐慌破冰";
  return null;
});

const routingPath = computed(() => {
  const sigs = latestReport.value?.signals;
  if (!sigs) return "—";
  return [
    sigs.maintenanceRisk?.level === "Normal" ? "OK" : "追繳",
    `${Number(sigs.grossLeverage).toFixed(1)}x`,
    `PR${Math.round(sigs.valuationGuardResult?.currentPR || 0)}`,
  ].join(" → ");
});

const targetClass = computed(() => {
  const t = latestReport.value?.signals?.target || "";
  if (t.includes("加碼") || t.includes("買")) return "target-buy";
  if (t.includes("減碼") || t.includes("賣")) return "target-sell";
  return "target-wait";
});

const pctClass = computed(() =>
  Number(latestReport.value?.signals?.priceChangePercent) >= 0
    ? "badge-ok"
    : "badge-danger",
);
const pctText = computed(
  () => `${latestReport.value?.signals?.priceChangePercentText || "—"}%`,
);

const aiRiskWarnings = computed(
  () => latestReport.value?.ai?.risk_warnings ?? [],
);
const aiActionItems = computed(
  () => latestReport.value?.ai?.action_items ?? [],
);
const aiMindsetAdvice = computed(
  () => latestReport.value?.ai?.mindset_advice ?? [],
);
const aiInternalThinking = computed(
  () => latestReport.value?.ai?.coach_internal_thinking ?? "",
);
const aiCoreInsight = computed(
  () => latestReport.value?.ai?.core_insight ?? "",
);
const aiStrategyVerdict = computed(
  () => latestReport.value?.ai?.strategy_verdict ?? "",
);

// ── Logic ──
async function loadAll() {
  await Promise.all([
    statusState.run(fetchStatus),
    reportState.run(() => fetchReports(1)),
    healthState.run(fetchPortfolioHealth),
  ]);
}

function formatUpdatedAt(iso) {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(async () => {
  loadAll();
  // 首屏後預取高頻頁：市場雷達
  prefetch(viewLoaders.MarketRadarView);
  await loadStrategyStatusSummary();
});

// 來自 /strategy-status redirect 的 query 參數，自動開啟策略狀態 drawer
watch(
  () => route.query.panel,
  (val) => {
    if (val === "strategy-status") {
      strategyStatusDrawerVisible.value = true;
    }
  },
  { immediate: true }
);

// 抽屜打開時才載入面板元件（維持初始體積預算）
watch(
  strategyStatusDrawerVisible,
  async (show) => {
    if (show) await loadStrategyStatusPanel();
  }
);
</script>

<style scoped>
/* ────────────────────────────────────────────────────────────
   DashboardView — Phase 3 現代化（2026-11-17）
   原則：只動 CSS，不動模板 / 不動邏輯 / 不引入新 class 依賴。
   - 硬編碼 px → --iln-space-* / --iln-radius-* / --iln-font-*
   - 統一卡片樣式（.dashboard-card / .cockpit-section / .health-card 共用骨架）
   - 補 active 態與 focus-visible（a11y）
   - 移除未使用的 .card-header / .card-body / .toggle-icon /
     .card-content-* / .radar-chart（模板中 0 引用）
   ──────────────────────────────────────────────────────────── */

/* 頁面容器：寬度由 shared-styles .iln-page 的 token 統一控制（P3） */

/* ── Header ── */
.dash-header {
  margin-bottom: var(--iln-space-6);
}
.dash-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.dash-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--iln-text);
  margin: 0;
}
.dash-date {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

/* FAB：策略設定（36px → 40px 觸控下限，加 focus-visible） */
.config-fab {
  width: var(--iln-space-10);
  height: var(--iln-space-10);
  background: var(--iln-brand);
  color: var(--iln-text-on-brand);
  border: none;
  border-radius: var(--iln-radius-full, 999px);
  font-size: var(--iln-font-md);
  cursor: pointer;
  box-shadow: var(--iln-shadow-card);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--iln-duration-fast) var(--iln-ease-standard),
              box-shadow var(--iln-duration-fast) var(--iln-ease-standard);
}
.config-fab:hover {
  box-shadow: var(--iln-shadow-2);
}
.config-fab:active {
  transform: scale(0.94);
}
.config-fab:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

/* ── 進場動效（尊重 reduced-motion） ── */
.fade-in {
  animation: fadeIn var(--iln-duration-slow, 300ms) var(--iln-ease-decelerate, ease-out);
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fade-in { animation: none; }
  .config-fab:active { transform: none; }
}

/* ── 統一卡片骨架（三個 class 共用） ── */
.dashboard-card,
.health-card {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-lg);
  box-shadow: var(--iln-shadow-1);
  overflow: hidden;
}
.dashboard-card {
  margin-bottom: var(--iln-space-4);
}

/* ── Strategy Status 連結卡 ── */
.strategy-status-link {
  padding: 0;
}
.status-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--iln-space-4) var(--iln-space-5);
  text-decoration: none;
  color: inherit;
  transition: background var(--iln-duration-fast) var(--iln-ease-standard);
}
.status-link:hover {
  background: var(--iln-surface-alt, var(--iln-bg));
}
.status-link:active {
  background: var(--iln-surface-alt, var(--iln-bg));
}
.status-link:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: -2px;
}
.status-link-left h3 {
  margin: 0 0 var(--iln-space-1);
  font-size: var(--iln-font-md);
  font-weight: 700;
  color: var(--iln-text);
}
.status-link-desc {
  margin: 0;
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}
.status-link-arrow {
  font-size: var(--iln-font-xl);
  color: var(--iln-brand);
  font-weight: 600;
}

/* ── Radar 入口連結 ── */
.radar-entry {
  display: flex;
  justify-content: flex-end;
  margin: calc(var(--iln-space-1) * -1) 0 var(--iln-space-4);
}
.radar-entry-link {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-brand);
  text-decoration: none;
  padding: var(--iln-space-1) var(--iln-space-3);
  border-radius: var(--iln-radius-sm);
  transition: background var(--iln-duration-fast) var(--iln-ease-standard);
}
.radar-entry-link:hover,
.radar-entry-link:active {
  background: var(--iln-brand-soft);
}
.radar-entry-link:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

/* ── 資料新鮮度降級提示 ── */
.freshness-expired-alert {
  padding: var(--iln-space-3) var(--iln-space-4);
  margin-bottom: var(--iln-space-4);
  font-size: var(--iln-font-sm);
  background: var(--iln-danger-bg);
  color: var(--iln-danger-text);
  border-radius: var(--iln-radius-sm);
  border: 1px solid var(--iln-danger);
  text-align: center;
}

/* ── 更新時間 ── */
.update-time {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-align: center;
  margin-top: var(--iln-space-6);
}

/* ── Tab 內容容器 ── */
.tab-content-area {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-6);
}

/* ── 駕駛艙區塊：P3 起為柵格佈局容器，卡片裝飾由子卡片自帶 ── */
.cockpit-section {
  margin-bottom: var(--iln-space-4);
}
.health-card {
  padding: var(--iln-space-5);
}

/* ── 子組件全域覆寫（:deep）── */
:deep(.section) {
  margin-bottom: var(--iln-space-6);
}
:deep(.section-title) {
  font-size: var(--iln-font-base);
  font-weight: 700;
  margin-bottom: var(--iln-space-3);
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
:deep(.text-danger) { color: var(--iln-danger-text); }
:deep(.text-warn)   { color: var(--iln-warn-text); }
:deep(.text-ok)     { color: var(--iln-ok-text); }
</style>
