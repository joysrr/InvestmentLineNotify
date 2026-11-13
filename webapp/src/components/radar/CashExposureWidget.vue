<template>
  <div v-if="analysis" class="cash-exposure-card">
    <ContentCard variant="outlined" padding="sm" radius="md">
      <span class="dc-label">現金曝險分析</span>
      <span class="dc-status" :class="statusClass">{{ statusText }}</span>
    <div class="dc-row">
      <StatCard size="sm" :framed="false" align="left" label="建議 DCA" :value="suggestedDcaAmt" />
    </div>
    <div class="dc-row">
      <StatCard size="sm" :framed="false" align="left" label="曝險缺口" :value="exposureGap" />
    </div>
    <div class="dc-row" v-if="targetExposure != null">
      <StatCard size="sm" :framed="false" align="left" label="目標曝險" :value="targetExposure" />
    </div>
    <div class="dc-row dc-hint" v-if="message">
      <StatCard size="sm" :framed="false" align="left" label="" :value="message" />
    </div>

    <!-- 槓桿儀表板 -->
    <div class="leverage-section" v-if="targetLeverage != null || currentLeverage != null">
      <span class="section-title">📊 槓桿儀表板</span>
      <div class="metric-grid">
        <div class="metric-card">
          <StatCard size="sm" :framed="false" align="center" label="目標槓桿" :value="targetLeverage" format="number" :decimals="2" unit="x" />
        </div>
        <div class="metric-card">
          <StatCard size="sm" :framed="false" align="center" label="當前槓桿" :value="currentLeverage" format="number" :decimals="2" unit="x" />
        </div>
        <div class="metric-card" v-if="leverageGap != null">
          <StatCard size="sm" :framed="false" align="center" label="槓桿缺口" :value="leverageGap" format="number" :decimals="2" unit="x" />
        </div>
      </div>
    </div>

    <!-- 批次計算推導 -->
    <div class="batch-section" v-if="batchCalculation">
      <span class="section-title">🧮 批次計算推導</span>
      <div class="metric-grid">
        <div class="metric-card">
          <StatCard size="sm" :framed="false" align="center" label="曝險缺口" :value="batchCalculation.exposureGap" />
        </div>
        <div class="metric-card">
          <StatCard size="sm" :framed="false" align="center" label="資本缺口 (÷2)" :value="batchCalculation.capitalGap" />
        </div>
        <div class="metric-card">
          <StatCard size="sm" :framed="false" align="center" label="缺口 ÷ 10 批" :value="batchCalculation.batchByCount" />
        </div>
        <div class="metric-card">
          <StatCard size="sm" :framed="false" align="center" label="現金 × 10%" :value="batchCalculation.batchByCash" />
        </div>
        <div class="metric-card batch-selected">
          <StatCard size="sm" :framed="false" align="center" label="最終批次" :value="batchCalculation.selectedBatch" />
        </div>
      </div>
    </div>
  </ContentCard>
  </div>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import StatCard from "@/components/common/StatCard.vue";

const props = defineProps({
  analysis: {
    type: Object,
    default: null,
  },
});

const fmtLeverage = (n) => {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(2);
};

const fmt = (n) => {
  if (n == null || !Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(n);
};

const statusConfig = {
  RECOMMEND_DCA: { text: "建議加速 DCA", cls: "text-success" },
  OVER_EXPOSED: { text: "已達建議曝險", cls: "text-warning" },
  INSUFFICIENT_CASH: { text: "現金不足", cls: "text-danger" },
  DEFER: { text: "雷達異常暫緩", cls: "text-muted" },
  UNAVAILABLE: { text: "資料不足", cls: "text-muted" },
};

const statusText = computed(() =>
  props.analysis ? (statusConfig[props.analysis.status]?.text || "未知") : ""
);
const statusClass = computed(() =>
  props.analysis ? (statusConfig[props.analysis.status]?.cls || "") : ""
);

const suggestedDcaAmt = computed(() => props.analysis?.suggestedDcaAmt ?? 0);
const exposureGap = computed(() => props.analysis?.exposureGap ?? 0);
const targetExposure = computed(() => props.analysis?.targetExposure ?? 0);
const message = computed(() => props.analysis?.message || "");
const batchCalculation = computed(() => props.analysis?.batchCalculation ?? null);
const targetLeverage = computed(() => props.analysis?.targetLeverage ?? null);
const currentLeverage = computed(() => props.analysis?.currentLeverage ?? null);
const leverageGap = computed(() => {
  if (targetLeverage.value == null || currentLeverage.value == null) return null;
  return targetLeverage.value - currentLeverage.value;
});
</script>

<style scoped>
.cash-exposure-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dc-label {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}
.dc-status {
  font-size: 12px;
  font-weight: 600;
}
.text-success {
  color: var(--iln-ok-text);
}
.text-warning {
  color: var(--iln-warn-text);
}
.text-danger {
  color: var(--iln-danger-text);
}
.text-muted {
  color: var(--iln-hint);
}
.dc-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--iln-font-xs);
  border-top: 1px solid var(--iln-border-subtle);
  padding-top: 4px;
}
.dc-value {
  font-weight: 600;
  color: var(--iln-text);
}
.dc-hint {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: 4px;
}

/* Section title */
.section-title {
  font-size: 11px;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 10px;
  margin-bottom: 8px;
}

/* Metric grid */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.metric-card {
  background: var(--iln-bg);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: 10px 8px;
  text-align: center;
}

.metric-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  line-height: 1.2;
}

.metric-value {
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-text);
  word-break: break-all;
}

/* Selected batch highlight */
.batch-selected {
  border-color: var(--iln-brand);
  background: var(--iln-brand-soft);
}
.batch-selected .metric-value {
  color: var(--iln-brand);
}
</style>
