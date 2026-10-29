<template>
  <div class="theory-card true-exposure-summary">
    <div class="theory-card-header">
      <span class="theory-card-title">真實曝險 (True Exposure)</span>
      <span
        class="theory-status-badge"
        :class="`status-${trueExposureStatus?.toLowerCase()}`"
      >
        {{ trueExposureStatus }}
      </span>
    </div>
    <div class="theory-card-content">
      <div v-if="trueExposureStatus === 'OK'" class="value-display">
        <span class="value-label">真實曝險比例</span>
        <span class="value">{{ formatPercent(trueExposureValue) }}</span>
      </div>
      <div v-else-if="trueExposureStatus === 'UNAVAILABLE'" class="value-display unavailable">
        <span class="value-label">真實曝險</span>
        <span class="value unavailable">{{ trueExposureReason }}</span>
      </div>
      <div v-else class="value-display">
        <span class="value-label">真實曝險比例</span>
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

const trueExposureData = computed(() => props.theory?.trueExposure);
const trueExposureStatus = computed(() => trueExposureData.value?.status ?? null);
const trueExposureValue = computed(() => trueExposureData.value?.trueExposure ?? null);
const trueExposureReason = computed(() => trueExposureData.value?.reason ?? "未知");

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
