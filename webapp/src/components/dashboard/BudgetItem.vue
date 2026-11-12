<template>
  <div class="budget-item">
    <div class="label">{{ label }}</div>
    <div class="value">{{ formattedValue }}</div>
    <div class="unit" v-if="unit">{{ unit }}</div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: 0 },
  unit: { type: String, default: "" },
});

const formattedValue = computed(() => {
  const num = Number(props.value);
  if (isNaN(num)) return "—";
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + " 萬";
  }
  return num.toLocaleString();
});
</script>

<style scoped>
.budget-item {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}
.budget-item .label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.budget-item .value {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
  word-break: break-all;
}
.budget-item .unit {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-left: 2px;
}
</style>