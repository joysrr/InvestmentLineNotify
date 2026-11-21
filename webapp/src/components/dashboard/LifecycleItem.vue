<template>
  <ContentCard variant="outlined" size="sm">
    <div class="icon" v-if="icon"><Icon :name="icon" size="sm" /></div>
    <div class="label">{{ label }}</div>
    <div class="value tabular">
      <span>{{ value }}</span>
      <span class="unit" v-if="unit">{{ unit }}</span>
    </div>
  </ContentCard>
</template>

<script setup>
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: "—" },
  unit: { type: String, default: "" },
  icon: { type: String, default: "" },
});
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.icon {
  display: inline-flex;
  align-items: center;
  margin-right: var(--iln-space-2);
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
  margin-left: var(--iln-space-1);
}
</style>
