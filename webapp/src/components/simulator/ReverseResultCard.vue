<template>
  <div class="reverse-result-card">
    <!-- Target Info -->
    <div class="target-summary">
      <div class="target-badge" :class="methodClass">
        <span class="method-icon">{{ getMethodIcon(result.method) }}</span>
        <span class="method-text">{{ formatMethod(result.method) }}</span>
      </div>
      <div class="target-type">{{ formatTargetType(result.target.type) }}</div>
    </div>

    <!-- Result Status -->
    <div class="result-status" :class="statusClass">
      <div class="status-icon">{{ result.reachable ? '✅' : '❌' }}</div>
      <div class="status-text">
        <span class="status-label">{{ result.reachable ? '可達成' : '不可達成' }}</span>
        <span class="status-reason" v-if="result.reason">{{ result.reason }}</span>
      </div>
    </div>

    <!-- Achievable Result -->
    <div v-if="result.reachable && result.results" class="achievable-result">
      <div class="result-price" v-if="result.results.price0050">
        <span class="result-label">推導 0050 價格</span>
        <span class="result-value">{{ formatPrice(result.results.price0050) }}</span>
      </div>
      <div class="result-price" v-if="result.results.priceZ2 && result.results.priceZ2 !== result.results.price0050">
        <span class="result-label">推導 00675L 價格</span>
        <span class="result-value">{{ formatPrice(result.results.priceZ2) }}</span>
      </div>
      <div class="result-achieved" v-if="result.results.achievedValue !== undefined">
        <span class="result-label">實際達成值</span>
        <span class="result-value">{{ formatAchievedValue(result.results.achievedValue, result.target.type) }}</span>
      </div>
      <div class="result-price" v-if="result.scanDetails?.iterations">
        <span class="result-label">迭代次數</span>
        <span class="result-value">{{ result.scanDetails.iterations }} 次</span>
      </div>
      <div class="result-price" v-if="result.scanDetails?.durationMs">
        <span class="result-label">耗時</span>
        <span class="result-value">{{ result.scanDetails.durationMs }} ms</span>
      </div>
      <div class="result-price" v-if="result.scanDetails?.matchedCount">
        <span class="result-label">匹配點數</span>
        <span class="result-value">{{ result.scanDetails.matchedCount }} / {{ result.scanDetails.iterations }}</span>
      </div>
    </div>

    <!-- Unreachable Details -->
    <div v-if="!result.reachable" class="unreachable-details">
      <div class="closest-result" v-if="result.closestResult">
        <h4 class="closest-title">最近可達結果</h4>
        <div class="closest-item" v-if="result.closestResult.price0050">
          <span class="closest-label">價格</span>
          <span class="closest-value">{{ formatPrice(result.closestResult.price0050) }}</span>
        </div>
        <div class="closest-item" v-if="result.closestResult.achievedValue !== undefined && result.closestResult.achievedValue !== null">
          <span class="closest-label">達成值</span>
          <span class="closest-value">{{ formatAchievedValue(result.closestResult.achievedValue, result.target.type) }}</span>
        </div>
        <div class="closest-item" v-if="result.closestResult.error !== undefined">
          <span class="closest-label">誤差</span>
          <span class="closest-value">{{ result.closestResult.error.toFixed(2) }}</span>
        </div>
      </div>
      <div class="suggested-range" v-if="result.suggestedRange">
        <span class="range-label">建議調整範圍</span>
        <span class="range-value">{{ formatRange(result.suggestedRange, result.target.type) }}</span>
      </div>
    </div>

    <!-- Scan Details -->
    <div v-if="result.scanDetails && result.method === 'scan'" class="scan-details">
      <h4 class="scan-title">掃描詳情</h4>
      <div class="scan-grid">
        <div class="scan-item">
          <span class="scan-label">價格區間</span>
          <span class="scan-value">{{ formatPrice(result.scanDetails.range[0]) }} ~ {{ formatPrice(result.scanDetails.range[1]) }}</span>
        </div>
        <div class="scan-item">
          <span class="scan-label">步距</span>
          <span class="scan-value">{{ (result.scanDetails.step * 100).toFixed(1) }}% (相對)</span>
        </div>
        <div class="scan-item">
          <span class="scan-label">掃描點數</span>
          <span class="scan-value">{{ result.scanDetails.iterations }}</span>
        </div>
        <div class="scan-item">
          <span class="scan-label">耗時</span>
          <span class="scan-value">{{ result.scanDetails.durationMs }} ms</span>
        </div>
      </div>
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

    <!-- Disclaimer -->
    <div class="disclaimer" v-if="result.disclaimer">
      {{ result.disclaimer }}
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

