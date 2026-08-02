<template>
  <div class="quality-badges">
    <span class="badge" v-for="(quality, key) in dataQuality" :key="key" :class="badgeClass(quality)">
      <span class="badge-icon">{{ getIcon(key) }}</span>
      <span class="badge-label">{{ formatLabel(key) }}</span>
      <span class="badge-status" :class="quality">{{ formatQuality(quality) }}</span>
    </span>
  </div>
</template>

<script setup>
defineProps({
  dataQuality: {
    type: Object,
    required: true,
  },
});

function getIcon(key) {
  const icons = {
    rsi: "📊",
    kd: "📈",
    macd: "📉",
    ma20: "📈",
    ma60: "📈",
    ma240: "📈",
    atr: "📊",
  };
  return icons[key] || "📋";
}

function formatLabel(key) {
  const labels = {
    rsi: "RSI",
    kd: "KD",
    macd: "MACD",
    ma20: "MA20",
    ma60: "MA60",
    ma240: "MA240",
    atr: "ATR",
  };
  return labels[key] || key.toUpperCase();
}

function formatQuality(q) {
  const map = {
    ok: "正常",
    fallback_used: "已降級",
    insufficient_data: "資料不足",
  };
  return map[q] || q;
}

function badgeClass(q) {
  return `badge-${q}`;
}
</script>

<style scoped>
.quality-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: #fff;
  border: 1px solid #eee;
}

.badge-icon { font-size: 12px; }

.badge-label { color: #666; }

.badge-status {
  text-transform: capitalize;
}

.badge-ok {
  background: #e8f5e9;
  border-color: #c8e6c9;
  color: #2e7d32;
}

.badge-fallback_used {
  background: #fff8e1;
  border-color: #ffecb3;
  color: #f57f17;
}

.badge-insufficient_data {
  background: #fbe9e7;
  border-color: #ffccbc;
  color: #c62828;
}
</style>