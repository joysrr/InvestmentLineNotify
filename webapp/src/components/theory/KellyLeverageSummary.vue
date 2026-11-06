<template>
  <div class="theory-card">
    <div class="theory-card-header">
      <h3 class="theory-card-title">📊 當前槓桿分析</h3>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory" class="theory-unavailable">
      <p>⚠️ 理論數據未計算</p>
      <span class="theory-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="theory-card-content">
      <!-- Current Leverage -->
      <div class="leverage-display">
        <span class="leverage-label">當前槓桿</span>
        <span class="leverage-value">{{ formatLeverage(theory.currentLeverage) }}</span>
      </div>

      <!-- Kelly Limits -->
      <div v-if="hasKellyLimits" class="leverage-limits">
        <div class="limit-item">
          <span class="limit-label">保守凱莉</span>
          <span class="limit-value">{{ formatLeverage(theory.kellyLimits.conservative) }}</span>
        </div>
        <div class="limit-item">
          <span class="limit-label">完全凱莉</span>
          <span class="limit-value">{{ formatLeverage(theory.kellyLimits.full) }}</span>
        </div>
      </div>

      <!-- Kelly vs 槓桿對比 (Phase 3) -->
      <div v-if="theory?.targetLeverage != null" class="leverage-comparison">
        <div class="comparison-item">
          <span class="comparison-label">目標槓桿</span>
          <span class="comparison-value">{{ formatLeverage(theory.targetLeverage) }}</span>
        </div>
        <div class="comparison-item" v-if="leverageGap != null" :class="gapClass">
          <span class="comparison-label">槓桿缺口</span>
          <span class="comparison-value">{{ formatLeverage(Math.abs(leverageGap)) }}</span>
        </div>
        <div class="comparison-item">
          <span class="comparison-label">建議動作</span>
          <span class="comparison-value">{{ leverageAction }}</span>
        </div>
      </div>
      <div v-if="hasKellyLimits" class="leverage-bar">
        <div class="leverage-bar-track">
          <div
            class="leverage-bar-fill"
            :style="{ width: leveragePercentage + '%' }"
            :class="leverageStatusClass"
          ></div>
          <div class="leverage-marker" :style="{ left: leveragePercentage + '%' }">
            <span class="leverage-marker-label">你</span>
          </div>
        </div>
        <div class="leverage-bar-labels">
          <span>0x</span>
          <span>{{ formatLeverage(theory.kellyLimits.conservative) }}</span>
          <span>{{ formatLeverage(theory.kellyLimits.full) }}</span>
          <span>3.0x</span>
        </div>
      </div>

      <!-- Status Message -->
      <div class="leverage-status" :class="leverageStatusClass">
        <span>{{ leverageStatusText }}</span>
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
});

defineEmits(["view-detail"]);

// Check if Kelly limits are available
const hasKellyLimits = computed(() => {
  return (
    props.theory?.kellyLimits &&
    props.theory.kellyLimits.conservative != null &&
    props.theory.kellyLimits.full != null
  );
});

// 槓桿缺口 = 目標槓桿 - 當前槓桿
const leverageGap = computed(() => {
  const target = props.theory?.targetLeverage;
  const current = props.theory?.currentLeverage;
  if (
    target == null ||
    !Number.isFinite(target) ||
    current == null ||
    !Number.isFinite(current)
  )
    return null;
  return target - current;
});

// 槓桿建議動作
const leverageAction = computed(() => {
  const gap = leverageGap.value;
  if (gap == null) return null;
  if (gap > 0.05) return "可增加槓桿";
  if (gap < -0.05) return "超過建議槓桿";
  return "維持當前槓桿";
});

// 槓桿缺口 CSS 類
const gapClass = computed(() => {
  const gap = leverageGap.value;
  if (gap == null) return "";
  if (gap > 0) return "gap-positive";
  if (gap < 0) return "gap-negative";
  return "gap-neutral";
});

// Format leverage value
function formatLeverage(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2) + "x";
}

// Calculate leverage percentage for progress bar
const leveragePercentage = computed(() => {
  if (!hasKellyLimits.value || props.theory?.currentLeverage == null) return 0;
  const current = props.theory.currentLeverage;
  const max = 3.0; // Hard cap
  const percentage = (current / max) * 100;
  return Math.min(Math.max(percentage, 0), 100);
});

// Leverage status class
const leverageStatusClass = computed(() => {
  if (!hasKellyLimits.value || props.theory?.currentLeverage == null)
    return "status-unknown";

  const current = props.theory.currentLeverage;
  const conservative = props.theory.kellyLimits.conservative;
  const full = props.theory.kellyLimits.full;

  if (current <= conservative) return "status-safe";
  if (current <= full) return "status-moderate";
  return "status-high";
});

// Leverage status text
const leverageStatusText = computed(() => {
  if (!hasKellyLimits.value) {
    return "凱莉槓桿未計算（需要 mu/sigma 參數）";
  }

  if (props.theory?.currentLeverage == null) {
    return "尚無當前槓桿數據（無法評估偏離）";
  }

  const current = props.theory.currentLeverage;
  const conservative = props.theory.kellyLimits.conservative;
  const full = props.theory.kellyLimits.full;

  if (current <= conservative) return "✅ 當前槓桿低於保守建議";
  if (current <= full) return "⚠️ 槓桿已超過保守建議";
  return "🚨 槓桿已超過完全凱莉限制";
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

.leverage-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.leverage-label {
  font-size: 14px;
  color: var(--tg-theme-text-color, #444);
}

.leverage-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}

.leverage-limits {
  display: flex;
  gap: 12px;
}

.limit-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 8px;
}

.limit-label {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 2px;
}

.limit-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.leverage-bar {
  margin: 8px 0;
}

.leverage-bar-track {
  position: relative;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: visible;
}

.leverage-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.leverage-bar-fill.status-safe {
  background: #4caf50;
}

.leverage-bar-fill.status-moderate {
  background: #ff9800;
}

.leverage-bar-fill.status-high {
  background: #f44336;
}

.leverage-marker {
  position: absolute;
  top: -12px;
  transform: translateX(-50%);
  transition: left 0.3s ease;
}

.leverage-marker-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  border-radius: 4px;
}

.leverage-bar-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}

.leverage-status {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

.leverage-status.status-safe {
  background: rgba(76, 175, 80, 0.1);
  color: #2e7d32;
}

.leverage-status.status-moderate {
  background: rgba(255, 152, 0, 0.1);
  color: #e65100;
}

.leverage-status.status-high {
  background: rgba(244, 67, 54, 0.1);
  color: #c62828;
}

.leverage-status.status-unknown {
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

/* Phase 3: Kelly vs 槓桿對比 */
.leverage-comparison {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--vp-c-divider, #eaeaeb);
}

.comparison-item {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  padding: 8px 6px;
  text-align: center;
}

.comparison-label {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
  line-height: 1.2;
}

.comparison-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
  word-break: break-all;
}

.gap-positive .comparison-value {
  color: var(--vp-c-brand, #1665e3);
}

.gap-negative .comparison-value {
  color: #c62828;
}

.gap-neutral .comparison-value {
  color: #757575;
}
</style>
