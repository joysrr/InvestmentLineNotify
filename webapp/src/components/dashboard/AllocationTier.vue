<template>
  <ContentCard
    variant="outlined"
    padding="md"
    radius="md"
    :status="status"
    status-style="tint"
    data-testid="allocation-tier"
  >
    <template #header>
      <div class="tier-score">{{ tier.minScore }}pt+</div>
    </template>

    <div class="tier-body">
      <div class="tier-bar">
        <div
          class="tier-fill"
          :class="{ current: isCurrent, next: isNext }"
          :style="{ width: tierFillWidth }"
        ></div>
      </div>
      <div class="tier-info">
        <div class="tier-leverage">{{ tier.leverage }}x</div>
        <div class="tier-cash">現金 {{ (tier.cash * 100).toFixed(0) }}%</div>
        <div class="tier-comment">{{ tier.comment }}</div>
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";

const props = defineProps({
  tier: {
    type: Object,
    required: true,
  },
  isCurrent: { type: Boolean, default: false },
  isNext: { type: Boolean, default: false },
});

const status = computed(() => {
  if (props.isCurrent) return "info";
  if (props.isNext) return "warn";
  return null;
});

const tierFillWidth = computed(() => {
  return Math.min(100, (props.tier.leverage || 0) * 50) + "%";
});
</script>

<style scoped>
.tier-body {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.tier-score {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  flex-shrink: 0;
}

.tier-bar {
  flex: 1;
  height: 6px;
  background: var(--iln-border-subtle);
  border-radius: 3px;
  overflow: hidden;
}

.tier-fill {
  height: 100%;
  border-radius: 3px;
  transition: all 0.3s;
}

.tier-fill.current {
  background: var(--iln-info);
}

.tier-fill.next {
  background: var(--iln-warn);
}

.tier-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  flex-shrink: 0;
}

.tier-leverage {
  font-size: var(--iln-font-base);
  font-weight: 600;
  color: var(--iln-text);
}

.tier-cash {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.tier-comment {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
</style>
