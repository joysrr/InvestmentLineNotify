<template>
  <div class="allocation-tier" :class="{ 'is-current': isCurrent, 'is-next': isNext }">
    <div class="tier-score">{{ tier.minScore }}pt+</div>
    <div class="tier-bar">
      <div class="tier-fill" :class="{ current: isCurrent, next: isNext }" :style="{ width: tierFillWidth }"></div>
    </div>
    <div class="tier-info">
      <div class="tier-leverage">{{ tier.leverage }}x</div>
      <div class="tier-cash">現金 {{ (tier.cash * 100).toFixed(0) }}%</div>
      <div class="tier-comment">{{ tier.comment }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  tier: {
    type: Object,
    required: true,
  },
  isCurrent: { type: Boolean, default: false },
  isNext: { type: Boolean, default: false },
});

const tierFillWidth = computed(() => {
  return Math.min(100, (props.tier.leverage || 0) * 50) + "%";
});
</script>

<style scoped>
.allocation-tier {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.3s;
}
.allocation-tier.is-current {
  background: #e3f2fd;
  border-color: #2196f3;
}
.allocation-tier.is-next {
  background: #fff3e0;
  border-color: #ff9800;
}
.tier-score {
  font-size: 12px;
  color: #888;
  min-width: 60px;
  text-align: right;
}
.tier-bar {
  flex: 1;
  height: 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
  overflow: hidden;
}
.tier-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.tier-fill.current { background: #2196f3; }
.tier-fill.next { background: #ff9800; }
.tier-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 80px;
}
.tier-leverage { font-weight: 600; font-size: 14px; }
.tier-cash { font-size: 11px; color: #888; }
.tier-comment { font-size: 10px; color: #aaa; margin-top: 2px; }
</style>