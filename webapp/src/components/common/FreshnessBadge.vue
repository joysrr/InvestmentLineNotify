<template>
  <span
    class="freshness-badge"
    :class="`freshness-badge--${level}`"
    :title="absoluteTime"
  >
    <Icon name="clock" />
    <span class="freshness-badge__label">{{ label }}</span>
    <span class="freshness-badge__relative tabular">{{ relative }}</span>
  </span>
</template>

<script setup>
import { computed, watch } from "vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  timestamp: {
    type: [String, Number, Date],
    required: true,
  },
  label: {
    type: String,
    default: "更新",
  },
  thresholds: {
    type: Object,
    default: () => ({
      fresh: 3600,
      stale: 21600,
      expired: 86400,
    }),
  },
});

const emit = defineEmits(["level-change"]);

const level = computed(() => {
  const age = (Date.now() - new Date(props.timestamp).getTime()) / 1000;
  if (age < props.thresholds.fresh) return "fresh";
  if (age < props.thresholds.stale) return "stale";
  if (age < props.thresholds.expired) return "expired";
  return "expired";
});

watch(level, (newLevel) => emit("level-change", newLevel), { immediate: true });

const absoluteTime = computed(() => new Date(props.timestamp).toISOString());

const relative = computed(() => {
  const ageSec = (Date.now() - new Date(props.timestamp).getTime()) / 1000;
  if (ageSec < 60) return "剛剛";
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)} 分鐘前`;
  if (ageSec < 86400) return `${Math.floor(ageSec / 3600)} 小時前`;
  return `${Math.floor(ageSec / 86400)} 天前`;
});
</script>

<style scoped>
.freshness-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-1) var(--iln-space-2);
  border-radius: var(--iln-radius-full);
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-semibold);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.freshness-badge--fresh {
  background: var(--iln-viz-bull-bg);
  color: var(--iln-viz-bull-text);
  border: 1px solid var(--iln-viz-bull-border);
}

.freshness-badge--stale {
  background: var(--iln-viz-alert-bg);
  color: var(--iln-viz-alert-text);
  border: 1px solid var(--iln-viz-alert-border);
}

.freshness-badge--expired {
  background: var(--iln-viz-bear-bg);
  color: var(--iln-viz-bear-text);
  border: 1px solid var(--iln-viz-bear-border);
}

.freshness-badge__icon,
.freshness-badge :deep(svg) {
  width: 12px;
  height: 12px;
  color: currentColor;
}

.freshness-badge__label {
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-semibold);
  color: inherit;
}

.freshness-badge__relative {
  font-size: var(--iln-font-xs);
  color: inherit;
  opacity: 0.9;
}
</style>
