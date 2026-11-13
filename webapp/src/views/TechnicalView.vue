<template>
    <GlobalErrorBoundary>
    <div class="view-container">
    <div class="view-header">
      <div class="header-top">
        <h2 class="view-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> 技術指標詳情</h2>
      </div>
      <span class="view-subtitle">{{ todayLabel }}</span>
    </div>

    <!-- 市場戰情子分頁切換列 -->
    <RadarSubtabs />

    <!-- 骨架屏 -->
    <div v-if="loading" class="loading-state">
      <div v-for="i in 3" :key="i" class="section skeleton">
        <div class="sk-title"></div>
        <div class="sk-grid">
          <div v-for="j in 3" :key="j" class="sk-card"></div>
        </div>
      </div>
    </div>

    <template v-else-if="latestReport">
      <!-- 技術指標 -->
      <section class="section">
        <h3 class="section-title">核心指標</h3>
        <div class="indicators-grid">
          <div class="indicator-card" :class="rsiInfo.cardClass">
            <span class="ind-label">RSI</span>
            <span class="ind-value">{{ rsiInfo.display }}</span>
            <span class="ind-sub" :class="rsiInfo.textClass">{{
              rsiInfo.label
            }}</span>
          </div>
          <div class="indicator-card" :class="kdKInfo.cardClass">
            <span class="ind-label">KD (K)</span>
            <span class="ind-value">{{ kdKInfo.display }}</span>
            <span class="ind-sub" :class="kdKInfo.textClass">{{
              kdKInfo.label
            }}</span>
          </div>
          <div class="indicator-card" :class="kdDInfo.cardClass">
            <span class="ind-label">KD (D)</span>
            <span class="ind-value">{{ kdDInfo.display }}</span>
            <span class="ind-sub" :class="kdDInfo.textClass">{{
              kdDInfo.label
            }}</span>
          </div>
          <div class="indicator-card" :class="biasInfo.cardClass">
            <span class="ind-label">乖離率 MA240</span>
            <span class="ind-value">{{ biasInfo.display }}</span>
            <span class="ind-sub" :class="biasInfo.textClass">{{
              biasInfo.label
            }}</span>
          </div>
          <div class="indicator-card" :class="macdInfo.cardClass">
            <span class="ind-label">MACD</span>
            <span class="ind-value ind-value--sm">{{ macdInfo.display }}</span>
            <span class="ind-sub" :class="macdInfo.textClass">{{
              macdInfo.label
            }}</span>
          </div>
        </div>
      </section>

      <!-- 風險雷達 -->
      <section class="section">
        <h3 class="section-title"><Icon name="default" size="sm" color="var(--iln-hint)" /> 訊號雷達</h3>
        <div class="risk-summary">
          <div class="risk-bar" :class="reversalRiskClass">
            <span class="risk-bar-label">近期轉弱</span>
            <span class="risk-bar-count"
              >{{ reversalTriggered }} / {{ reversalTotal }}</span
            >
            <div class="risk-dots">
              <span
                v-for="i in reversalTotal"
                :key="i"
                class="risk-dot"
                :class="i <= reversalTriggered ? 'dot-on' : 'dot-off'"
              ></span>
            </div>
          </div>
          <div class="risk-bar" :class="sellRiskClass">
            <span class="risk-bar-label">賣出訊號</span>
            <span class="risk-bar-count"
              >{{ sellTriggered }} / {{ sellTotal }}</span
            >
            <div class="risk-dots">
              <span
                v-for="i in sellTotal"
                :key="i"
                class="risk-dot"
                :class="i <= sellTriggered ? 'dot-on' : 'dot-off'"
              ></span>
            </div>
          </div>
        </div>

        <!-- 轉弱監控詳細 -->
        <div class="signal-group">
          <button
            class="signal-group-header"
            @click="reversalExpanded = !reversalExpanded"
          >
            <span><Icon name="default" size="sm" color="var(--iln-hint)" /> 轉弱監控詳細</span>
            <span class="expand-arrow">{{ reversalExpanded ? "▲" : "▼" }}</span>
          </button>
          <div v-if="reversalExpanded" class="signal-rows">
            <div
              v-for="sig in reversalSignals"
              :key="sig.name"
              class="signal-row"
              :class="sig.triggered ? 'sig-on' : 'sig-off'"
            >
              <span class="sig-icon"><Icon :name="sig.triggered ? 'trigger' : 'default'" size="sm" /></span>
              <span class="sig-name">{{ sig.name }}</span>
              <span class="sig-value">{{ sig.value }}</span>
              <span class="sig-cond">{{ sig.condition }}</span>
            </div>
          </div>
        </div>

        <!-- 賣出訊號詳細 -->
        <div class="signal-group">
          <button
            class="signal-group-header"
            @click="sellExpanded = !sellExpanded"
          >
            <span><Icon name="default" size="sm" color="var(--iln-hint)" /> 賣出訊號詳細</span>
            <span class="expand-arrow">{{ sellExpanded ? "▲" : "▼" }}</span>
          </button>
          <div v-if="sellExpanded" class="signal-rows">
            <div
              v-for="sig in sellSignals"
              :key="sig.name"
              class="signal-row"
              :class="sig.triggered ? 'sig-on' : 'sig-off'"
            >
              <span class="sig-icon"><Icon :name="sig.triggered ? 'trigger' : 'default'" size="sm" /></span>
              <span class="sig-name">{{ sig.name }}</span>
              <span class="sig-value">{{ sig.value }}</span>
              <span class="sig-cond">{{ sig.condition }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>

    <EmptyState v-else-if="!loading" emoji="📭" title="尚無指標數據" />
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import Icon from "@/components/common/Icon.vue";
import { fetchReports } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import { waitReady } from "../composables/useTelegram.js";
import RadarSubtabs from "@/components/radar/RadarSubtabs.vue";
import EmptyState from "@/components/common/EmptyState.vue";

const latestReport = ref(null);
const loading = ref(true);

const reversalExpanded = ref(true);
const sellExpanded = ref(true);

const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

// ── 指標取值 logic (與 DashboardView 同步) ──
function indicatorInfo(value, thresholds) {
  const v = Number.isFinite(value) ? value : null;
  const display = v !== null ? v.toFixed(1) : "—";
  if (v === null)
    return {
      display,
      label: "—",
      cardClass: "",
      textClass: "ind-sub--neutral",
    };
  if (thresholds.danger_high !== undefined && v >= thresholds.danger_high)
    return {
      display,
      label: "過熱",
      cardClass: "ind-danger",
      textClass: "ind-sub--danger",
    };
  if (thresholds.warn_high !== undefined && v >= thresholds.warn_high)
    return {
      display,
      label: "偏熱",
      cardClass: "ind-warn",
      textClass: "ind-sub--warn",
    };
  if (thresholds.danger_low !== undefined && v <= thresholds.danger_low)
    return {
      display,
      label: "超賣",
      cardClass: "ind-buy",
      textClass: "ind-sub--buy",
    };
  if (thresholds.ok_low !== undefined && v <= thresholds.ok_low)
    return {
      display,
      label: "低階",
      cardClass: "ind-ok",
      textClass: "ind-sub--ok",
    };
  return {
    display,
    label: "正常",
    cardClass: "",
    textClass: "ind-sub--neutral",
  };
}

const rsiInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.RSI, {
    danger_high: 80,
    warn_high: 70,
    ok_low: 40,
    danger_low: 30,
  }),
);
const kdKInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.KD_K, {
    danger_high: 85,
    warn_high: 70,
    ok_low: 30,
    danger_low: 20,
  }),
);
const kdDInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.KD_D, {
    danger_high: 85,
    warn_high: 70,
    ok_low: 30,
    danger_low: 20,
  }),
);
const biasInfo = computed(() => {
  const v = latestReport.value?.signals?.bias240;
  const val = Number.isFinite(v) ? v : null;
  const display =
    val !== null ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}%` : "—";
  if (val === null)
    return {
      display,
      label: "—",
      cardClass: "",
      textClass: "ind-sub--neutral",
    };
  if (val >= 25)
    return {
      display,
      label: "極高位",
      cardClass: "ind-danger",
      textClass: "ind-sub--danger",
    };
  if (val >= 15)
    return {
      display,
      label: "高位偏貴",
      cardClass: "ind-warn",
      textClass: "ind-sub--warn",
    };
  if (val < 0)
    return {
      display,
      label: "低位便宜",
      cardClass: "ind-buy",
      textClass: "ind-sub--buy",
    };
  return {
    display,
    label: "中位正常",
    cardClass: "",
    textClass: "ind-sub--neutral",
  };
});
const macdInfo = computed(() => {
  const sig = latestReport.value?.signals?.macdSignal;
  if (!sig)
    return {
      display: "—",
      label: "—",
      cardClass: "",
      textClass: "ind-sub--neutral",
    };
  const signal = sig?.signal ?? sig;
  if (signal === "bull" || signal === "bullish")
    return {
      display: "多頭",
      label: sig?.description ?? "MACD 多頭",
      cardClass: "ind-ok",
      textClass: "ind-sub--ok",
    };
  if (signal === "bear" || signal === "bearish")
    return {
      display: "空頭",
      label: sig?.description ?? "MACD 空頭",
      cardClass: "ind-warn",
      textClass: "ind-sub--warn",
    };
  return {
    display: "中性",
    label: sig?.description ?? "無明顯訊號",
    cardClass: "",
    textClass: "ind-sub--neutral",
  };
});

// ── 風險雷達 logic ──
const r = computed(() => latestReport.value?.signals?.reversal ?? {});
const s = computed(
  () => latestReport.value?.signals?.sellSignals ?? { flags: {} },
);
const th = computed(
  () => latestReport.value?.signals?.strategy?.threshold ?? {},
);
const sellTh = computed(
  () => latestReport.value?.signals?.strategy?.sell ?? {},
);

const reversalTriggered = computed(() => r.value.triggeredCount ?? 0);
const reversalTotal = computed(() => r.value.totalFactor ?? 4);
const sellTriggered = computed(() => s.value.signalCount ?? 0);
const sellTotal = computed(() => s.value.total ?? 3);

const reversalRiskClass = computed(() => {
  const ratio = reversalTriggered.value / reversalTotal.value;
  if (ratio >= 0.75) return "risk-high";
  if (ratio >= 0.5) return "risk-mid";
  return "risk-low";
});
const sellRiskClass = computed(() => {
  const ratio = sellTriggered.value / sellTotal.value;
  if (ratio >= 0.67) return "risk-high";
  if (ratio >= 0.34) return "risk-mid";
  return "risk-low";
});

const reversalSignals = computed(() => {
  const kd_k = Number(latestReport.value?.signals?.KD_K);
  const kd_d = Number(latestReport.value?.signals?.KD_D);
  const kdCons = Math.min(kd_k, kd_d);
  return [
    {
      name: "RSI 近期轉弱",
      value: Number.isFinite(Number(latestReport.value?.signals?.RSI))
        ? Number(latestReport.value?.signals?.RSI).toFixed(1)
        : "--",
      condition: `> ${th.value.rsiReversalLevel ?? "60"} → <${th.value.rsiReversalLevel ?? "60"}`,
      triggered: Boolean(r.value.rsiDrop),
    },
    {
      name: "KD(保守)近期轉弱",
      value: Number.isFinite(kdCons) ? kdCons.toFixed(1) : "--",
      condition: `> ${th.value.kReversalLevel ?? "75"} → <${th.value.kReversalLevel ?? "75"}`,
      triggered: Boolean(r.value.kdDrop),
    },
    {
      name: "KD 死叉",
      value: r.value.kdBearCross ? "死叉" : "未發生",
      condition: "K▽D",
      triggered: Boolean(r.value.kdBearCross),
    },
    {
      name: "MACD 死叉",
      value: r.value.macdBearCross ? "死叉" : "未發生",
      condition: "DIF▽DEA",
      triggered: Boolean(r.value.macdBearCross),
    },
  ];
});

const sellSignals = computed(() => [
  {
    name: "RSI",
    value: s.value.flags?.rsiOverbought ? "已觸發" : "未觸發",
    condition: `目前 ≥ ${sellTh.value.rsi?.overbought ?? "75"}（超買狀態）`,
    triggered: Boolean(s.value.flags?.rsiOverbought),
  },
  {
    name: "KD",
    value: s.value.flags?.kdOverbought ? "已觸發" : "未觸發",
    condition: `K ≥ ${sellTh.value.kd?.overboughtK ?? "80"}（超買狀態）`,
    triggered: Boolean(s.value.flags?.kdOverbought),
  },
  {
    name: "MACD",
    value: s.value.flags?.macdDeadCross ? "已觸發" : "未觸發",
    condition: "最新 DIF 下穿 DEA（死叉）",
    triggered: Boolean(s.value.flags?.macdDeadCross),
  },
]);

async function load() {
  loading.value = true;
  try {
    const res = await fetchReports(1);
    if (res && res.length) {
      latestReport.value = res[0];
    }
  } catch (err) {
    console.error("[TechnicalView] Failed to load technical indicators:", err);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await waitReady();
  load();
});

import { onUnmounted } from "vue";
onUnmounted(() => {
  // 保持清理邏輯，但不再操作 backButton
});
</script>

<style scoped>
.view-container {
  padding: 16px 16px calc(112px + env(safe-area-inset-bottom, 0px));
}
.view-header {
  margin-bottom: 20px;
}
.header-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}
.view-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--iln-text);
  margin: 0;
}
.view-subtitle {
  font-size: 12px;
  color: var(--iln-hint);
  padding-left: 2px;
}

.section {
  margin-bottom: 24px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-hint);
  margin-bottom: 12px;
  text-transform: uppercase;
}

/* Indicators */
.indicators-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.indicator-card {
  background: var(--iln-surface);
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ind-label {
  font-size: 10px;
  color: var(--iln-hint);
}
.ind-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--iln-text);
}
.ind-value--sm {
  font-size: 14px;
}
.ind-sub {
  font-size: 10px;
  font-weight: 500;
}
.ind-sub--neutral {
  color: var(--iln-hint);
}
.ind-sub--danger {
  color: var(--iln-danger-text);
}
.ind-sub--warn {
  color: var(--iln-warn-text);
}
.ind-sub--ok {
  color: var(--iln-ok-text);
}
.ind-sub--buy {
  color: var(--iln-brand);
}

/* Risk Radar */
.risk-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.risk-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--iln-surface);
}
.risk-low {
  border-left: 3px solid var(--iln-ok);
}
.risk-mid {
  border-left: 3px solid var(--iln-warn);
}
.risk-high {
  border-left: 3px solid var(--iln-danger);
}
.risk-bar-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-text);
  flex: 1;
}
.risk-bar-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-hint);
}
.risk-dots {
  display: flex;
  gap: 5px;
}
.risk-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot-on {
  background: var(--iln-danger);
}
.dot-off {
  background: rgba(0, 0, 0, 0.12);
}

.signal-group {
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.07);
}
.signal-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px;
  background: var(--iln-surface);
  border: none;
  font-size: 13px;
  font-weight: 600;
}
.signal-rows {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.signal-row {
  display: grid;
  grid-template-columns: 20px 1fr 52px auto;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  font-size: 12px;
}
.sig-on {
  background: rgba(232, 72, 85, 0.08);
}
.sig-off {
  background: rgba(0, 0, 0, 0.03);
}
.sig-icon {
  font-size: 14px;
}
.sig-name {
  font-weight: 600;
}
.sig-value {
  font-weight: 700;
  text-align: right;
}
.sig-cond {
  font-size: 10px;
  color: var(--iln-hint);
  text-align: right;
}

/* States */
.loading-state,
.empty-state {
  padding: 40px 16px;
  text-align: center;
  color: var(--iln-hint);
}
.skeleton .sk-title {
  height: 14px;
  width: 40%;
  background: var(--iln-surface);
  margin-bottom: var(--iln-space-3);
  border-radius: var(--iln-radius-sm);
}
.skeleton .sk-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--iln-space-2);
}
.skeleton .sk-card {
  height: 60px;
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
}

</style>
