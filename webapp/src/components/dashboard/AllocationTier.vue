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
  background: var(--iln-surface);
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.3s;
}
.allocation-tier.is-current {
  background: var(--iln-info-bg);
  border-color: var(--iln-link);
}
.allocation-tier.is-next {
  background: var(--iln-warn-bg);
  border-color: var(--iln-warn-text);
}
.tier-score {
  font-size: 12px;
  color: var(--iln-hint);
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
/* tier-fill: 業務語義色（current=信號色，next=警告色），與 tier 標籤綁定 */
.tier-fill.current { background: var(--iln-tier-current); }
.tier-fill.next { background: var(--iln-tier-next); }
.tier-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 80px;
}
.tier-leverage { font-weight: 600; font-size: 14px; }
.tier-cash { font-size: 11px; color: var(--iln-hint); }
.tier-comment { font-size: 10px; color: var(--iln-hint); margin-top: 2px; }
</style>