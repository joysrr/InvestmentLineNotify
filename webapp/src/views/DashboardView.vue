<template>
  <div class="view-container">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-title-row">
        <h2 class="dash-title">投資儀表板</h2>
        <span class="dash-date">{{ todayLabel }}</span>
      </div>
      
      <!-- Tab Navigation (Top Level) -->
      <div class="dash-tabs">
        <button class="tab-item" :class="{ active: currentTab === 'summary' }" @click="currentTab = 'summary'">總覽</button>
        <button class="tab-item" :class="{ active: currentTab === 'health' }" @click="currentTab = 'health'">
          健康度
          <span v-if="healthData?.status === 'RED'" class="tab-badge">!</span>
        </button>
        <button class="tab-item" :class="{ active: currentTab === 'analysis' }" @click="currentTab = 'analysis'">分析</button>
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
          :vix-level="vixLevel"
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

        <CoachingAdvice 
          :report="latestReport"
          :risks="aiRiskWarnings"
          :actions="aiActionItems"
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

    </div>

    <!-- Footer meta -->
    <p v-if="status?._meta?.lastRun" class="update-time">
      資料更新：{{ formatUpdatedAt(status._meta.lastRun) }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus, fetchReports, fetchNews, fetchPortfolioHealth } from "../api/index.js";
import { useTelegram, waitReady } from "../composables/useTelegram.js";

// Components
import MarketSnapshot from "../components/dashboard/MarketSnapshot.vue";
import DecisionHero from "../components/dashboard/DecisionHero.vue";
import HealthPanel from "../components/dashboard/HealthPanel.vue";
import CoachingAdvice from "../components/dashboard/CoachingAdvice.vue";
import AnalysisPanel from "../components/dashboard/AnalysisPanel.vue";

// ECharts (Only needed here for the radar template slot)
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { RadarChart } from "echarts/charts";
import { RadarComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
use([RadarChart, RadarComponent, TooltipComponent, CanvasRenderer]);

const { openLink } = useTelegram();

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
  new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" })
);

const vixLevel = computed(() => {
  const v = status.value?.data?.rawUsMarket?.vix ?? latestReport.value?.marketState?.sentiment?.vix;
  if (v == null) return { label: "—", cardClass: "", textClass: "" };
  if (v >= 30) return { label: "極度恐慌", cardClass: "card-danger", textClass: "text-danger" };
  if (v >= 20) return { label: "警戒", cardClass: "card-warn", textClass: "text-warn" };
  return { label: "平穩", cardClass: "card-ok", textClass: "text-ok" };
});

const pbPrValue = computed(() => {
  const sigs = latestReport.value?.signals;
  const v = sigs?.valuationGuardResult?.currentPR ?? sigs?.marketState?.valuation?.currentPR ?? sigs?.currentPR;
  return v != null ? Math.round(v) : "—";
});

const pbPrLevel = computed(() => {
  const v = Number(pbPrValue.value);
  if (isNaN(v)) return { label: "—", cardClass: "", textClass: "" };
  if (v >= 90) return { label: "極度昂貴", cardClass: "card-danger", textClass: "text-danger" };
  if (v >= 80) return { label: "估值偏高", cardClass: "card-warn", textClass: "text-warn" };
  if (v <= 25) return { label: "極度便宜", cardClass: "card-ok", textClass: "text-ok" };
  return { label: "合理區間", cardClass: "", textClass: "" };
});

const glValue = computed(() => {
  const v = latestReport.value?.signals?.grossLeverage;
  return v != null ? Number(v).toFixed(2) : "—";
});

const glLevel = computed(() => {
  const v = Number(glValue.value);
  if (isNaN(v)) return { label: "—", cardClass: "", textClass: "" };
  if (v >= 3.0) return { label: "強制砍倉", cardClass: "card-danger", textClass: "text-danger" };
  if (v >= 2.5) return { label: "暫停加碼", cardClass: "card-warn", textClass: "text-warn" };
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
    `PR${Math.round(sigs.valuationGuardResult?.currentPR || 0)}`
  ].join(" → ");
});

const targetClass = computed(() => {
  const t = latestReport.value?.signals?.target || "";
  if (t.includes("加碼") || t.includes("買")) return "target-buy";
  if (t.includes("減碼") || t.includes("賣")) return "target-sell";
  return "target-wait";
});

const pctClass = computed(() => (Number(latestReport.value?.signals?.priceChangePercent) >= 0 ? "badge-ok" : "badge-danger"));
const pctText = computed(() => `${latestReport.value?.signals?.priceChangePercentText || '—'}%`);

const aiRiskWarnings = computed(() => latestReport.value?.ai?.risk_warnings ?? []);
const aiActionItems = computed(() => latestReport.value?.ai?.action_items ?? []);

