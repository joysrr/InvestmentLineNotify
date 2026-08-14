<template>
  <GlobalErrorBoundary>
    <div class="view-container">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-title-row">
        <h2 class="dash-title">投資儀表板</h2>
        <span class="dash-date">{{ todayLabel }}</span>
      </div>

      <!-- Tab Navigation (Top Level) -->
      <div class="dash-tabs">
        <button
          class="tab-item"
          :class="{ active: currentTab === 'summary' }"
          @click="currentTab = 'summary'"
        >
          總覽
        </button>
        <button
          class="tab-item"
          :class="{ active: currentTab === 'health' }"
          @click="currentTab = 'health'"
        >
          健康度
          <span v-if="healthData?.status === 'RED'" class="tab-badge">!</span>
        </button>
        <button
          class="tab-item"
          :class="{ active: currentTab === 'analysis' }"
          @click="currentTab = 'analysis'"
        >
          分析
        </button>
        <button
          class="tab-item"
          :class="{ active: currentTab === 'strategy-status' }"
          @click="currentTab = 'strategy-status'"
        >
          策略�狀態
        </button>
        <button
          class="tab-item"
          :class="{ active: currentTab === 'simulator' }"
          @click="currentTab = 'simulator'"
          data-testid="simulator-tab"
        >
          ��� � � 模���擬器
        </button>
        <button
          class="tab-item"
          :class="{ active: currentTab === 'backtest-report' }"
          @click="currentTab = 'backtest-report'"
        >
          回測報表
        </button>
        <button
          class="tab-item"
          :class="{ active: currentTab === 'strategy-config' }"
          @click="currentTab = 'strategy-config'"
        >
          策略設定
        </button>
      </div>
    </div>

    <!-- Tab Contents -->
    <div class="tab-content-area fade-in" :key="currentTab">
      <!-- Tab 1: Summary (總覽) -->
      <div v-if="currentTab === 'summary'">
        <MarketSnapshot
          :status="status"
          :loading="statusLoading"
          :error="statusError"
          :regime-level="regimeLevel"
          :vix-override-active="vixOverrideActive"
          :pb-pr-level="pbPrLevel"
          :pb-pr-value="pbPrValue"
          :gl-level="glLevel"
          :gl-value="glValue"
          :light-emoji="lightEmoji"
          :light-text="lightText"
        />

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

        <!-- 科學紀律信心橫幅 -->
        <div class="discipline-banner" @click="goToDiscipline">
          <div class="banner-icon">🔬</div>
          <div class="banner-body">
            <h4 class="banner-title">17 年大循環：真實數據實證</h4>
            <p class="banner-desc">
              以歷史大數據驗證「局部減碼
              50%」策略完勝全額清倉。有效降低投資段回撤風險，完美保留牛市複利。點此查看信心據點
              ➔
            </p>
          </div>
        </div>

        <CoachingAdvice
          :report="latestReport"
          :risks="aiRiskWarnings"
          :actions="aiActionItems"
          :mindset="aiMindsetAdvice"
          :thinking="aiInternalThinking"
          :insight="aiCoreInsight"
          :verdict="aiStrategyVerdict"
        />
      </div>

      <!-- Tab 2: Health (帳戶健康) -->
      <div v-else-if="currentTab === 'health'">
        <HealthPanel
          :data="healthData"
          :loading="healthLoading"
          :error="healthError"
        />
      </div>

      <!-- Tab 3: Analysis (詳細分析) -->
      <div v-else-if="currentTab === 'analysis'">
        <AnalysisPanel
          :report="latestReport"
          :score-ok="scoreOk"
          :score-val="scoreVal"
          :score-min="scoreMin"
          :score-rows="scoreRows"
          :defense-items="defenseItems"
          :news="topNews"
          @open-news="openLink"
        >
          <template #radar-chart>
            <v-chart :option="radarOption" autoresize class="radar-chart" />
          </template>
        </AnalysisPanel>
      </div>

      <!-- Tab 4: Strategy Status (策略狀態) -->
      <div v-else-if="currentTab === 'strategy-status'">
        <StrategyStatusView />
      </div>

      <!-- Tab 5: Simulator (模擬器) -->
      <div v-else-if="currentTab === 'simulator'">
        <SimulatorView />
      </div>

      <!-- Tab 6: Backtest Report (回測報表) -->
      <div v-else-if="currentTab === 'backtest-report'">
        <BacktestReportView />
      </div>

      <!-- Tab 7: Strategy Config (策略設定) -->
      <div v-else-if="currentTab === 'strategy-config'">
        <StrategyConfigEditorView />
      </div>
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
import { useRouter } from "vue-router";
import {
  fetchStatus,
  fetchReports,
  fetchNews,
  fetchPortfolioHealth,
} from "../api/index.js";
import { useTelegram, waitReady } from "../composables/useTelegram.js";
import { useApiRequestBatch } from "../composables/useApiRequest.js";

