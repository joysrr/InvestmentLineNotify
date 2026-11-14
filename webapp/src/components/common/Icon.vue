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
  sm: "16",
  md: "20",
  lg: "24",
  xl: "32",
};

const resolvedSize = computed(() => {
  if (typeof props.size === "number") return String(props.size);
  return SIZE_MAP[props.size] ?? String(props.size);
});

const iconData = computed(() => {
  const data = ICON_MAP[props.name] || null;
  if (!data && import.meta.env.DEV && props.name !== "") {
    console.warn(`[Icon] 未定義的圖示名稱:"${props.name}"，已渲染 fallback。`);
  }
  return data;
});
</script>

<style scoped>
.icon-ok { color: var(--iln-ok); }
.icon-danger { color: var(--iln-danger); }
.icon-warn { color: var(--iln-warn); }
.icon-neutral { color: var(--iln-hint); }
.icon-settings { color: var(--iln-hint); }
.icon-info { color: var(--iln-hint); }
.icon-chart { color: var(--iln-text); }
.icon-shield { color: var(--iln-brand); }
.icon-trigger { color: var(--iln-warn); }
.icon-default { color: var(--iln-hint); }
</style>
