<template>
  <ContentCard
    variant="outlined"
    padding="sm"
    radius="md"
    data-testid="threshold-item"
  >
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
});
</script>

<style scoped>
.label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.value {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
  word-break: break-all;
}
.unit {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-left: 2px;
}
</style>