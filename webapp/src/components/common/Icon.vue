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
import { ICON_MAP } from "./icon-registry.js";

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
  xs: "12",
  sm: "16",
  md: "20",
  lg: "24",
  xl: "32",
};

const resolvedSize = computed(() => {
  if (typeof props.size === "number") return String(props.size);
  return SIZE_MAP[props.size] ?? "20";
});

const iconData = computed(() => {
  let data = ICON_MAP[props.name] || null;
  if (!data && props.name !== "") {
    data = ICON_MAP["neutral"] || null;
    if (import.meta.env.DEV) {
      console.warn(`[Icon] 未知圖示名稱 "${props.name}"，fallback 至 "neutral"`);
    }
  }
  return data;
});
</script>

<style scoped>
.icon-ok { color: var(--iln-viz-bull); }
.icon-danger { color: var(--iln-viz-bear); }
.icon-warn { color: var(--iln-viz-alert); }
.icon-neutral { color: var(--iln-hint); }
.icon-settings { color: var(--iln-hint); }
.icon-info { color: var(--iln-hint); }
.icon-chart { color: var(--iln-text); }
.icon-shield { color: var(--iln-brand); }
.icon-trigger { color: var(--iln-viz-alert); }
.icon-default { color: var(--iln-hint); }
</style>
