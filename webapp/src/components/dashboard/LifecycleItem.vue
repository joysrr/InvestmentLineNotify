<template>
  <ContentCard variant="outlined" padding="sm" radius="sm">
    <div class="icon" v-if="icon">{{ icon }}</div>
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }} <span class="unit" v-if="unit">{{ unit }}</span></div>
  </ContentCard>
</template>

<script setup>
import ContentCard from "@/components/common/ContentCard.vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: "—" },
  unit: { type: String, default: "" },
  icon: { type: String, default: "" },
});
</script>

<style scoped>
.lifecycle-item {
  /* 佈局由 ContentCard 提供 */
}
.icon {
  font-size: var(--iln-font-base);
  margin-right: 8px;
}
.label {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}
.value {
  font-size: var(--iln-font-xl);
  font-weight: 700;
  color: var(--iln-text);
}
.unit {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin-left: 4px;
}
</style>