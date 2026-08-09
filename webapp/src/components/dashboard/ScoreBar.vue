<template>
  <div class="score-bar">
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
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: Number, default: 0 },
  max: { type: Number, default: 5 },
  color: { type: String, default: "#2196f3" },
  description: { type: String, default: "" },
});

const percentage = computed(() => Math.min(100, (props.value / props.max) * 100));
</script>

<style scoped>
.score-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.score-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.score-label {
  font-weight: 500;
  color: var(--tg-theme-text-color, #222);
}
.score-value {
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
}
.score-bar-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease-out;
}
.score-description {
  font-size: 10px;
  color: #aaa;
  margin-top: 2px;
}
</style>