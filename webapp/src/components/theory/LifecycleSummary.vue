<template>
  <div class="theory-card">
    <div class="theory-card-header">
      <h3 class="theory-card-title"><Icon name="default" size="sm" color="var(--iln-hint)" /> 生命週期投資分析</h3>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory" class="theory-unavailable">
      <p><Icon name="warn" size="sm" color="var(--iln-warn)" /> 理論數據未計算</p>
      <span class="theory-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="theory-card-content">
      <!-- Age Info -->
      <div class="lifecycle-grid">
        <div class="lifecycle-item">
          <span class="lifecycle-label">當前年齡</span>
          <span class="lifecycle-value">33 歲</span>
        </div>
        <div class="lifecycle-item">
          <span class="lifecycle-label">退休年齡</span>
          <span class="lifecycle-value">65 歲</span>
        </div>
        <div class="lifecycle-item">
          <span class="lifecycle-label">剩餘年限</span>
          <span class="lifecycle-value highlight">32 年</span>
        </div>
      </div>

      <!-- Human Capital Status -->
      <div class="human-capital-box">
        <div class="hc-row">
          <span class="hc-label">人力資本</span>
          <span class="hc-value">{{ formatHumanCapital(theory.humanCapital) }}</span>
        </div>
        <p v-if="!theory.humanCapital" class="hc-hint">
          需要收入數據才能計算人力資本
        </p>
      </div>

      <!-- True Exposure (if available) -->
      <div v-if="theory.trueExposure != null" class="true-exposure-box">
        <div class="te-header">
          <span class="te-label">人生真實曝險</span>
          <span class="te-value" :class="trueExposureClass">
            {{ formatPercent(theory.trueExposure * 100) }}
          </span>
        </div>
        <p class="te-hint">= 投資曝險 / (財務資本 + 人力資本)</p>
      </div>

      <!-- Lifecycle Advantage -->
      <div class="lifecycle-message">
        <p class="message-title"><Icon name="default" size="sm" color="var(--iln-hint)" /> 生命週期優勢</p>
        <ul class="message-list">
          <li>距離退休還有 <strong>32 年</strong></li>
          <li>有充足時間承受短期波動</li>
          <li>可採取較積極的投資策略</li>
          <li>維持低槓桿 (&lt;1.5x) 以避免極端風險</li>
        </ul>
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
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  theory: {
    type: Object,
    default: null,
  },
});

defineEmits(["view-detail"]);

// Format human capital
function formatHumanCapital(value) {
  if (value == null || !Number.isFinite(value)) return "未計算";
  return (value / 10000).toFixed(0) + "萬";
}

// Format percentage
function formatPercent(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(0) + "%";
}

// True exposure status class
const trueExposureClass = computed(() => {
  if (props.theory?.trueExposure == null) return "";
  
  const ratio = props.theory.trueExposure * 100;
  if (ratio <= 50) return "te-low";
  if (ratio <= 80) return "te-moderate";
  return "te-high";
});
</script>

<style scoped>
.theory-card {
  background: var(--iln-surface);
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
  color: var(--iln-text);
  margin: 0;
}

.theory-unavailable {
  text-align: center;
  padding: 16px 0;
}

.theory-unavailable p {
  font-size: 14px;
  color: var(--iln-hint);
  margin: 0 0 4px 0;
}

.theory-hint {
  font-size: 12px;
  color: var(--iln-hint);
}

.theory-card-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lifecycle-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.lifecycle-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background: var(--iln-bg);
  border-radius: 8px;
}

.lifecycle-label {
  font-size: 11px;
  color: var(--iln-hint);
  margin-bottom: 4px;
}

.lifecycle-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--iln-text);
}

.lifecycle-value.highlight {
  color: var(--iln-link);
  font-size: 16px;
}

.human-capital-box {
  padding: 12px;
  background: var(--iln-bg);
  border-radius: 8px;
}

.hc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hc-label {
  font-size: 13px;
  color: var(--iln-hint);
}

.hc-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--iln-text);
}

.hc-hint {
  font-size: 11px;
  color: var(--iln-hint);
  margin: 6px 0 0 0;
  font-style: italic;
}

.true-exposure-box {
  padding: 12px;
  background: var(--iln-bg);
  border-radius: 8px;
}

.te-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.te-label {
  font-size: 13px;
  color: var(--iln-hint);
}

.te-value {
  font-size: 18px;
  font-weight: 700;
}

.te-value.te-low {
  color: var(--iln-ok-text);
}

.te-value.te-moderate {
  color: var(--iln-warn-text);
}

.te-value.te-high {
  color: var(--iln-danger-text);
}

.te-hint {
  font-size: 11px;
  color: var(--iln-hint);
  margin: 0;
  font-style: italic;
}

.lifecycle-message {
  padding: 12px;
  background: rgba(51, 144, 236, 0.08);
  border-left: 3px solid var(--iln-link);
  border-radius: 6px;
}

.message-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-text);
  margin: 0 0 8px 0;
}

.message-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--iln-text);
  line-height: 1.6;
}

.message-list li {
  margin-bottom: 4px;
}

.message-list strong {
  color: var(--iln-link);
  font-weight: 600;
}

.theory-detail-btn {
  background: transparent;
  border: 1px solid var(--iln-hint);
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--iln-link);
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.theory-detail-btn:active {
  background: var(--iln-surface);
}
</style>
