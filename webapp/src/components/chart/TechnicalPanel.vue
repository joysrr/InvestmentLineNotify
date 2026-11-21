<template>
  <GlobalErrorBoundary>
    <div class="view-container tabular">
      <div class="view-header">
        <div class="header-top">
          <h2 class="view-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> <span>技術指標詳情</span></h2>
          <BackPill :to="{ path: '/chart', query: { tab: 'technical' } }" label="圖表 · 技術指標" />
        </div>
        <span class="view-subtitle">{{ todayLabel }}</span>
      </div>

      <!-- 骨架屏 -->
      <div v-if="loading" class="loading-state" aria-busy="true">
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
            <StatCard
              label="RSI"
              :value="Number(rsiInfo.display)"
              :status="cardClassToStatus(rsiInfo.cardClass)"
              framed
            >
              <template #suffix>
                {{ rsiInfo.label }}
                <Icon
                  name="info"
                  size="xs"
                  @click.stop="toggleIndicator('rsi')"
                />
              </template>
            </StatCard>
            <div
              v-if="expandedIndicator === 'rsi'"
              class="indicator-desc"
            >{{ indicatorDescriptions.rsi }}</div>
            <StatCard
              label="KD (K)"
              :value="Number(kdKInfo.display)"
              :status="cardClassToStatus(kdKInfo.cardClass)"
              framed
            >
              <template #suffix>
                {{ kdKInfo.label }}
                <Icon
                  name="info"
                  size="xs"
                  @click.stop="toggleIndicator('kdK')"
                />
              </template>
            </StatCard>
            <div
              v-if="expandedIndicator === 'kdK'"
              class="indicator-desc"
            >{{ indicatorDescriptions.kdK }}</div>
            <StatCard
              label="KD (D)"
              :value="Number(kdDInfo.display)"
              :status="cardClassToStatus(kdDInfo.cardClass)"
              framed
            >
              <template #suffix>
                {{ kdDInfo.label }}
                <Icon
                  name="info"
                  size="xs"
                  @click.stop="toggleIndicator('kdD')"
                />
              </template>
            </StatCard>
            <div
              v-if="expandedIndicator === 'kdD'"
              class="indicator-desc"
            >{{ indicatorDescriptions.kdD }}</div>
            <StatCard
              label="乖離率 MA240"
              :value="biasInfo.display"
              :status="cardClassToStatus(biasInfo.cardClass)"
              framed
            >
              <template #suffix>
                {{ biasInfo.label }}
                <Icon
                  name="info"
                  size="xs"
                  @click.stop="toggleIndicator('bias')"
                />
              </template>
            </StatCard>
            <div
              v-if="expandedIndicator === 'bias'"
              class="indicator-desc"
            >{{ indicatorDescriptions.bias }}</div>
            <StatCard
              label="MACD"
              :value="macdInfo.display"
              :status="cardClassToStatus(macdInfo.cardClass)"
              size="sm"
              framed
            >
              <template #suffix>
                {{ macdInfo.label }}
                <Icon
                  name="info"
                  size="xs"
                  @click.stop="toggleIndicator('macd')"
                />
              </template>
            </StatCard>
            <div
              v-if="expandedIndicator === 'macd'"
              class="indicator-desc"
            >{{ indicatorDescriptions.macd }}</div>
          </div>
        </section>

        <!-- 風險雷達 -->
        <section class="section">
          <h3 class="section-title"><Icon name="radar" size="sm" color="var(--iln-hint)" /> <span>訊號雷達</span></h3>
          <div class="risk-summary">
            <div class="risk-bar" :class="reversalRiskClass">
              <span class="risk-bar-label">近期轉弱</span>
              <span class="risk-bar-count">{{ reversalTriggered }} / {{ reversalTotal }}</span>
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
              <span class="risk-bar-count">{{ sellTriggered }} / {{ sellTotal }}</span>
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
          <CollapsibleSection
            title="轉弱監控詳細"
            :expanded="reversalExpanded"
            @update:expanded="reversalExpanded = $event"
            indicator="chevron"
          >
            <div class="signal-rows">
              <div
                v-for="sig in reversalSignals"
                :key="sig.name"
                class="signal-row"
                :class="sig.triggered ? 'sig-on' : 'sig-off'"
              >
                <span class="sig-icon">
                  <Icon :name="sig.triggered ? 'alert-triangle' : 'check-circle'" size="sm" />
                </span>
                <span class="sig-name">{{ sig.name }}</span>
                <span class="sig-value">{{ sig.value }}</span>
                <span class="sig-cond">{{ sig.condition }}</span>
              </div>
            </div>
          </CollapsibleSection>

          <!-- 賣出訊號詳細 -->
          <CollapsibleSection
            title="賣出訊號詳細"
            :expanded="sellExpanded"
            @update:expanded="sellExpanded = $event"
            indicator="chevron"
          >
            <div class="signal-rows">
              <div
                v-for="sig in sellSignals"
                :key="sig.name"
                class="signal-row"
                :class="sig.triggered ? 'sig-on' : 'sig-off'"
              >
                <span class="sig-icon">
                  <Icon :name="sig.triggered ? 'alert-triangle' : 'check-circle'" size="sm" />
                </span>
                <span class="sig-name">{{ sig.name }}</span>
                <span class="sig-value">{{ sig.value }}</span>
                <span class="sig-cond">{{ sig.condition }}</span>
              </div>
            </div>
          </CollapsibleSection>
        </section>
      </template>

      <EmptyState v-else-if="!loading" icon="Box" title="尚無指標數據" />
    </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import Icon from "@/components/common/Icon.vue";
