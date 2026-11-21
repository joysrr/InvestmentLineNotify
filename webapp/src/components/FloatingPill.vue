<template>
  <div class="nav-container">
    <nav
      ref="pillEl"
      class="floating-pill"
      aria-label="主要導覽"
      :style="{ bottom: pillBottom }"
    >
      <router-link
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="nav-item"
        active-class="nav-item--active"
        :exact="tab.exact"
        :data-testid="tab.testId"
        :aria-label="tab.label"
        :aria-current="route.path === tab.to ? 'page' : undefined"
      >
        <span class="nav-icon"><Icon :name="tab.icon" size="sm" /></span>
        <span class="nav-label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { tabs } from "../config/tabsConfig.js";
import Icon from "./common/Icon.vue";
import { useIOSSwipeGuard } from "../composables/useIOSSwipeGuard.js";
import { useTelegram } from "../composables/useTelegram.js";

const pillEl = ref(null);
const route = useRoute();
useIOSSwipeGuard(pillEl);

const { viewportStableHeight, safeAreaInset } = useTelegram();

// 底部懸浮留白與陰影緩衝，同步寫入 --bottom-nav-height 供頁面留白使用
const FLOAT_BOTTOM = 16;
const BUFFER = 12;

let resizeObserver = null;
let stopWatchSafeArea = null;

const pillBottom = computed(() => {
  if (typeof window === "undefined") return `${FLOAT_BOTTOM}px`;
  const viewportDelta = Math.max(0, window.innerHeight - viewportStableHeight.value);
  const bottomInset = Number(safeAreaInset.value?.bottom) || 0;
  return `${FLOAT_BOTTOM + bottomInset + viewportDelta}px`;
});

const syncPillHeight = () => {
  const pill = pillEl.value;
  if (!pill) return;
  const rect = pill.getBoundingClientRect();
  if (rect.height > 0) {
    const bottomInset = Number(safeAreaInset.value?.bottom) || 0;
    const total = Math.ceil(rect.height + FLOAT_BOTTOM * 2 + bottomInset + BUFFER);
    document.documentElement.style.setProperty(
      "--bottom-nav-height",
      `${total}px`,
    );
  }
};

onMounted(() => {
  syncPillHeight();
  stopWatchSafeArea = watch(() => safeAreaInset.value.bottom, syncPillHeight);
  if (typeof ResizeObserver !== "undefined" && pillEl.value) {
    resizeObserver = new ResizeObserver(syncPillHeight);
    resizeObserver.observe(pillEl.value);
  }
});

onUnmounted(() => {
  stopWatchSafeArea?.();
  resizeObserver?.disconnect();
  document.documentElement.style.removeProperty("--bottom-nav-height");
});
</script>

<style scoped>
.nav-container {
  position: relative;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
}

.floating-pill {
  position: fixed;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 5px 6px;
  background: color-mix(in srgb, var(--iln-bg) 88%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-full);
  box-shadow: var(--iln-shadow-3);
  max-width: calc(100vw - 24px);
  margin-inline: auto;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.floating-pill::-webkit-scrollbar {
  display: none;
}

.nav-item {
  flex: 0 0 auto;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  min-height: 44px;
  padding: 4px 10px;
  text-decoration: none;
  color: var(--iln-hint);
  border-radius: var(--iln-radius-full);
  transition:
    transform var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.nav-item:hover:not(.nav-item--active) {
  color: var(--iln-text);
  background: var(--iln-surface-sunken);
}

.nav-item:active {
  transform: scale(0.96);
}

.nav-item:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.nav-item--active {
  color: var(--iln-brand);
  background: var(--iln-brand-soft);
}

.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-bottom: 2px;
}

.nav-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.nav-label {
  font-size: 11px;
  line-height: 1.15;
  font-weight: var(--iln-weight-semibold, 600);
  white-space: nowrap;
  letter-spacing: 0.01em;
}

:global(.dark) .floating-pill,
:root[data-tg-scheme="dark"] .floating-pill {
  background: color-mix(in srgb, var(--iln-surface) 88%, transparent);
  border-color: var(--iln-border-dark-faint);
  box-shadow: var(--iln-shadow-pill);
}

@media (prefers-reduced-motion: reduce) {
  .nav-item,
  .nav-item:hover:not(.nav-item--active),
  .nav-item:active {
    transition: none;
    transform: none;
  }
}
</style>
