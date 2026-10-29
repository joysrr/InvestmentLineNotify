<template>
  <div class="theory-detail true-exposure-detail">
    <div class="theory-detail-header">
      <span class="theory-detail-title">真實曝險詳情</span>
      <span
        class="theory-status-badge"
        :class="`status-${trueExposureStatus?.toLowerCase()}`"
      >
        {{ trueExposureStatus }}
      </span>
    </div>
    <div class="theory-detail-content">
      <div v-if="trueExposureStatus === 'OK'" class="detail-section">
        <div class="detail-row">
          <span class="detail-label">真實曝險比例</span>
          <span class="detail-value">{{ formatPercent(trueExposureValue) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">總曝險 (Gross Exposure)</span>
          <span class="detail-value">{{ formatCurrency(grossExposure) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">金融資本</span>
          <span class="detail-value">{{ formatCurrency(financialCapital) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">人力資本</span>
          <span class="detail-value">{{ formatCurrency(humanCapital) }}</span>
        </div>
      </div>
      <div v-else-if="trueExposureStatus === 'UNAVAILABLE'" class="detail-section unavailable">
        <div class="detail-row">
          <span class="detail-label">狀態</span>
          <span class="detail-value unavailable">{{ trueExposureReason }}</span>
        </div>
        <div class="detail-hint">
          真實曝險需要人力資本資料才能計算。請先確認人力資本模組已正確輸出。
        </div>
      </div>
      <div v-else class="detail-section">
        <div class="detail-row">
          <span class="detail-label">狀態</span>
          <span class="detail-value">--</span>
        </div>
      </div>
    </div>
    <div class="theory-shadow-note">
      <small>Shadow-only：此數值不影響 P0 DCA 執行。</small>
    </div>
  </div>
</template>

<script setup>
import { useTheoryData } from "@/composables/useTheoryData";
import { computed } from "vue";

const { theoryData } = useTheoryData();

const trueExposureData = computed(() => theoryData.value?.trueExposure);
const trueExposureStatus = computed(() => trueExposureData.value?.status ?? null);
const trueExposureValue = computed(() => trueExposureData.value?.trueExposure ?? null);
const trueExposureReason = computed(() => trueExposureData.value?.reason ?? "未知");
const grossExposure = computed(() => trueExposureData.value?.grossExposure ?? 0);
const financialCapital = computed(() => trueExposureData.value?.financialCapital ?? 0);
const humanCapital = computed(() => trueExposureData.value?.humanCapital ?? 0);

const formatPercent = (value) => {
  if (value == null) return "--";
  return new Intl.NumberFormat("zh-TW", { style: "percent", minimumFractionDigits: 2 }).format(value);
};

const formatCurrency = (value) => {
  if (value == null) return "--";
  return new Intl.NumberFormat("zh-TW").format(value);
};
</script>

<style scoped>
.theory-detail {
  border: 1px solid var(--tg-theme-border-color, #ddd);
  border-radius: 8px;
  padding: 12px;
  background: var(--tg-theme-card-bg, #fff);
}
.theory-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.theory-detail-title {
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
.theory-detail-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-section.unavailable {
  opacity: 0.7;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.detail-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}
.detail-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.detail-value.unavailable {
  color: #c62828;
}
.detail-hint {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  margin-top: 4px;
}
.theory-shadow-note {
  margin-top: 8px;
  padding: 6px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
}
</style>
