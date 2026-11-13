<template>
  <div class="theory-card">
    <div class="theory-card-header">
      <h3 class="theory-card-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 輸入數據來源</h3>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!inputs" class="theory-unavailable">
      <p><Icon name="warn" size="sm" color="var(--iln-warn)" /> 輸入數據未提供</p>
      <span class="theory-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="theory-card-content">
      <!-- Data Items -->
      <div class="input-list">
        <!-- 0050 -->
        <div v-if="inputs.value0050" class="input-item">
          <div class="input-header">
            <span class="input-name">0050 市值</span>
            <span class="input-value">{{ formatAmount(inputs.value0050.value) }}</span>
          </div>
          <div class="input-meta">
            <span class="input-source">{{ formatSource(inputs.value0050.source) }}</span>
            <span class="input-time">{{ formatTime(inputs.value0050.asOf) }}</span>
          </div>
        </div>

        <!-- 00675L -->
        <div v-if="inputs.value00675L" class="input-item">
          <div class="input-header">
            <span class="input-name">00675L 市值</span>
            <span class="input-value">{{ formatAmount(inputs.value00675L.value) }}</span>
          </div>
          <div class="input-meta">
            <span class="input-source">{{ formatSource(inputs.value00675L.source) }}</span>
            <span class="input-time">{{ formatTime(inputs.value00675L.asOf) }}</span>
          </div>
        </div>

        <!-- Total Debt -->
        <div v-if="inputs.totalDebt" class="input-item">
          <div class="input-header">
            <span class="input-name">總負債</span>
            <span class="input-value">{{ formatAmount(inputs.totalDebt.value) }}</span>
          </div>
          <div class="input-meta">
            <span class="input-source">{{ formatSource(inputs.totalDebt.source) }}</span>
            <span class="input-time">{{ formatTime(inputs.totalDebt.asOf) }}</span>
          </div>
        </div>
      </div>

      <!-- Data Timestamp -->
      <div v-if="reportDate" class="data-timestamp">
        <span class="timestamp-label"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 數據時間</span>
        <span class="timestamp-value">{{ reportDate }}</span>
      </div>

      <!-- View Detail Link -->
      <button class="theory-detail-btn" @click="$emit('view-detail')">
        查看詳細 →
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  inputs: {
    type: Object,
    default: null,
  },
  reportDate: {
    type: String,
    default: null,
  },
});

defineEmits(["view-detail"]);

// Format currency amount
function formatAmount(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0萬";
  return (value / 10000).toFixed(1) + "萬";
}

// Format source
function formatSource(source) {
  if (!source) return "—";
  if (source === "DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES") {
    return "DERIVED";
  }
  return source;
}

// Format time
function formatTime(time) {
  if (!time) return "—";
  try {
    const date = new Date(time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return time;
  }
}
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

.input-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-item {
  padding: 10px 12px;
  background: var(--iln-bg);
  border-radius: 8px;
}

.input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.input-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--iln-text);
}

.input-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--iln-text);
}

.input-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--iln-hint);
}

.input-source {
  font-family: monospace;
}

.data-timestamp {
  padding: 10px 12px;
  background: rgba(51, 144, 236, 0.08);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timestamp-label {
  font-size: 12px;
  color: var(--iln-hint);
}

.timestamp-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-text);
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
