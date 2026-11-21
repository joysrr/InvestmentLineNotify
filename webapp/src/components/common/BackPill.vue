<template>
  <router-link
    :to="to"
    class="back-pill"
    :aria-label="`返回 ${label}`"
    data-testid="back-pill"
  >
    <Icon name="arrow-left" size="sm" class="back-pill__icon" />
    <span class="back-pill__label">{{ label }}</span>
  </router-link>
</template>

<script setup>
import Icon from "./Icon.vue";

defineProps({
  /** 返回目標路由（可為字串或 { path, query } 物件） */
  to: { type: [String, Object], required: true },
  /** 膠囊文字，例如「洞察 · 市場雷達」 */
  label: { type: String, required: true },
});
</script>

<style scoped>
.back-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1, 4px);
  min-height: 36px;
  padding: 0 var(--iln-space-3, 12px) 0 var(--iln-space-2, 8px);
  border-radius: var(--iln-radius-full, 9999px);
  background: var(--iln-surface-alt);
  color: var(--iln-text);
  font-size: var(--iln-font-sm, 13px);
  font-weight: var(--iln-weight-medium, 500);
  text-decoration: none;
  white-space: nowrap;
  transition:
    transform var(--iln-duration-fast, 120ms) var(--iln-ease-standard, ease),
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.back-pill:hover {
  background: var(--iln-brand-hover-bg, var(--iln-surface-alt));
}

.back-pill:active {
  transform: scale(0.97);
}

.back-pill:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.back-pill__icon {
  flex: none;
  opacity: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .back-pill,
  .back-pill:active {
    transition: none;
    transform: none;
  }
}
</style>