const defenseItems = computed(() => {
  const sigs = latestReport.value?.signals;
  const vg = sigs?.valuationGuardResult;
  return [
    { icon: '⚖️', title: '估值守衛', statusText: vg?.guardActive ? '防禦生效' : '安全', statusClass: vg?.guardActive ? 'text-warn' : 'text-ok', desc: `PR${pbPrValue.value}%` },
    { icon: '📊', title: '槓桿天花板', statusText: glLevel.value.label, statusClass: glLevel.value.textClass, desc: `${glValue.value}x` },
    { icon: '🛡️', title: '維持率安全', statusText: sigs?.maintenanceRisk?.level === 'Normal' ? '安全' : '警告', statusClass: sigs?.maintenanceRisk?.level === 'Normal' ? 'text-ok' : 'text-danger', desc: '跌破將觸發減碼' }
  ];
});

// ── Entry Score ──
const scoreVal = computed(() => Number(latestReport.value?.signals?.score || 0));
const scoreMin = computed(() => Number(latestReport.value?.strategySnapshot?.indicator?.buy?.minWeightScoreToBuy || 0));
const scoreOk = computed(() => scoreVal.value >= scoreMin.value);
const scoreRows = computed(() => {
  const w = latestReport.value?.signals?.weightDetails || {};
  return [
    { label: '跌幅評分', pt: `${w.dropScore || 0}pt`, active: w.dropScore > 0 },
    { label: 'RSI評分', pt: `${w.rsiScore || 0}pt`, active: w.rsiScore > 0 },
    { label: 'MACD評分', pt: `${w.macdScore || 0}pt`, active: w.macdScore > 0 },
    { label: '情緒加成', pt: `${w.sentimentScore || 0}pt`, active: w.sentimentScore !== 0 }
  ];
});

const radarOption = computed(() => {
  const w = latestReport.value?.signals?.weightDetails || {};
  return {
    radar: {
      indicator: [
        { name: "跌幅", max: 5 }, { name: "RSI", max: 3 }, { name: "MACD", max: 3 }, { name: "KD", max: 3 }, { name: "情緒", max: 2 },
      ],
      shape: "polygon",
      axisName: { color: "#999", fontSize: 10 }
    },
    series: [{
      type: "radar",
      data: [{
        value: [w.dropScore, w.rsiScore, w.macdScore, w.kdScore, Math.abs(w.sentimentScore)],
        areaStyle: { color: "rgba(36, 129, 204, 0.2)" },
        lineStyle: { color: "#2481cc", width: 2 },
        symbol: "none"
      }]
    }]
  };
});

// ── Logic ──
async function loadAll() {
  const [sRes, rRes, nRes, hRes] = await Promise.allSettled([
    fetchStatus(), fetchReports(1), fetchNews(), fetchPortfolioHealth()
  ]);
  if (sRes.status === "fulfilled") status.value = sRes.value;
  statusLoading.value = false;
  if (rRes.status === "fulfilled") latestReport.value = rRes.value[0] || rRes.value.data?.[0];
  reportLoading.value = false;
  if (nRes.status === "fulfilled") topNews.value = (nRes.value.articles || nRes.value).slice(0, 3);
  newsLoading.value = false;
  if (hRes.status === "fulfilled") healthData.value = hRes.value;
  healthLoading.value = false;
}

function formatUpdatedAt(iso) {
  return new Date(iso).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

onMounted(async () => {
  await waitReady();
  loadAll();
});
</script>

<style scoped>
.view-container { padding: 16px 16px 32px; max-width: 600px; margin: 0 auto; }
.dash-header { margin-bottom: 24px; }
.dash-title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
.dash-title { font-size: 22px; font-weight: 800; }
.dash-date { font-size: 13px; color: #999; }

.dash-tabs { display: flex; background: #f0f0f0; border-radius: 14px; padding: 4px; gap: 4px; }
.tab-item {
  flex: 1; border: none; background: transparent; padding: 10px 0;
  font-size: 13px; font-weight: 700; color: #888; border-radius: 11px;
  position: relative; transition: all 0.2s ease;
}
.tab-item.active { background: #fff; color: #111; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.tab-badge { position: absolute; top: 6px; right: 8px; background: #e74c3c; width: 6px; height: 6px; border-radius: 50%; }

.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.radar-chart { height: 240px; width: 100%; }
.update-time { font-size: 10px; color: #bbb; text-align: center; margin-top: 24px; }

/* Global-ish utility classes for children */
:deep(.section) { margin-bottom: 24px; }
:deep(.section-title) { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
:deep(.text-danger) { color: #e84855; }
:deep(.text-warn) { color: #f39c12; }
:deep(.text-ok) { color: #26a17b; }
</style>
