<template>
  <ContentCard
    variant="outlined"
    padding="sm"
    radius="sm"
    data-testid="score-bar"
  >
    <div class="score-header">
      <span class="score-label">{{ label }}</span>
      <span class="score-value">{{ value }} / {{ max }}pt</span>
    </div>
    <div class="score-bar-track">
      <div
        class="score-bar-fill"
        :style="{ width: percentage + '%', backgroundColor: color }"
      ></div>
    </div>
    <div class="score-description" v-if="description">{{ description }}</div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  max: { type: Number, default: 5 },
  color: { type: String, default: "var(--iln-brand)" },
  description: { type: String, default: "" },
});

const percentage = computed(() => Math.min(100, (props.value / props.max) * 100));
</script>

<style scoped>
.score-header {
  display: flex;
  justify-content: space-between;
  font-size: var(--iln-font-sm);
}
.score-label {
  font-weight: 500;
  color: var(--iln-text);
}
.score-value {
  font-weight: 600;
  color: var(--iln-hint);
}
.score-bar-track {
  height: 8px;
  background: var(--iln-border-subtle);
  border-radius: var(--iln-radius-sm);
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  border-radius: var(--iln-radius-sm);
  transition: width 0.5s ease-out;
}
.score-description {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: 2px;
}
</style>