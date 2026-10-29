<template>
  <div class="theory-card human-capital-summary">
    <div class="theory-card-header">
      <span class="theory-card-title">人力資本 (Human Capital)</span>
      <span
        class="theory-status-badge"
        :class="`status-${humanCapitalStatus?.toLowerCase()}`"
      >
        {{ humanCapitalStatus }}
      </span>
    </div>
    <div class="theory-card-content">
      <div v-if="humanCapitalStatus === 'OK'" class="value-display">
        <span class="value-label">估計人力資本</span>
        <span class="value">{{ formatCurrency(humanCapitalValue) }}</span>
      </div>
      <div v-else-if="humanCapitalStatus === 'UNAVAILABLE'" class="value-display unavailable">
        <span class="value-label">人力資本</span>
        <span class="value unavailable">{{ humanCapitalReason }}</span>
      </div>
      <div v-else class="value-display">
        <span class="value-label">人力資本</span>
        <span class="value">--</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  theory: { type: Object, required: true },
});

const humanCapitalData = computed(() => props.theory?.humanCapital);
const humanCapitalStatus = computed(() => humanCapitalData.value?.status ?? null);
const humanCapitalValue = computed(() => humanCapitalData.value?.humanCapital ?? null);
const humanCapitalReason = computed(() => humanCapitalData.value?.reason ?? "未知");

const formatCurrency = (value) => {
  if (value == null) return "--";
  return new Intl.NumberFormat("zh-TW").format(value);
};
</script>

<style scoped>
.theory-card {
  border: 1px solid var(--tg-theme-border-color, #ddd);
  border-radius: 8px;
  padding: 12px;
  background: var(--tg-theme-card-bg, #fff);
}
.theory-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.theory-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.theory-status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.status-ok {
  background: #e8f5e9;
  color: #2e7d32;
}
.status-unavailable {
  background: #ffebee;
  color: #c62828;
}
.status-estimated {
  background: #fff3e0;
  color: #ef6c00;
}
.theory-card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.value-display {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.value-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}
.value {
  font-size: 16px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.value.unavailable {
  color: #c62828;
}
</style>
