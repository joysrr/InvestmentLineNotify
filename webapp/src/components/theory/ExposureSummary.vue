<template>
  <div class="theory-card">
    <div class="theory-card-header">
      <h3 class="theory-card-title">📈 市場曝險</h3>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory" class="theory-unavailable">
      <p>⚠️ 理論數據未計算</p>
      <span class="theory-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="theory-card-content">
      <!-- Gross Exposure -->
      <div class="exposure-row">
        <span class="exposure-label">總曝險</span>
        <span class="exposure-value">{{ formatAmount(theory.grossExposure) }}</span>
      </div>

      <!-- Account Net Asset -->
      <div v-if="portfolioSnapshot" class="exposure-row">
        <span class="exposure-label">財務資本</span>
        <span class="exposure-value">{{ formatAmount(portfolioSnapshot.accountNetAsset) }}</span>
      </div>

      <!-- Exposure Ratio -->
      <div v-if="exposureRatio != null" class="exposure-ratio">
        <div class="ratio-header">
          <span class="ratio-label">曝險比例</span>
          <span class="ratio-value" :class="exposureRatioClass">{{ formatPercent(exposureRatio) }}</span>
        </div>
        <div class="ratio-bar">
          <div 
            class="ratio-bar-fill" 
            :style="{ width: Math.min(exposureRatio, 100) + '%' }"
            :class="exposureRatioClass"
          ></div>
        </div>
      </div>

      <!-- Status Message -->
      <div class="exposure-status" :class="exposureRatioClass">
        <span>{{ exposureStatusText }}</span>
      </div>

      <!-- View Detail Link -->
      <button class="theory-detail-btn" @click="$emit('view-detail')">
        查看詳細 →
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  theory: {
    type: Object,
    default: null,
  },
  portfolioSnapshot: {
    type: Object,
    default: null,
  },
});

defineEmits(["view-detail"]);

// Format currency amount
function formatAmount(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return (value / 10000).toFixed(1) + "萬";
}

// Format percentage
function formatPercent(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(0) + "%";
}

// Calculate exposure ratio
const exposureRatio = computed(() => {
  if (!props.theory?.grossExposure || !props.portfolioSnapshot?.accountNetAsset) {
    return null;
  }
  return (props.theory.grossExposure / props.portfolioSnapshot.accountNetAsset) * 100;
});

// Exposure ratio status class
const exposureRatioClass = computed(() => {
  if (exposureRatio.value == null) return "status-unknown";
  
  const ratio = exposureRatio.value;
  if (ratio <= 60) return "status-conservative";
  if (ratio <= 80) return "status-moderate";
  if (ratio <= 100) return "status-aggressive";
  return "status-extreme";
});

// Exposure status text
const exposureStatusText = computed(() => {
  if (exposureRatio.value == null) {
    return "無法計算曝險比例";
  }

  const ratio = exposureRatio.value;
  if (ratio <= 60) return "✅ 曝險比例保守，現金充足";
  if (ratio <= 80) return "⚠️ 曝險比例適中";
  if (ratio <= 100) return "🔶 曝險比例較高，建議保留更多現金";
  return "🚨 曝險超過資本，使用槓桿中";
});
</script>

<style scoped>
.theory-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.theory-card-header {
  margin-bottom: 12px;
}

.theory-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0;
}

.theory-unavailable {
  text-align: center;
  padding: 16px 0;
}

.theory-unavailable p {
  font-size: 14px;
  color: var(--tg-theme-hint-color, #999);
  margin: 0 0 4px 0;
}

.theory-hint {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #aaa);
}

.theory-card-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exposure-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 8px;
}

.exposure-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #666);
}

.exposure-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.exposure-ratio {
  padding: 8px 0;
}

.ratio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ratio-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #666);
}

.ratio-value {
  font-size: 18px;
  font-weight: 700;
}

.ratio-value.status-conservative {
  color: var(--iln-ok-text);
}

.ratio-value.status-moderate {
  color: var(--iln-warn-text);
}

.ratio-value.status-aggressive {
  color: var(--iln-danger-text);
}

.ratio-value.status-extreme {
  color: var(--iln-danger-text);
}

.ratio-bar {
  height: 8px;
  background: var(--tg-theme-secondary-bg-color, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
}

.ratio-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.ratio-bar-fill.status-conservative {
  background: var(--iln-ok-bg);
}

.ratio-bar-fill.status-moderate {
  background: var(--iln-warn-bg);
}

.ratio-bar-fill.status-aggressive {
  background: var(--iln-danger-bg);
}

.ratio-bar-fill.status-extreme {
  background: var(--iln-danger-bg);
}

.exposure-status {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

.exposure-status.status-conservative {
  background: rgba(76, 175, 80, 0.1);
  color: var(--iln-ok-text);
}

.exposure-status.status-moderate {
  background: rgba(255, 152, 0, 0.1);
  color: var(--iln-warn-text);
}

.exposure-status.status-aggressive {
  background: rgba(255, 87, 34, 0.1);
  color: var(--iln-danger-text);
}

.exposure-status.status-extreme {
  background: rgba(244, 67, 54, 0.1);
  color: var(--iln-danger-text);
}

.exposure-status.status-unknown {
  background: rgba(158, 158, 158, 0.1);
  color: var(--tg-theme-hint-color, #757575);
}

.theory-detail-btn {
  background: transparent;
  border: 1px solid var(--tg-theme-hint-color, #ddd);
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--tg-theme-link-color, #3390ec);
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.theory-detail-btn:active {
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
}
</style>