import StatCard from "@/components/common/StatCard.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";
import { fetchReports } from "../../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import { waitReady } from "../../composables/useTelegram.js";
import BackPill from "@/components/common/BackPill.vue";
import EmptyState from "@/components/common/EmptyState.vue";

defineProps({
  timeRange: {
    type: String,
    default: "ALL",
  },
});

const latestReport = ref(null);
const loading = ref(true);
const expandedIndicator = ref(null);

const reversalExpanded = ref(true);
const sellExpanded = ref(true);

const indicatorDescriptions = {
  rsi: "相對強弱指標：>70 為超買、<30 為超賣，常用於判斷超買超賣區間",
  kdK: "隨機指標 K 值：反映短期買賣動能，與 D 值交叉訊號常用於進出場時點",
  kdD: "隨機指標 D 值：反映中期趨勢方向，K 值上穿 D 值為買訊號",
  bias: "乖離率 MA240：價格與 240 日移動平均線的乖離幅度，偏離過大可能回歸",
  macd: "MACD：移動平均收斂發散指標，DIF 與 DEA 交叉及柱狀圖用於判斷趨勢強弱",
};

function toggleIndicator(key) {
  expandedIndicator.value = expandedIndicator.value === key ? null : key;
}

const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

function cardClassToStatus(cls) {
  const map = {
    "ind-danger": "danger",
    "ind-warn": "warn",
    "ind-ok": "ok",
    "ind-buy": "ok",
  };
  return map[cls] ?? null;
}

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
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.view-container {
  padding: var(--iln-space-4) var(--iln-space-4) calc(112px + env(safe-area-inset-bottom, 0px));
}

.view-header {
  margin-bottom: var(--iln-space-5, 20px);
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-3);
  margin-bottom: var(--iln-space-1);
}

.view-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  font-size: var(--iln-font-lg);
  font-weight: 700;
  color: var(--iln-text);
  margin: 0;
}

.view-subtitle {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  padding-left: 2px;
}

.section {
  margin-bottom: var(--iln-space-6);
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  font-weight: 600;
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-3);
  text-transform: uppercase;
}

.indicators-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--iln-space-2);
}

.indicator-desc {
  grid-column: 1 / -1;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  padding: var(--iln-space-1-5, 6px) var(--iln-space-2-5, 10px);
  background: var(--iln-surface-muted);
  border-radius: var(--iln-radius-sm);
  margin-top: var(--iln-space-1);
}

.risk-summary {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-4);
}

.risk-bar {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2-5, 10px);
  padding: var(--iln-space-2-5, 10px) var(--iln-space-3);
  border-radius: var(--iln-radius-md);
  background: var(--iln-surface);
}

.risk-low {
  border-left: 3px solid var(--iln-viz-bull-border);
}

.risk-mid {
  border-left: 3px solid var(--iln-viz-alert-border);
}

.risk-high {
  border-left: 3px solid var(--iln-viz-bear-border);
}

.risk-bar-label {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-text);
  flex: 1;
}

.risk-bar-count {
  font-size: var(--iln-font-sm);
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
  border-radius: var(--iln-radius-full);
}

.dot-on {
  background: var(--iln-viz-bear);
}

.dot-off {
  background: var(--iln-border-subtle);
}

.signal-rows {
  padding: var(--iln-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1-5, 6px);
}

.signal-row {
  display: grid;
  grid-template-columns: 20px 1fr 52px auto;
  align-items: center;
  gap: var(--iln-space-2);
  padding: var(--iln-space-2);
  border-radius: var(--iln-radius-md);
  font-size: var(--iln-font-xs);
}

.sig-on {
  background: var(--iln-viz-bear-bg);
}

.sig-off {
  background: var(--iln-surface-faint);
}

.sig-icon {
  display: inline-flex;
  align-items: center;
  font-size: var(--iln-font-sm);
}

.sig-name {
  font-weight: 600;
}

.sig-value {
  font-weight: 700;
  text-align: right;
}

.sig-cond {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-align: right;
}

.loading-state {
  padding: var(--iln-space-10, 40px) var(--iln-space-4);
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
