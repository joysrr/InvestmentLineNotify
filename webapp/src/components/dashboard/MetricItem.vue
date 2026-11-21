<template>
  <div class="metric-item">
    <div class="label">{{ label }}</div>
    <div class="value tabular" :title="titleText">{{ formattedValue }}</div>
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
  format: { type: String, default: "number" },
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
.tabular {
  font-variant-numeric: tabular-nums;
}

.metric-item {
  background: var(--iln-bg);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
  text-align: center;
}

.metric-item .label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--iln-space-1);
}

.metric-item .value {
  font-size: var(--iln-font-md);
  font-weight: 700;
  color: var(--iln-text);
  word-break: break-all;
}

.metric-item .unit {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-left: 2px;
}
</style>
