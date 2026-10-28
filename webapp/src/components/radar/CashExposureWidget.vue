<template>
  <div v-if="analysis" class="cash-exposure-card">
    <span class="dc-label">現金曝險分析</span>
    <span class="dc-status" :class="statusClass">{{ statusText }}</span>
    <div class="dc-row">
      <span class="dc-label">建議 DCA</span>
      <span class="dc-value">{{ fmt(suggestedDcaAmt) }}</span>
    </div>
    <div class="dc-row">
      <span class="dc-label">曝險缺口</span>
      <span class="dc-value">{{ fmt(exposureGap) }}</span>
    </div>
    <div class="dc-row" v-if="targetExposure != null">
      <span class="dc-label">目標曝險</span>
      <span class="dc-value">{{ fmt(targetExposure) }}</span>
    </div>
    <div class="dc-row dc-hint" v-if="message">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  analysis: {
    type: Object,
    default: null,
  },
});

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
</script>

<style scoped>
.cash-exposure-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dc-label {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.dc-status {
  font-size: 12px;
  font-weight: 600;
}
.text-success {
  color: var(--vp-c-brand);
}
.text-warning {
  color: #fbbf24;
}
.text-danger {
  color: #ef4444;
}
.text-muted {
  color: #94a3b8;
}
.dc-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 4px;
}
.dc-value {
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.dc-hint {
  font-size: 11px;
  color: var(--vp-c-text-2);
  margin-top: 4px;
}
</style>
