<template>
  <div class="result-card" data-testid="forward-result-card">
    <!-- Price Summary -->
    <div class="price-summary">
      <div class="price-item">
        <span class="price-label">模擬 0050</span>
        <span class="price-value price-up">{{ formatPrice(result.simulatedPrice0050) }}</span>
      </div>
      <div class="price-divider">→</div>
      <div class="price-item">
        <span class="price-label">模擬 00675L</span>
        <span class="price-value price-up">{{ formatPrice(result.simulatedPriceZ2) }}</span>
      </div>
    </div>

    <!-- Change Indicators -->
    <div class="change-indicators">
      <div class="change-item">
        <span class="change-label">0050 變化</span>
        <span class="change-value" :class="result.priceDiffPct0050 >= 0 ? 'positive' : 'negative'">
          {{ result.priceDiffPct0050 >= 0 ? '+' : '' }}{{ result.priceDiffPct0050 }}%
        </span>
      </div>
      <div class="change-divider">/</div>
      <div class="change-item">
        <span class="change-label">00675L 變化</span>
        <span class="change-value" :class="result.priceDiffPctZ2 >= 0 ? 'positive' : 'negative'">
          {{ result.priceDiffPctZ2 >= 0 ? '+' : '' }}{{ result.priceDiffPctZ2 }}%
        </span>
      </div>
    </div>

    <!-- Strategy Result -->
    <div class="strategy-result">
      <div class="strategy-main">
        <div class="strategy-score" :class="scoreClass">
          <span class="score-label">策略分數</span>
          <span class="score-value">{{ result.strategyScore }}</span>
        </div>
        <div class="strategy-status" :class="statusClass">
          <span class="status-label">狀態</span>
          <span class="status-value">{{ result.strategyStatus }}</span>
        </div>
      </div>
      <div class="strategy-target" :class="targetClass">
        <span class="target-icon">{{ getTargetIcon(result.strategyTarget) }}</span>
        <span class="target-text">{{ result.strategyTarget }}</span>
      </div>
      <div class="strategy-suggestion">
        {{ result.strategySuggestion }}
      </div>
    </div>

    <!-- Maintenance Margin -->
    <div class="maintenance-card" :class="marginClass">
      <div class="margin-header">
        <span class="margin-icon">🛡️</span>
        <span class="margin-title">維持率</span>
      </div>
      <div class="margin-value">{{ result.maintenanceMargin.toFixed(1) }}%</div>
      <div class="margin-status">{{ getMarginStatusText(result.maintenanceMargin) }}</div>
    </div>

    <!-- Portfolio Health -->
    <div class="health-card" :class="healthClass">
      <div class="health-header">
        <span class="health-icon">{{ getHealthIcon(result.portfolioHealth) }}</span>
        <span class="health-title">Portfolio Health</span>
      </div>
      <div class="health-status">{{ getHealthStatusText(result.portfolioHealth) }}</div>
    </div>

    <!-- Lifecycle Stage (Readonly) -->
    <div class="lifecycle-card">
      <div class="lifecycle-header">
        <span class="lifecycle-icon">📅</span>
        <span class="lifecycle-title">生命週期</span>
        <span class="readonly-badge">唯讀</span>
      </div>
      <div class="lifecycle-value">{{ result.lifecycleStage }}</div>
      <div class="lifecycle-note">不受股價影響</div>
    </div>

    <!-- Metadata -->
    <div class="metadata">
      <span class="meta-item">
        <span class="meta-label">計算模式</span>
        <span class="meta-value">{{ formatCalculationMode(result.calculationMode) }}</span>
      </span>
      <span class="meta-item">
        <span class="meta-label">資料基準</span>
        <span class="meta-value">{{ formatDate(result.dataAsOf) }}</span>
      </span>
      <span class="meta-item">
        <span class="meta-label">計算時間</span>
        <span class="meta-value">{{ formatTime(result.timestamp) }}</span>
      </span>
    </div>

    <!-- Assumptions -->
    <div v-if="result.assumptions && result.assumptions.length" class="assumptions">
      <h4 class="assumptions-title">假設條件</h4>
      <ul class="assumptions-list">
        <li v-for="(a, i) in result.assumptions" :key="i">{{ a }}</li>
      </ul>
    </div>

    <!-- Warnings -->
    <div v-if="result.warnings && result.warnings.length" class="warnings">
      <div v-for="(w, i) in result.warnings" :key="i" class="warning-item">{{ w }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
});

