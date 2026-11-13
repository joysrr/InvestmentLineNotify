<template>
  <div class="metric-item">
    <div class="label">{{ label }}</div>
    <div class="value" :title="titleText">{{ formattedValue }}</div>
    <div class="unit" v-if="unit">{{ unit }}</div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { fmtDecimal } from "../../utils/formatters.js";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: 0 },
  unit: { type: String, default: "" },
  format: { type: String, default: "number" }, // "number" | "compact" | "decimal"
});

const formattedValue = computed(() => {
  const num = Number(props.value);
  if (isNaN(num)) return "—";
  
  if (props.format === "compact" && num >= 10000) {
    return (num / 10000).toFixed(1) + " 萬";
  }
  if (props.format === "decimal" || (!Number.isInteger(num) && props.format !== "compact")) {
    return fmtDecimal(num, 2);
  }
  return num.toLocaleString();
});

const titleText = computed(() => {
  return props.value !== null && props.value !== undefined ? String(props.value) : undefined;
});
</script>

<style scoped>
.metric-item {
  background: var(--iln-bg);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}
.metric-item .label {
  font-size: 11px;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.metric-item .value {
  font-size: 16px;
  font-weight: 700;
  color: var(--iln-text);
  word-break: break-all;
}
.metric-item .unit {
  font-size: 10px;
  color: var(--iln-hint);
  margin-left: 2px;
}
</style>