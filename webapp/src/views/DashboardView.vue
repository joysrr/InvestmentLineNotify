<template>
  <GlobalErrorBoundary>
    <div class="view-container">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-title-row">
        <h2 class="dash-title">投資儀表板</h2>
        <!-- FAB: Strategy Config -->
        <button
          class="config-fab"
          data-testid="fab-strategy-config"
          @click="configDrawerVisible = true"
          title="策略設定"
          aria-label="策略設定"
        >
          ⚙️
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

    <!-- Tab Contents -->
    <div class="tab-content-area fade-in">
      <!-- 1. 首屏核心決策 hero -->
      <DecisionHero
        :report="latestReport"
        :loading="reportLoading"
        :error="reportError"
        :active-priority="activePriority"
        :target-class="targetClass"
        :pct-class="pctClass"
        :pct-text="pctText"
        :routing-path="routingPath"
      />

      <!-- 2. 雙核心駕駛艙 (L2: 總經象限 + 資產安全防護) -->
      <section class="cockpit-section" data-testid="dual-cockpit-section">
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
      <section class="dashboard-card health-card">
        <HealthPanel
          :data="healthData"
          :loading="healthLoading"
          :error="healthError"
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

      <!-- Strategy Status Card (collapsible, default collapsed) -->
      <section class="dashboard-card strategy-status-card">
        <header class="card-header" @click="ssExpanded = !ssExpanded">
          <h3>📊 策略狀態</h3>
          <span class="toggle-icon">{{ ssExpanded ? "▼" : "▶" }}</span>
        </header>
        <Transition name="card-content">
          <div v-show="ssExpanded" class="card-body">
            <StrategyStatusView
              :health="strategyStatus"
              :loading="strategyStatusLoading"
              :error="strategyStatusError"
            />
          </div>
        </Transition>
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
import { ref, computed, onMounted } from "vue";
import {
  fetchStatus,
  fetchReports,
  fetchNews,
  fetchPortfolioHealth,
  fetchStrategyStatus,
} from "../api/index.js";
import { waitReady } from "../composables/useTelegram.js";

// Components
import MacroCockpitCard from "../components/dashboard/MacroCockpitCard.vue";
import PortfolioShieldCard from "../components/dashboard/PortfolioShieldCard.vue";
import MarketDetailDrawer from "../components/dashboard/MarketDetailDrawer.vue";
import RiskDetailDrawer from "../components/dashboard/RiskDetailDrawer.vue";
import DecisionHero from "../components/dashboard/DecisionHero.vue";
import HealthPanel from "../components/dashboard/HealthPanel.vue";
import CoachingAdvice from "../components/dashboard/CoachingAdvice.vue";
import StrategyStatusView from "../views/StrategyStatusView.vue";
import StrategyConfigEditorView from "../views/StrategyConfigEditor.vue";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";

// ── State ──
// Single-page card layout: no top-level tab switcher
const ssExpanded = ref(false); // Strategy Status card collapsed by default
const configDrawerVisible = ref(false); // Strategy Config drawer
const status = ref(null);
const statusLoading = ref(true);

const latestReport = ref(null);
const reportLoading = ref(true);
const reportError = ref(false);

const topNews = ref([]);
const newsLoading = ref(true);

const healthData = ref(null); // portfolio/health summary (NEW schema) for HealthCard
const healthLoading = ref(true);
const healthError = ref(false);

const strategyStatus = ref(null); // /api/strategy-status (detail) for StrategyStatusView
const strategyStatusLoading = ref(true);
const strategyStatusError = ref(null);

// L3 Drawers 顯示控制
const marketDrawerVisible = ref(false);
const riskDrawerVisible = ref(false);

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
  const v = Number(pbPrValue.value);
  if (isNaN(v)) return { label: "—", cardClass: "", textClass: "" };
  if (v >= 90)
    return {
      label: "極度昂貴",
      cardClass: "card-danger",
      textClass: "text-danger",
    };
  if (v >= 80)
    return {
      label: "估值偏高",
      cardClass: "card-warn",
      textClass: "text-warn",
    };
  if (v <= 25)
    return { label: "極度便宜", cardClass: "card-ok", textClass: "text-ok" };
  return { label: "合理區間", cardClass: "", textClass: "" };
});

const glValue = computed(() => {
  const v = latestReport.value?.signals?.grossLeverage;
  return v != null ? Number(v).toFixed(2) : "—";
});

const lightEmoji = computed(() => {
  const sig = status.value?.data?.rawNdc?.light ?? "";
  if (sig.includes("黃紅") || sig.includes("活絡")) return "🟠";
  if (sig.includes("黃藍") || sig.includes("趨緩")) return "🟡";
  if (sig.includes("紅")) return "🔴";
  if (sig.includes("綠")) return "🟢";
  if (sig.includes("藍")) return "🔵";
  return "⚪";
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
    sigs.maintenanceRisk?.level === "Normal" ? "OK" : "⚠️追繳",
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
  const [sRes, rRes, nRes, hRes, ssRes] = await Promise.allSettled([
    fetchStatus(),
    fetchReports(1),
    fetchNews(),
    fetchPortfolioHealth(),
    fetchStrategyStatus(),
  ]);
  if (sRes.status === "fulfilled") status.value = sRes.value;
  statusLoading.value = false;
  if (rRes.status === "fulfilled")
    latestReport.value = rRes.value[0] || rRes.value.data?.[0];
  reportLoading.value = false;
  if (nRes.status === "fulfilled")
    topNews.value = (nRes.value.articles || nRes.value).slice(0, 3);
  newsLoading.value = false;
  if (hRes.status === "fulfilled") healthData.value = hRes.value;
  healthLoading.value = false;
  if (ssRes.status === "fulfilled") {
    strategyStatus.value = ssRes.value;
  } else {
    strategyStatusError.value = "無法載入策略狀態：" + (ssRes.reason?.message || "網路異常");
  }
  strategyStatusLoading.value = false;
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
  await waitReady();
  loadAll();
});
</script>

<style scoped>
.view-container {
  padding: 16px 16px 100px; /* room for FloatingPill (bottom nav height ~84px) */
  max-width: 600px;
  margin: 0 auto;
}
.dash-header {
  margin-bottom: 24px;
}
.dash-title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.dash-title {
  font-size: 22px;
  font-weight: 800;
}
.dash-date {
  font-size: 13px;
  color: #999;
}

/* FAB: Strategy Config */
.config-fab {
  background: var(--tg-theme-button-color, #2481cc);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.config-fab:active {
  transform: scale(0.94);
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Card carousel */
.dashboard-card {
  background: #fff;
  border-radius: 14px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.card-header {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #111;
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-body {
  padding: 12px 16px;
}
.toggle-icon {
  font-size: 11px;
  color: #999;
}

/* Collapse/Expand Animation for dashboard-card body */
.card-content-enter-active,
.card-content-leave-active {
  max-height: 400px;
  transition: max-height 0.3s ease, opacity 0.3s ease;
}
.card-content-enter-from,
.card-content-leave-to {
  max-height: 0;
  opacity: 0;
  padding: 0 16px;
}

.radar-chart {
  height: 240px;
  width: 100%;
}
.update-time {
  font-size: 10px;
  color: #bbb;
  text-align: center;
  margin-top: 24px;
}

/* Global-ish utility classes for children */
:deep(.section) {
  margin-bottom: 24px;
}
:deep(.section-title) {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
:deep(.text-danger) {
  color: #e84855;
}
:deep(.text-warn) {
  color: #f39c12;
}
:deep(.text-ok) {
  color: #26a17b;
}
</style>
