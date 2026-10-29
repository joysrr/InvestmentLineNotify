<template>
  <div class="theory-card crash-tolerance-summary">
    <div class="theory-card-header">
      <span class="theory-card-title">崩盤耐受度 (Crash Tolerance)</span>
      <span
        class="theory-status-badge"
        :class="`status-${crashToleranceStatus?.toLowerCase()}`"
      >
        {{ crashToleranceStatus }}
      </span>
    </div>
    <div class="theory-card-content">
      <div v-if="crashToleranceStatus === 'ESTIMATED'" class="value-display">
        <span class="value-label">崩盤耐受度</span>
        <span class="value">{{ formatPercent(crashToleranceValue) }}</span>
      </div>
      <div v-else-if="crashToleranceStatus === 'UNAVAILABLE'" class="value-display unavailable">
        <span class="value-label">崩盤耐受度</span>
        <span class="value unavailable">{{ crashToleranceReason }}</span>
      </div>
      <div v-else class="value-display">
        <span class="value-label">崩盤耐受度</span>
        <span class="value">--</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  theory: { type: Object, required: true },
});

const crashToleranceData = computed(() => props.theory?.crashTolerance);
const crashToleranceStatus = computed(() => crashToleranceData.value?.status ?? null);
const crashToleranceValue = computed(() => crashToleranceData.value?.crashTolerance ?? null);
const crashToleranceReason = computed(() => crashToleranceData.value?.reason ?? "未知");

const formatPercent = (value) => {
  if (value == null) return "--";
  return new Intl.NumberFormat("zh-TW", { style: "percent", minimumFractionDigits: 0 }).format(value);
};
</script>

<style scoped>
.theory-card {
  border: 1px solid var(--tg-theme-border-color, #ddd);
  border-radius: 8px;
  padding: 12px;
  background: var(--tg-theme-card-bg, #fff);
}
.theory-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.theory-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.theory-status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.status-ok {
  background: #e8f5e9;
  color: #2e7d32;
}
.status-unavailable {
  background: #ffebee;
  color: #c62828;
}
.status-estimated {
  background: #fff3e0;
  color: #ef6c00;
}
.theory-card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.value-display {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.value-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}
.value {
  font-size: 16px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.value.unavailable {
  color: #c62828;
}
</style>
