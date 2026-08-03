<template>
  <div class="simulated-indicators-table">
    <h3 class="table-title">模擬指標結果</h3>
    <table class="comp-table">
      <thead>
        <tr>
          <th>指標</th>
          <th class="text-right">模擬值</th>
          <th class="text-center">狀態</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in indicatorRows" :key="row.key">
          <td class="indicator-name">
            <span class="indicator-icon">{{ row.icon }}</span>
            <span class="indicator-label">{{ row.label }}</span>
          </td>
          <td class="text-right simulated-value">{{ formatValue(row.value, row.format) }}</td>
          <td class="text-center status-cell">
            <span :class="row.statusClass">{{ row.statusText }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from "vue";

defineProps({
  indicators: {
    type: Object,
    required: true,
  },
});

const indicatorRows = computed(() => {
  const ind = props.indicators;
  return [
    {
      key: "rsi",
      label: "RSI (14)",
      icon: "📊",
      value: ind.rsi,
      format: "number",
      statusClass: getRsiStatus(ind.rsi),
      statusText: getRsiStatusText(ind.rsi),
    },
    {
      key: "kd",
      label: "KD",
      icon: "📈",
      value: ind.kd,
      format: "kd",
      statusClass: getKdStatus(ind.kd),
      statusText: getKdStatusText(ind.kd),
    },
    {
      key: "macd",
      label: "MACD",
      icon: "📉",
      value: ind.macd,
      format: "macd",
      statusClass: getMacdStatus(ind.macd),
      statusText: getMacdStatusText(ind.macd),
    },
    {
      key: "ma20",
      label: "MA20",
      icon: "📈",
      value: ind.ma20,
      format: "price",
      statusClass: "",
      statusText: "—",
    },
    {
      key: "ma60",
      label: "MA60",
      icon: "📈",
      value: ind.ma60,
      format: "price",
      statusClass: "",
      statusText: "—",
    },
    {
      key: "ma240",
      label: "MA240",
      icon: "📈",
      value: ind.ma240,
      format: "price",
      statusClass: "",
      statusText: "—",
    },
    {
      key: "bias240",
      label: "MA240 偏離",
      icon: "📊",
      value: ind.bias240,
      format: "pct",
      statusClass: getBiasStatus(ind.bias240),
      statusText: getBiasStatusText(ind.bias240),
    },
    {
      key: "atr",
      label: "ATR (14)",
      icon: "📊",
      value: ind.atr,
      format: "number",
      statusClass: "",
      statusText: "—",
    },
    {
      key: "maintenanceMargin",
      label: "維持率",
      icon: "🛡️",
      value: ind.maintenanceMargin,
      format: "pct",
      statusClass: getMarginStatus(ind.maintenanceMargin),
      statusText: getMarginStatusText(ind.maintenanceMargin),
    },
  ];
});

function formatValue(val, format) {
  if (val === null || val === undefined) return "—";

  // 處理基本類型
  if (typeof val !== "object" || val === null) {
    switch (format) {
      case "number": return Number(val).toFixed(2);
      case "integer": return Math.round(Number(val));
      case "price": return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case "pct": return `${Number(val).toFixed(2)}%`;
      case "text": return String(val);
      default: return String(val);
    }
  }

  // 處理物件類型 (kd, macd)
  switch (format) {
    case "kd":
      if (!val) return "—";
      return `K:${Number(val.k).toFixed(1)} D:${Number(val.d).toFixed(1)}`;
    case "macd":
      if (!val) return "—";
      return `MACD:${Number(val.MACD).toFixed(3)} Sig:${Number(val.signal).toFixed(3)}`;
    default:
      return "—";
  }
}

function getRsiStatus(rsi) {
  if (rsi === null || rsi === undefined) return "";
  if (rsi >= 80) return "status-warn";
  if (rsi >= 70) return "status-warn";
  if (rsi <= 30) return "status-buy";
  if (rsi <= 40) return "status-buy";
  return "status-normal";
}

function getRsiStatusText(rsi) {
  if (rsi === null || rsi === undefined) return "—";
  if (rsi >= 80) return "極度超買";
  if (rsi >= 70) return "超買";
  if (rsi <= 30) return "極度超賣";
  if (rsi <= 40) return "超賣";
  return "正常";
}

function getKdStatus(kd) {
  if (!kd || typeof kd !== "object") return "";
  const k = kd.k;
  if (k >= 85) return "status-warn";
  if (k >= 70) return "status-warn";
  if (k <= 20) return "status-buy";
  if (k <= 30) return "status-buy";
  return "status-normal";
}

function getKdStatusText(kd) {
  if (!kd || typeof kd !== "object") return "—";
  const k = kd.k;
  if (k >= 85) return "極度過熱";
  if (k >= 70) return "過熱";
  if (k <= 20) return "極度超賣";
  if (k <= 30) return "超賣";
  return "正常";
}

function getMacdStatus(macd) {
  if (!macd || typeof macd !== "object") return "";
  const MACD = macd.MACD;
  const signal = macd.signal;
  if (typeof MACD === "number" && typeof signal === "number") {
    if (MACD > signal) return "status-buy";
    if (MACD < signal) return "status-sell";
  }
  return "status-normal";
}

function getMacdStatusText(macd) {
  if (!macd || typeof macd !== "object") return "—";
  const MACD = macd.MACD;
  const signal = macd.signal;
  if (typeof MACD === "number" && typeof signal === "number") {
    if (MACD > signal) return "多頭";
    if (MACD < signal) return "空頭";
  }
  return "中性";
}

function getBiasStatus(bias) {
  if (bias === null || bias === undefined) return "";
  if (bias >= 25) return "status-warn";
  if (bias >= 15) return "status-warn";
  if (bias < 0) return "status-buy";
  return "status-normal";
}

function getBiasStatusText(bias) {
  if (bias === null || bias === undefined) return "—";
  if (bias >= 25) return "極高位";
  if (bias >= 15) return "高位偏貴";
  if (bias < 0) return "低位便宜";
  return "中位正常";
}

function getMarginStatus(margin) {
  if (margin === null || margin === undefined) return "";
  if (margin >= 150) return "status-ok";
  if (margin >= 130) return "status-warn";
  return "status-danger";
}

function getMarginStatusText(margin) {
  if (margin === null || margin === undefined) return "—";
  if (margin >= 150) return "健康 ✅";
  if (margin >= 130) return "警戒 ⚠️";
  return "危險 🔴";
}
</script>

<style scoped>
.simulated-indicators-table {
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

.simulated-value { color: #2481cc; font-weight: 600; }

.status-cell {
  font-weight: 600;
  font-size: 11px;
}

.status-ok { color: #2e7d32; }
.status-warn { color: #e53935; }
.status-danger { color: #c62828; }
.status-buy { color: #2e7d32; }
.status-sell { color: #c62828; }
.status-normal { color: #666; }
</style>