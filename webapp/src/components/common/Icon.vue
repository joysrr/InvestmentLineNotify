<template>
  <svg
    v-if="iconData"
    :class="`icon-${name}`"
    :width="resolvedSize"
    :height="resolvedSize"
    :fill="color"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <component :is="iconData.component" />
  </svg>
  <svg
    v-else
    class="icon-default"
    :width="resolvedSize"
    :height="resolvedSize"
    :fill="color"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
  </svg>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  name: {
    type: String,
    default: "",
  },
  size: {
    type: [String, Number],
    default: "20",
  },
  color: {
    type: String,
    default: "currentColor",
  },
});

const SIZE_MAP = {
  sm: "16",
  md: "20",
  lg: "24",
  xl: "32",
};

const resolvedSize = computed(() => {
  if (typeof props.size === "number") return String(props.size);
  return SIZE_MAP[props.size] ?? String(props.size);
});

const DANGER_PATH = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z';
const WARN_PATH = 'M1 21h22L12 2 1 21zm12-9h-2v-2h2v2zm0-4h-2V7h2v6z';
const NEUTRAL_PATH = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z';
const CHART_PATH = 'M3 3v18h18V3H3zm2 16V5h4l4 4 6-6h4v14H5z';
const SHIELD_PATH = 'M12 2L2 7l10 13 10-13zM12 7.5c-1.98 0-3.7 1.2-4.5 2.9L9 15l3 4 3-4-1.5-4.6C15.7 8.7 13.98 7.5 12 7.5z';
const TRIGGER_PATH = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z';
const CHECK_PATH = 'M9 16.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4z';
const RADAR_PATH = 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 10s4.477 10 10 10zM12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM2 12h20M12 2v20';
const X_CIRCLE_PATH = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 9.17L13 16.17l-4.17-4.17L8.83 11l4.17-4.17L13 7.83l4.17 4.17z';
const CHEVRON_DOWN_PATH = 'M6 9l6 6 6-6';

const ICON_MAP = {
  "check-circle": { component: { template: `<path d="${CHECK_PATH}" fill="currentColor"/>` } },
  ok: { component: { template: `<path d="${CHECK_PATH}" fill="currentColor"/>` } },
  danger: { component: { template: `<path d="${DANGER_PATH}" fill="currentColor"/>` } },
  warn: { component: { template: `<path d="${WARN_PATH}" fill="currentColor"/>` } },
  "alert-triangle": { component: { template: `<path d="${WARN_PATH}" fill="currentColor"/>` } },
  neutral: { component: { template: `<path d="${NEUTRAL_PATH}" fill="currentColor"/>` } },
  chart: { component: { template: `<path d="${CHART_PATH}" fill="currentColor"/>` } },
  shield: { component: { template: `<path d="${SHIELD_PATH}" fill="currentColor"/>` } },
  trigger: { component: { template: `<path d="${TRIGGER_PATH}" fill="currentColor"/>` } },
  radar: { component: { template: `<path d="${RADAR_PATH}" fill="currentColor"/>` } },
  "x-circle": { component: { template: `<path d="${X_CIRCLE_PATH}" fill="currentColor"/>` } },
  "chevron-down": { component: { template: `<path d="${CHEVRON_DOWN_PATH}" fill="currentColor"/>` } },
};

const iconData = computed(() => ICON_MAP[props.name] || null);
</script>

<style scoped>
.icon-ok { color: var(--iln-ok); }
.icon-danger { color: var(--iln-danger); }
.icon-warn { color: var(--iln-warn); }
.icon-neutral { color: var(--iln-hint); }
.icon-chart { color: var(--iln-text); }
.icon-shield { color: var(--iln-brand); }
.icon-trigger { color: var(--iln-warn); }
.icon-default { color: var(--iln-hint); }
</style>