function formatPrice(p) {
  return p != null ? Number(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

const scoreClass = computed(() => {
  const s = props.result?.strategyScore;
  if (s >= 70) return "score-high";
  if (s >= 50) return "score-mid";
  return "score-low";
});

const statusClass = computed(() => {
  const status = props.result?.strategyStatus;
  if (status?.includes("買") || status?.includes("加碼")) return "status-buy";
  if (status?.includes("賣") || status?.includes("減碼")) return "status-sell";
  return "status-wait";
});

const targetClass = computed(() => {
  const target = props.result?.strategyTarget || "";
  if (target.includes("加碼") || target.includes("買")) return "target-buy";
  if (target.includes("減碼") || target.includes("賣")) return "target-sell";
  return "target-wait";
});

function getTargetIcon(target) {
  if (target.includes("加碼") || target.includes("買")) return "📈";
  if (target.includes("減碼") || target.includes("賣")) return "📉";
  return "🔹";
}

const marginClass = computed(() => {
  const m = props.result?.maintenanceMargin;
  if (m >= 150) return "margin-safe";
  if (m >= 130) return "margin-warn";
  return "margin-danger";
});

function getMarginStatusText(m) {
  if (m >= 150) return "安全 ✅";
  if (m >= 130) return "警戒 ⚠️";
  return "危險 🔴";
}

const healthClass = computed(() => {
  const h = props.result?.portfolioHealth?.maintenanceRisk?.level;
  if (h === "Normal") return "health-green";
  if (h === "Protect") return "health-yellow";
  return "health-red";
});

function getHealthIcon(health) {
  const level = health?.maintenanceRisk?.level;
  if (level === "Normal") return "🟢";
  if (level === "Protect") return "🟡";
  return "🔴";
}

function getHealthStatusText(health) {
  const level = health?.maintenanceRisk?.level;
  if (level === "Normal") return "健康 🟢";
  if (level === "Protect") return "注意 🟡";
  return "風險 🔴";
}

function formatCalculationMode(mode) {
  const map = {
    forward: "正向模擬",
    reverse_analytical: "反向推導 (解析解)",
    reverse_scan: "反向推導 (掃描法)",
  };
  return map[mode] || mode;
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("zh-TW") : "—";
}

function formatTime(t) {
  return t ? new Date(t).toLocaleString("zh-TW") : "—";
}
</script>

<style scoped>
.result-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid #eee;
}

.price-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
}

.price-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.price-label {
  font-size: 12px;
  color: #888;
}

.price-value {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
}

.price-divider {
  color: #ccc;
  font-size: 18px;
}

.change-indicators {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 12px;
}

.change-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.change-label {
  font-size: 11px;
  color: #888;
}

.change-value {
  font-size: 16px;
  font-weight: 700;
}

.change-value.positive { color: #e53935; }
.change-value.negative { color: #2e7d32; }

.change-divider { color: #ccc; }

.strategy-result {
  margin-bottom: 16px;
}

.strategy-main {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.strategy-score {
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  background: #f5f5f5;
}

.strategy-score.score-high { background: #e8f5e9; }
.strategy-score.score-mid { background: #fff8e1; }
.strategy-score.score-low { background: #fbe9e7; }

.score-label {
  display: block;
  font-size: 11px;
  color: #888;
  margin-bottom: 4px;
}

.score-value {
  font-size: 28px;
  font-weight: 800;
  color: #1a1a1a;
}

.strategy-status {
  flex: 1;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
  background: #f5f5f5;
}

.strategy-status.status-buy { background: #e8f5e9; }
.strategy-status.status-sell { background: #fbe9e7; }
.strategy-status.status-wait { background: #fff8e1; }

.status-label {
  display: block;
  font-size: 11px;
  color: #888;
  margin-bottom: 4px;
}

.status-value {
  font-size: 16px;
  font-weight: 700;
}

.strategy-target {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.strategy-target.target-buy { background: #e8f5e9; color: #2e7d32; }
.strategy-target.target-sell { background: #fbe9e7; color: #c62828; }
.strategy-target.target-wait { background: #fff8e1; color: #f57f17; }

.target-icon { font-size: 18px; }

.strategy-suggestion {
  font-size: 13px;
  color: #555;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 8px;
  text-align: center;
}

.maintenance-card,
.health-card,
.lifecycle-card {
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  text-align: center;
}

.maintenance-card.margin-safe { background: #e8f5e9; }
.maintenance-card.margin-warn { background: #fff8e1; }
.maintenance-card.margin-danger { background: #fbe9e7; }

.health-card.health-green { background: #e8f5e9; }
.health-card.health-yellow { background: #fff8e1; }
.health-card.health-red { background: #fbe9e7; }

.lifecycle-card { background: #f5f5f5; }

.margin-header, .health-header, .lifecycle-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.readonly-badge {
  font-size: 9px;
  padding: 1px 6px;
  background: #eee;
  border-radius: 10px;
  color: #999;
  font-weight: 400;
}

.margin-value, .health-status, .lifecycle-value {
  font-size: 24px;
  font-weight: 800;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.margin-status, .health-status, .lifecycle-note {
  font-size: 12px;
  color: #666;
}

.metadata {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
  margin: 12px 0;
  font-size: 11px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.meta-label { color: #999; }
.meta-value { color: #333; font-weight: 500; }

.assumptions {
  margin-top: 12px;
}

.assumptions-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.assumptions-list {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: #666;
  line-height: 1.8;
}

.warnings {
  margin-top: 12px;
  padding: 12px;
  background: #fff3e0;
  border-radius: 10px;
  border-left: 4px solid #ff9800;
}

.warning-item {
  font-size: 12px;
  color: #e65100;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
</style>