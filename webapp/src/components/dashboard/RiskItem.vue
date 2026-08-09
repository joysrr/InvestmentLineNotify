<template>
  <div class="risk-item" :class="itemClass">
    <div class="icon">{{ icon }}</div>
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }} <span class="unit" v-if="unit">{{ unit }}</span></div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: "—" },
  unit: { type: String, default: "" },
  icon: { type: String, default: "" },
  itemClass: { type: String, default: "" },
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
</style>