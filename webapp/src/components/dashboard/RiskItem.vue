<template>
  <div class="risk-item" :class="itemClass">
    <div class="icon" v-if="icon">{{ icon }}</div>
    <div class="label">{{ label }}</div>
    <div class="value" :title="titleText">{{ formattedValue }}</div>
    <div class="unit" v-if="unit">{{ unit }}</div>
    <div class="desc" v-if="desc">{{ desc }}</div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { fmtDecimal } from "../../utils/formatters.js";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: "—" },
  unit: { type: String, default: "" },
  desc: { type: String, default: "" },
  icon: { type: String, default: "" },
  itemClass: { type: String, default: "" },
});

const formattedValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === "") {
    return "—";
  }
  const num = Number(props.value);
  if (!isNaN(num) && !Number.isInteger(num)) {
    return fmtDecimal(num, 2);
  }
  return String(props.value);
});

const titleText = computed(() => {
  return props.value !== null && props.value !== undefined ? String(props.value) : undefined;
});

const itemClass = computed(() => {
  return `risk-item ${props.itemClass}`;
});
</script>

<style scoped>
.risk-item {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.risk-item .icon {
  font-size: 20px;
  margin-bottom: 4px;
}
.risk-item .label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.risk-item .value {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}
.risk-item .unit {
  font-size: 10px;
  color: #aaa;
  margin-left: 2px;
}
.risk-item .desc {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #777);
  margin-top: 2px;
}
</style>