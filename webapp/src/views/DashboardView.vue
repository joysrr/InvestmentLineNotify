<template>
  <GlobalErrorBoundary>
    <div class="view-container iln-page">
      <!-- 1. 精簡頁首：標題、日期、鮮度狀態與單一設定鈕 -->
      <header class="dash-header">
        <div class="dash-title-row">
          <div class="dash-title-group">
            <h1 class="dash-title">投資儀表板</h1>
            <div class="dash-meta tabular">
              <span class="dash-date">{{ todayLabel }}</span>
              <FreshnessBadge
                v-if="status?._meta?.lastRun"
                :timestamp="status._meta.lastRun"
                label="更新"
                @level-change="handleFreshnessLevelChange"
              />
            </div>
          </div>

          <!-- FAB: Strategy Config -->
          <button
            type="button"
            class="config-fab"
            data-testid="fab-strategy-config"
            @click="configDrawerVisible = true"
            title="策略設定"
            aria-label="策略設定"
          >
            <Icon name="settings" size="sm" color="var(--iln-text-on-brand)" />
          </button>
        </div>

        <!-- 僅在資料超過 6 小時未更新時顯示醒目警示 -->
        <div
          v-if="freshnessLevel === 'expired'"
          class="freshness-expired-alert"
          role="alert"
        >
          <span class="freshness-expired-alert__text">
            <Icon name="warn" size="sm" />
            <span>資料已超過 6 小時未更新，建議確認排程狀態</span>
          </span>
          <button
            type="button"
            class="freshness-retry-btn"
            @click="loadAll"
          >
            重新整理
          </button>
        </div>
      </header>

      <!-- Strategy Config Drawer -->
      <el-drawer
        v-model="configDrawerVisible"
        title="策略設定"
        :append-to-body="true"
        size="80%"
      >
        <StrategyConfigEditorView />
      </el-drawer>

      <!-- Strategy Status Drawer（由單一摘要卡 / redirect query 開啟） -->
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

      <!-- Tab Contents：依「決策 → 風控 → 健康與教練建議」三層排列 -->
      <div class="tab-content-area fade-in">
        <!-- Layer 1：首屏核心決策 Hero -->
        <section class="dashboard-block" aria-label="核心投資決策">
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
        </section>

        <!-- Layer 2：雙核心駕駛艙 (總經象限 + 資產安全防護) 與市場雷達入口 -->
        <section class="dashboard-block" aria-label="核心風控駕駛艙">
          <div
            class="cockpit-section iln-grid iln-grid--2 fade-up fade-up--stagger-1"
            data-testid="dual-cockpit-section"
          >
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
          </div>

          <div class="radar-entry">
            <router-link :to="{ path: '/insights', query: { tab: 'radar' } }" class="radar-entry-link">
              <span>查看完整市場雷達</span>
              <Icon name="arrow-right" size="sm" color="var(--iln-hint)" />
            </router-link>
          </div>
        </section>

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

        <!-- Layer 3：帳戶健康度監控 (0-100) -->
        <section class="dashboard-block fade-up fade-up--stagger-2" aria-label="帳戶健康度監控">
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

        <!-- Layer 3：AI 教練建議與推演 -->
        <section class="dashboard-block" aria-label="AI 教練建議">
          <CoachingAdvice
            :report="latestReport"
            :risks="aiRiskWarnings"
            :actions="aiActionItems"
            :mindset="aiMindsetAdvice"
            :thinking="aiInternalThinking"
            :insight="aiCoreInsight"
            :verdict="aiStrategyVerdict"
          />
        </section>

        <!-- Layer 3：Strategy Status 單一摘要入口（點擊開啟 drawer） -->
        <section
          v-if="strategyStatusSummary && status"
          class="dashboard-block strategy-status-link fade-up fade-up--stagger-1"
          aria-label="策略狀態摘要"
        >
          <component
            :is="strategyStatusSummary"
            :health="healthData"
            :loading="healthLoading"
            :error="healthError"
            @click="strategyStatusDrawerVisible = true"
          />
        </section>
      </div>
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
const configDrawerVisible = ref(false);
const strategyStatusDrawerVisible = ref(false);
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
.view-container {
  padding: var(--iln-space-4) var(--iln-space-4) calc(var(--bottom-nav-height, 88px) + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

/* ── Header ── */
.dash-header {
  margin-bottom: var(--iln-space-4);
}
.dash-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--iln-space-3);
}
.dash-title-group {
  min-width: 0;
}
.dash-title {
  font-size: var(--iln-font-2xl, 22px);
  font-weight: 800;
  color: var(--iln-text);
  margin: 0;
  line-height: 1.25;
}
.dash-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--iln-space-2);
  margin-top: var(--iln-space-1);
}
.dash-date {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

/* FAB：策略設定（維持 40px 觸控區，強化 active 與 focus-visible） */
.config-fab {
  min-width: var(--iln-space-10, 40px);
  width: var(--iln-space-10, 40px);
  min-height: var(--iln-space-10, 40px);
  height: var(--iln-space-10, 40px);
  background: var(--iln-brand);
  color: var(--iln-text-on-brand);
  border: none;
  border-radius: var(--iln-radius-full, 999px);
  font-size: var(--iln-font-md);
  cursor: pointer;
  box-shadow: var(--iln-shadow-card, var(--iln-shadow-1));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    transform var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    box-shadow var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
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

/* ── 首屏鮮度過期警示 ── */
.freshness-expired-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-2);
  margin-top: var(--iln-space-3);
  padding: var(--iln-space-3) var(--iln-space-4);
  font-size: var(--iln-font-sm);
  font-weight: 600;
  background: var(--iln-viz-bear-bg);
  color: var(--iln-viz-bear-text);
  border-radius: var(--iln-radius-md, 12px);
  border: 1px solid var(--iln-viz-bear-border);
}
.freshness-expired-alert__text {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  line-height: 1.4;
}
.freshness-retry-btn {
  padding: var(--iln-space-1) var(--iln-space-3);
  border-radius: var(--iln-radius-sm);
  border: 1px solid var(--iln-viz-bear-border);
  background: var(--iln-surface);
  color: var(--iln-viz-bear-text);
  font-size: var(--iln-font-xs);
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}
.freshness-retry-btn:focus-visible {
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

/* ── 內容區塊與間距節奏 ── */
.tab-content-area {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-4);
}
.dashboard-block {
  min-width: 0;
}
.cockpit-section {
  min-width: 0;
}
.strategy-status-link {
  min-width: 0;
}

/* ── Radar 入口連結 ── */
.radar-entry {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--iln-space-2);
}
.radar-entry-link {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  min-height: 36px;
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-brand);
  text-decoration: none;
  padding: var(--iln-space-1) var(--iln-space-3);
  border-radius: var(--iln-radius-sm);
  transition: background var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}
.radar-entry-link:hover,
.radar-entry-link:active {
  background: var(--iln-brand-soft);
}
.radar-entry-link:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

/* ── 子組件全域覆寫（:deep）── */
:deep(.section) {
  margin-bottom: var(--iln-space-5);
}
:deep(.section-title) {
  font-size: var(--iln-font-base);
  font-weight: 700;
  margin-bottom: var(--iln-space-3);
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
:deep(.text-danger) { color: var(--iln-viz-bear-text); }
:deep(.text-warn)   { color: var(--iln-viz-alert-text); }
:deep(.text-ok)     { color: var(--iln-viz-bull-text); }
</style>