// Components
import MarketSnapshot from "../components/dashboard/MarketSnapshot.vue";
import DecisionHero from "../components/dashboard/DecisionHero.vue";
import HealthPanel from "../components/dashboard/HealthPanel.vue";
import CoachingAdvice from "../components/dashboard/CoachingAdvice.vue";
import AnalysisPanel from "../components/dashboard/AnalysisPanel.vue";
import SimulatorView from "../views/SimulatorView.vue";
import StrategyStatusView from "../views/StrategyStatusView.vue";
import BacktestReportView from "../views/BacktestReportView.vue";
import StrategyConfigEditorView from "../views/StrategyConfigEditor.vue";
import GlobalErrorBoundary from "../components/common/GlobalErrorBoundary.vue";
import ErrorAlert from "../components/common/ErrorAlert.vue";

// ECharts (Only needed here for the radar template slot)
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { RadarChart } from "echarts/charts";
import { RadarComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([RadarChart, RadarComponent, TooltipComponent, CanvasRenderer]);

const { openLink } = useTelegram();
const router = useRouter();

function goToDiscipline() {
  router.push({ path: "/reports", query: { tab: "discipline" } });
}

// ── State ──
const currentTab = ref("summary");
const status = ref(null);
const statusLoading = ref(true);
const statusError = ref(false);

const latestReport = ref(null);
const reportLoading = ref(true);
const reportError = ref(false);

const topNews = ref([]);
const newsLoading = ref(true);
const newsError = ref(false);

const healthData = ref(null);
const healthLoading = ref(true);
const healthError = ref(false);

// ── Computed: Market Indicators ──
const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

const regimeLevel = computed(() => {
  const state =
    latestReport.value?.signals?.regimeState ||
    latestReport.value?.signals?.regimeResult?.state ||
    "NORMAL";
  if (state === "CRISIS")
    return {
      label: "極端恐慌",
      cardClass: "card-danger",
      textClass: "text-danger",
    };
  if (state === "CAUTIOUS")
    return {
      label: "高壓警戒",
      cardClass: "card-warn",
      textClass: "text-warn",
    };
  return { label: "正常", cardClass: "card-ok", textClass: "text-ok" };
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

const glLevel = computed(() => {
  const v = Number(glValue.value);
  if (isNaN(v)) return { label: "—", cardClass: "", textClass: "" };
  if (v >= 3.0)
    return {
      label: "強制砍倉",
      cardClass: "card-danger",
      textClass: "text-danger",
    };
  if (v >= 2.5)
    return {
      label: "暫停加碼",
      cardClass: "card-warn",
      textClass: "text-warn",
    };
  return { label: "安全水位", cardClass: "card-ok", textClass: "text-ok" };
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

const defenseItems = computed(() => {
  const sigs = latestReport.value?.signals;
  const vg = sigs?.valuationGuardResult;
  const prLabel = pbPrValue.value !== "—" ? `PR${pbPrValue.value}%` : "分析中";

  return [
    {
      icon: "⚖️",
      title: "估值守衛",
      statusText: vg?.guardActive ? "防禦生效" : "安全",
      statusClass: vg?.guardActive ? "text-warn" : "text-ok",
      desc: prLabel,
    },
    {
      icon: "📊",
      title: "槓桿天花板",
      statusText: glLevel.value.label,
      statusClass: glLevel.value.textClass,
      desc: `${glValue.value}x`,
    },
    {
      icon: "🛡️",
      title: "維持率安全",
      statusText: sigs?.maintenanceRisk?.level === "Normal" ? "安全" : "警告",
      statusClass:
        sigs?.maintenanceRisk?.level === "Normal" ? "text-ok" : "text-danger",
      desc: "跌破將觸發減碼",
    },
  ];
});

// ── Entry Score ──
const scoreVal = computed(() =>
  Number(latestReport.value?.signals?.score || 0),
);
const scoreMin = computed(() =>
  Number(
    latestReport.value?.strategySnapshot?.indicator?.buy?.minWeightScoreToBuy ||
      0,
  ),
);
const scoreOk = computed(() => scoreVal.value >= scoreMin.value);
const scoreRows = computed(() => {
  const w = latestReport.value?.signals?.weightDetails || {};
  return [
    { label: "跌幅評分", pt: `${w.dropScore || 0}pt`, active: w.dropScore > 0 },
    { label: "RSI評分", pt: `${w.rsiScore || 0}pt`, active: w.rsiScore > 0 },
    { label: "MACD評分", pt: `${w.macdScore || 0}pt`, active: w.macdScore > 0 },
    {
      label: "情緒加成",
      pt: `${w.sentimentScore || 0}pt`,
      active: w.sentimentScore !== 0,
    },
  ];
});

const radarOption = computed(() => {
  const w = latestReport.value?.signals?.weightDetails || {};
  return {
    radar: {
      indicator: [
        { name: "跌幅", max: 5 },
        { name: "RSI", max: 5 },
        { name: "MACD", max: 5 },
        { name: "KD", max: 5 },
        { name: "情緒", max: 5 },
      ],
      shape: "polygon",
      axisName: { color: "#999", fontSize: 10 },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: [
              Number(w.dropScore || 0),
              Number(w.rsiScore || 0),
              Number(w.macdScore || 0),
              Number(w.kdScore || 0),
              Math.abs(Number(w.sentimentScore || 0)),
            ],
            areaStyle: { color: "rgba(36, 129, 204, 0.2)" },
            lineStyle: { color: "#2481cc", width: 2 },
            symbol: "none",
          },
        ],
      },
    ],
  };
});

// ── Logic ──
async function loadAll() {
  const [sRes, rRes, nRes, hRes] = await Promise.allSettled([
    fetchStatus(),
    fetchReports(1),
    fetchNews(),
    fetchPortfolioHealth(),
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
  padding: 16px 16px 32px;
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
  margin-bottom: 16px;
}
.dash-title {
  font-size: 22px;
  font-weight: 800;
}
.dash-date {
  font-size: 13px;
  color: #999;
}

.dash-tabs {
  display: flex;
  background: #f0f0f0;
  border-radius: 14px;
  padding: 4px;
  gap: 4px;
}
.tab-item {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 0;
  font-size: 13px;
  font-weight: 700;
  color: #888;
  border-radius: 11px;
  position: relative;
  transition: all 0.2s ease;
}
.tab-item.active {
  background: #fff;
  color: #111;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.tab-badge {
  position: absolute;
  top: 6px;
  right: 8px;
  background: #e74c3c;
  width: 6px;
  height: 6px;
  border-radius: 50%;
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

/* ── Discipline Banner Styles ── */
.discipline-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--tg-theme-secondary-bg-color, #f5f8fa);
  color: var(--tg-theme-text-color, #222);
  padding: 14px 16px;
  border-radius: 14px;
  margin-top: 16px;
  margin-bottom: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
  text-align: left;
  border: 1px solid var(--tg-theme-hint-color, #e1e8ed);
}
.discipline-banner:active {
  transform: scale(0.98);
  opacity: 0.8;
}
.banner-icon {
  font-size: 26px;
}
.banner-body {
  flex: 1;
}
.banner-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--tg-theme-button-color, #2481cc);
  margin: 0 0 4px 0;
}
.banner-desc {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #657786);
  margin: 0;
  line-height: 1.45;
}
</style>
