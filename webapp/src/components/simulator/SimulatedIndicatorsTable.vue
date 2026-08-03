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
  // 解開 Vue Proxy/Ref
  const unwrap = (v) => {
    if (v === null || v === undefined) return v;
    // 如果是 Proxy 物件，嘗試取得原始值
    if (typeof v === "object" && v !== null) {
      // 檢查是否為 Ref (有 .value)
      if ("value" in v) return unwrap(v.value);
      // 檢查是否為 Reactive Proxy，直接返回原值
      return v;
    }
    return v;
  };
  
  const rawVal = unwrap(val);
  if (rawVal === null || rawVal === undefined) return "—";
  
  switch (format) {
    case "number":
      return typeof rawVal === "object" ? "—" : Number(rawVal).toFixed(2);
    case "integer":
      return typeof rawVal === "object" ? "—" : Math.round(Number(rawVal));
    case "price":
      return typeof rawVal === "object" ? "—" : Number(rawVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "pct":
      return typeof rawVal === "object" ? "—" : `${Number(rawVal).toFixed(2)}%`;
    case "kd":
      if (!rawVal || typeof rawVal !== "object") return "—";
      return `K:${Number(rawVal.k).toFixed(1)} D:${Number(rawVal.d).toFixed(1)}`;
    case "macd":
      if (!rawVal || typeof rawVal !== "object") return "—";
      return `MACD:${Number(rawVal.MACD).toFixed(3)} Sig:${Number(rawVal.signal).toFixed(3)}`;
    case "text":
      return rawVal || "—";
    default:
      return rawVal;
  }
}

function getRsiStatus(rsi) {
  if (rsi === null || rsi === undefined) return "";
  const val = (typeof rsi === "object" && "value" in rsi) ? rsi.value : rsi;
  if (val >= 80) return "status-warn";
  if (val >= 70) return "status-warn";
  if (val <= 30) return "status-buy";
  if (val <= 40) return "status-buy";
  return "status-normal";
}

function getRsiStatusText(rsi) {
  if (rsi === null || rsi === undefined) return "—";
  const val = (typeof rsi === "object" && "value" in rsi) ? rsi.value : rsi;
  if (val >= 80) return "極度超買";
  if (val >= 70) return "超買";
  if (val <= 30) return "極度超賣";
  if (val <= 40) return "超賣";
  return "正常";
}

function getKdStatus(kd) {
  if (!kd || typeof kd !== "object") return "";
  const k = (typeof kd.k === "object" && "value" in kd.k) ? kd.k.value : kd.k;
  if (k >= 85) return "status-warn";
  if (k >= 70) return "status-warn";
  if (k <= 20) return "status-buy";
  if (k <= 30) return "status-buy";
  return "status-normal";
}

function getKdStatusText(kd) {
  if (!kd || typeof kd !== "object") return "—";
  const k = (typeof kd.k === "object" && "value" in kd.k) ? kd.k.value : kd.k;
  if (k >= 85) return "極度過熱";
  if (k >= 70) return "過熱";
  if (k <= 20) return "極度超賣";
  if (k <= 30) return "超賣";
  return "正常";
}

function getMacdStatus(macd) {
  if (!macd || typeof macd !== "object") return "";
  const MACD = (typeof macd.MACD === "object" && "value" in macd.MACD) ? macd.MACD.value : macd.MACD;
  const signal = (typeof macd.signal === "object" && "value" in macd.signal) ? macd.signal.value : macd.signal;
  if (typeof MACD === "number" && typeof signal === "number") {
    if (MACD > signal) return "status-buy";
    if (MACD < signal) return "status-sell";
  }
  return "status-normal";
}

function getMacdStatusText(macd) {
  if (!macd || typeof macd !== "object") return "—";
  const MACD = (typeof macd.MACD === "object" && "value" in macd.MACD) ? macd.MACD.value : macd.MACD;
  const signal = (typeof macd.signal === "object" && "value" in macd.signal) ? macd.signal.value : macd.signal;
  if (typeof MACD === "number" && typeof signal === "number") {
    if (MACD > signal) return "多頭";
    if (MACD < signal) return "空頭";
  }
  return "中性";
}

function getBiasStatus(bias) {
  if (bias === null || bias === undefined) return "";
  const val = (typeof bias === "object" && "value" in bias) ? bias.value : bias;
  if (val >= 25) return "status-warn";
  if (val >= 15) return "status-warn";
  if (val < 0) return "status-buy";
  return "status-normal";
}

function getBiasStatusText(bias) {
  if (bias === null || bias === undefined) return "—";
  const val = (typeof bias === "object" && "value" in bias) ? bias.value : bias;
  if (val >= 25) return "極高位";
  if (val >= 15) return "高位偏貴";
  if (val < 0) return "低位便宜";
  return "中位正常";
}

function getMarginStatus(margin) {
  if (margin === null || margin === undefined) return "";
  const val = (typeof margin === "object" && "value" in margin) ? margin.value : margin;
  if (val >= 150) return "status-ok";
  if (val >= 130) return "status-warn";
  return "status-danger";
}

function getMarginStatusText(margin) {
  if (margin === null || margin === undefined) return "—";
  const val = (typeof margin === "object" && "value" in margin) ? margin.value : margin;
  if (val >= 150) return "健康 ✅";
  if (val >= 130) return "警戒 ⚠️";
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