function formatAchievedValue(v, type) {
  if (v === null || v === undefined) return "—";
  const num = Number(v);
  if (["maintenanceRatio", "ma240Bias"].includes(type)) return `${num.toFixed(2)}%`;
  if (type === "rsi") return num.toFixed(1);
  if (type === "strategyScore") return num.toFixed(0);
  if (type === "portfolioHealth") return v;
  return num.toFixed(2);
}

function formatRange(range, type) {
  if (!range) return "—";
  if (range.min !== undefined && range.max !== undefined) {
    return `${range.min} ~ ${range.max}${["maintenanceRatio", "ma240Bias", "rsi"].includes(type) ? "%" : ""}`;
  }
  return "—";
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

const methodClass = computed(() => {
  if (props.result.method === "analytical") return "method-analytical";
  if (props.result.method === "scan") return "method-scan";
  if (props.result.method === "binary_search_converged") return "method-binary";
  return "";
});

const statusClass = computed(() => {
  return props.result.reachable ? "status-reachable" : "status-unreachable";
});

function getMethodIcon(method) {
  if (method === "analytical") return "📐";
  if (method === "scan") return "🔍";
  if (method.includes("binary")) return "📊";
  return "⚙️";
}

function formatMethod(method) {
  const map = {
    analytical: "解析解",
    scan: "掃描法",
    binary_search_converged: "二分搜尋 (收斂)",
    binary_search_approx: "二分搜尋 (近似)",
    not_implemented: "功能開發中",
  };
  return map[method] || method;
}

function formatTargetType(type) {
  const map = {
    maintenanceRatio: "維持率",
    rsi: "RSI",
    ma20: "MA20",
    ma60: "MA60",
    ma240Bias: "MA240 偏離",
    kdCross: "KD 交叉",
    macdCross: "MACD 交叉",
    strategyScore: "策略總分",
    portfolioHealth: "Portfolio Health",
  };
  return map[type] || type;
}
</script>

<style scoped>
.reverse-result-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid #eee;
}

.target-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.target-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.target-badge.method-analytical { background: #e3f2fd; color: #1565c0; }
.target-badge.method-scan { background: #fff3e0; color: #e65100; }
.target-badge.method-binary { background: #f3e5f5; color: #7b1fa2; }

.method-icon { font-size: 14px; }

.target-type {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}

.result-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 16px;
}

.result-status.status-reachable { background: #e8f5e9; }
.result-status.status-unreachable { background: #fbe9e7; }

.status-icon { font-size: 24px; }

.status-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 16px;
  font-weight: 700;
}

.status-reachable .status-label { color: #2e7d32; }
.status-unreachable .status-label { color: #c62828; }

.status-reason {
  font-size: 12px;
  color: #666;
}

.achievable-result {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
}

.result-price, .result-achieved {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.result-label {
  font-size: 11px;
  color: #888;
}

.result-value {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}

.unreachable-details {
  padding: 16px;
  background: #fff3e0;
  border-radius: 12px;
  margin-bottom: 16px;
}

.closest-title {
  font-size: 13px;
  font-weight: 600;
  color: #e65100;
  margin-bottom: 12px;
}

.closest-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #ffe0b2;
}

.closest-item:last-child { border-bottom: none; }

.closest-label { font-size: 12px; color: #888; }
.closest-value { font-size: 14px; font-weight: 600; color: #333; }

.suggested-range {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ffe0b2;
}

.range-label { font-size: 12px; color: #888; }
.range-value { font-size: 14px; font-weight: 600; color: #e65100; }

.scan-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.scan-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  margin-bottom: 12px;
}

.scan-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.scan-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scan-label {
  font-size: 11px;
  color: #999;
}

.scan-value {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.metadata {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
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

.disclaimer {
  margin-top: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 11px;
  color: #888;
  text-align: center;
}
</style>