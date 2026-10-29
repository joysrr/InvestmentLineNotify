<template>
  <div class="theory-card">
    <div class="theory-card-header">
      <h3 class="theory-card-title">📊 真實曝險 (True Exposure)</h3>
      <span
        class="theory-status-badge"
        :class="`status-${trueExposureStatus?.toLowerCase()}`"
      >
        {{ trueExposureStatus }}
      </span>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="trueExposureStatus === 'UNAVAILABLE'" class="theory-unavailable">
      <span class="theory-reason">{{ trueExposureReason }}</span>
      <p>⚠️ 理論數據未計算</p>
      <span class="theory-hint">請先執行 dailyCheck 產生 theoreticalShadow</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="theory-card-content">
      <!-- Main value -->
      <div class="exposure-row">
        <span class="exposure-label">真實曝險比例</span>
        <span class="exposure-value">{{ formatPercent(trueExposureValue) }}</span>
      </div>

      <!-- Detail button -->
      <button
        class="detail-button"
        @click="$emit('view-detail', 'trueExposure')"
      >
        🔍 查看詳情
      </button>
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
const trueExposureReason = computed(() => trueExposureData.value?.reason ?? null);

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
  margin-bottom: 12px;
}

.theory-card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--tg-theme-text-color, #222);
}

.theory-status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.status-ok {
  background: rgba(46, 125, 50, 0.1);
  color: var(--tg-theme-text-color, #2e7d32);
  border: 1px solid rgba(46, 125, 50, 0.3);
}

.status-unavailable {
  background: rgba(198, 40, 40, 0.1);
  color: var(--tg-theme-text-color, #c62828);
  border: 1px solid rgba(198, 40, 40, 0.3);
}

.status-estimated {
  background: rgba(239, 108, 0, 0.1);
  color: var(--tg-theme-text-color, #ef6c00);
  border: 1px solid rgba(239, 108, 0, 0.3);
}

.theory-reason {
  font-size: 11px;
  color: #c62828;
  margin-top: 4px;
}

.theory-unavailable {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 0;
  text-align: center;
  color: var(--tg-theme-hint-color, #999);
}

.theory-card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exposure-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.exposure-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}

.exposure-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.detail-button {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--tg-theme-border-color, #ddd);
  border-radius: 6px;
  background: var(--tg-theme-button-bg, #f5f5f5);
  color: var(--tg-theme-text-color, #222);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.detail-button:hover {
  background: var(--tg-theme-button-hover-bg, #e0e0e0);
  border-color: var(--tg-theme-primary-color, #3b82f6);
}
</style>
