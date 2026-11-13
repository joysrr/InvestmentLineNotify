<template>
  <ContentCard
    variant="outlined"
    padding="md"
    radius="md"
    :class="cardClass"
  >
    <div class="metric-icon" v-if="icon">{{ icon }}</div>
    <div class="metric-body">
      <div class="metric-title">{{ title }}</div>
      <div class="metric-value" :class="trendClass">{{ value }}</div>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";

const props = defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], default: "—" },
  trend: { type: String, default: "" }, // 'up' | 'down' | ''
  icon: { type: String, default: "" },
});

const cardClass = computed(() => {
  const classes = [];
  if (props.trend === "up") classes.push("metric-card--up");
  if (props.trend === "down") classes.push("metric-card--down");
  return classes.join(" ");
});

const trendClass = computed(() => {
  if (props.trend === "up") return "text-up";
  if (props.trend === "down") return "text-down";
  return "";
});
</script>

<style scoped>
.metric-card--up {
  border-left: 4px solid var(--iln-ok-text);
}
.metric-card--down {
  border-left: 4px solid var(--iln-danger-text);
}
.metric-icon {
  font-size: var(--iln-font-lg);
  flex-shrink: 0;
}
.metric-body {
  flex: 1;
  min-width: 0;
}
.metric-title {
  font-size: var(--iln-font-xs);
  font-weight: 600;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.metric-value {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.metric-value.text-up {
  color: var(--iln-ok-text);
}
.metric-value.text-down {
  color: var(--iln-danger-text);
}
</style>