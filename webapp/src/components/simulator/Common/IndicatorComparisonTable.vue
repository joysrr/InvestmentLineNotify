<template>
  <div class="comparison-table">
    <h3 class="table-title">指標比較：實際 vs 模擬</h3>
    <table class="comp-table">
      <thead>
        <tr>
          <th>指標</th>
          <th class="text-right">實際值</th>
          <th class="text-right">模擬值</th>
          <th class="text-center">變化</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in comparisonRows" :key="row.key">
          <td class="indicator-name">
            <span class="indicator-icon">{{ row.icon }}</span>
            <span class="indicator-label">{{ row.label }}</span>
          </td>
          <td class="text-right current-value">{{ formatValue(row.current, row.format) }}</td>
          <td class="text-right simulated-value">{{ formatValue(row.simulated, row.format) }}</td>
          <td class="text-center change-cell">
            <span v-if="row.change !== null && row.change !== undefined" :class="changeClass(row.change)">
              {{ row.change >= 0 ? '+' : '' }}{{ formatChange(row.change, row.format) }}
            </span>
            <span v-else class="no-change">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  current: {
    type: Object,
    required: true,
  },
  simulated: {
    type: Object,
    required: true,
  },
});

const comparisonRows = computed(() => [
  {
    key: "rsi",
    label: "RSI (14)",
    icon: "📊",
    current: props.current.rsi,
    simulated: props.simulated.rsi,
    format: "number",
    change: props.simulated.rsi && props.current.rsi ? props.simulated.rsi - props.current.rsi : null,
  },
  {
    key: "kd",
    label: "KD",
    icon: "📈",
    current: { k: props.current.kd?.k, d: props.current.kd?.d },
    simulated: { k: props.simulated.kd?.k, d: props.simulated.kd?.d },
    format: "kd",
    change: null,
  },
  {
    key: "macd",
    label: "MACD",
    icon: "📉",
    current: { MACD: props.current.macd?.MACD, signal: props.current.macd?.signal },
    simulated: { MACD: props.simulated.macd?.MACD, signal: props.simulated.macd?.signal },
    format: "macd",
    change: null,
  },
  {
    key: "ma20",
    label: "MA20",
    icon: "📈",
    current: props.current.ma20,
    simulated: props.simulated.ma20,
    format: "price",
    change: props.simulated.ma20 && props.current.ma20 ? props.simulated.ma20 - props.current.ma20 : null,
  },
  {
    key: "ma60",
    label: "MA60",
    icon: "📈",
    current: props.current.ma60,
    simulated: props.simulated.ma60,
    format: "price",
    change: props.simulated.ma60 && props.current.ma60 ? props.simulated.ma60 - props.current.ma60 : null,
  },
  {
    key: "ma240",
    label: "MA240",
    icon: "📈",
    current: props.current.ma240,
    simulated: props.simulated.ma240,
    format: "price",
    change: props.simulated.ma240 && props.current.ma240 ? props.simulated.ma240 - props.current.ma240 : null,
  },
  {
    key: "bias240",
    label: "MA240 偏離",
    icon: "📊",
    current: props.current.bias240,
    simulated: props.simulated.bias240,
    format: "pct",
    change: props.simulated.bias240 && props.current.bias240 ? props.simulated.bias240 - props.current.bias240 : null,
  },
  {
    key: "atr",
    label: "ATR (14)",
    icon: "📊",
    current: props.current.atr,
    simulated: props.simulated.atr,
    format: "number",
    change: props.simulated.atr && props.current.atr ? props.simulated.atr - props.current.atr : null,
  },
  {
      key: "maintenanceMargin",
      label: "維持率",
      icon: "🛡️",
      current: props.current.maintenanceMargin,
      simulated: props.simulated.maintenanceMargin,
      format: "pct",
      change: props.simulated.maintenanceMargin && props.current.maintenanceMargin ? props.simulated.maintenanceMargin - props.current.maintenanceMargin : null,
    },
    {
      key: "strategyScore",
      label: "策略分數",
      icon: "🎯",
      current: props.current.strategyScore,
      simulated: props.simulated.strategyScore,
      format: "integer",
      change: props.simulated.strategyScore && props.current.strategyScore ? props.simulated.strategyScore - props.current.strategyScore : null,
    },
    {
      key: "portfolioHealth",
      label: "Portfolio Health",
      icon: "📊",
      current: props.current.portfolioHealth?.level || "—",
      simulated: props.simulated.portfolioHealth?.level || "—",
      format: "text",
      change: null,
    },
    {
      key: "lifecycleStage",
      label: "生命週期",
      icon: "📅",
      current: props.current.lifecycleStage,
      simulated: props.simulated.lifecycleStage,
      format: "text",
      change: null,
    },
]);

function formatValue(val, format) {
  if (val === null || val === undefined) return "—";
  
  switch (format) {
    case "number":
      return typeof val === "object" ? "—" : Number(val).toFixed(2);
    case "integer":
      return typeof val === "object" ? "—" : Math.round(Number(val));
    case "price":
      return typeof val === "object" ? "—" : Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "pct":
      return typeof val === "object" ? "—" : `${Number(val).toFixed(2)}%`;
    case "kd":
      if (!val || typeof val !== "object") return "—";
      return `K:${Number(val.k).toFixed(1)} D:${Number(val.d).toFixed(1)}`;
    case "macd":
      if (!val || typeof val !== "object") return "—";
      return `MACD:${Number(val.MACD).toFixed(3)} Sig:${Number(val.signal).toFixed(3)}`;
    case "text":
      return val || "—";
    default:
      return val;
  }
}

function formatChange(change, format) {
  if (change === null || change === undefined) return "—";
  const prefix = change >= 0 ? "+" : "";
  
  switch (format) {
    case "pct":
      return `${prefix}${change.toFixed(2)}%`;
    case "price":
      return `${prefix}${change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "number":
      return `${prefix}${change.toFixed(2)}`;
    case "integer":
      return `${prefix}${Math.round(change)}`;
    default:
      return `${prefix}${change}`;
  }
}

const changeClass = (change) => {
  if (change === null || change === undefined) return "";
  return change >= 0 ? "positive" : "negative";
};
</script>

<style scoped>
.comparison-table {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid #eee;
}

.table-title {
  font-size: 15px;
  font-weight: 700;
  color: #333;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.comp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.comp-table th,
.comp-table td {
  padding: 10px 12px;
  text-align: left;
}

.comp-table th {
  font-weight: 600;
  color: #888;
  border-bottom: 1px solid #eee;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.comp-table td {
  border-bottom: 1px solid #f5f5f5;
}

.comp-table tbody tr:last-child td {
  border-bottom: none;
}

.comp-table tbody tr:hover td {
  background: #fafafa;
}

.text-right { text-align: right; }
.text-center { text-align: center; }

.indicator-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #333;
}

.indicator-icon { font-size: 14px; }

.current-value { color: #666; }
.simulated-value { color: #2481cc; font-weight: 600; }

.change-cell {
  font-weight: 600;
  font-size: 12px;
}

.change-cell .positive { color: #e53935; }
.change-cell .negative { color: #2e7d32; }
.change-cell .no-change { color: #ccc; }
</style>