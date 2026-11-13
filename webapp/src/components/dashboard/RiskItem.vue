<template>
  <ContentCard
    variant="outlined"
    padding="sm"
    radius="sm"
    :class="itemClass"
    data-testid="risk-item"
  >
    <div class="risk-inner">
      <div class="icon" v-if="icon">{{ icon }}</div>
      <div class="label">{{ label }}</div>
      <div class="value" :title="titleText">{{ formattedValue }}</div>
      <div class="unit" v-if="unit">{{ unit }}</div>
      <div class="desc" v-if="desc">{{ desc }}</div>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import { fmtDecimal } from "../../utils/formatters.js";
import ContentCard from "@/components/common/ContentCard.vue";

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
.risk-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.icon {
  font-size: var(--iln-font-lg);
  margin-bottom: 4px;
}
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
}
.unit {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-left: 2px;
}
.desc {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: 2px;
}
</style>