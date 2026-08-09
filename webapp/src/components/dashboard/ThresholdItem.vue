<template>
  <div class="threshold-item">
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }} <span class="unit" v-if="unit">{{ unit }}</span></div>
  </div>
</template>

<script setup>
const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: "—" },
  unit: { type: String, default: "" },
});
</script>

<style scoped>
.threshold-item {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}
.threshold-item .label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.threshold-item .value {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}
.threshold-item .unit {
  font-size: 10px;
  color: #aaa;
  margin-left: 2px;
}
</style>