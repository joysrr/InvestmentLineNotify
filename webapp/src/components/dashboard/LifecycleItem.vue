<template>
  <div class="lifecycle-item">
    <div class="icon" v-if="icon">{{ icon }}</div>
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }} <span class="unit" v-if="unit">{{ unit }}</span></div>
  </div>
</template>

<script setup>
const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: "—" },
  unit: { type: String, default: "" },
  icon: { type: String, default: "" },
});
</script>

<style scoped>
.lifecycle-item {
  background: var(--iln-bg);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.lifecycle-item .icon {
  font-size: 20px;
  margin-bottom: 4px;
}
.lifecycle-item .label {
  font-size: 11px;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.lifecycle-item .value {
  font-size: 16px;
  font-weight: 700;
  color: var(--iln-text);
}
.lifecycle-item .unit {
  font-size: 10px;
  color: var(--iln-hint);
  margin-left: 2px;
}
</style>