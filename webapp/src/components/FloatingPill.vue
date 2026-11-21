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
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
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
let stopWatchStableHeight = null;

const getBottomInset = () => {
  const tgBottom = Number(safeAreaInset.value?.bottom);
  return Number.isFinite(tgBottom) && tgBottom > 0 ? tgBottom : 0;
};

const pillBottom = computed(() => {
  if (typeof window === "undefined") return `${FLOAT_BOTTOM}px`;
  const bottomInset = getBottomInset();
  const stableH = Number(viewportStableHeight.value) || 0;
  // 僅在視窗高度明顯小於 stableHeight（例如鍵盤彈出）時補償；
  // 視窗縮小或恢復展開時避免將 fixed 導覽列推升至頂部或異常位置
  const keyboardOrShrinkDelta =
    stableH > 0 && window.innerHeight < stableH
      ? Math.max(0, stableH - window.innerHeight)
      : 0;
  return `calc(${FLOAT_BOTTOM + bottomInset + keyboardOrShrinkDelta}px + env(safe-area-inset-bottom, 0px))`;
});

const syncPillHeight = () => {
  const pill = pillEl.value;
  if (!pill) return;
  const rect = pill.getBoundingClientRect();
  if (rect.height > 0) {
    // --bottom-nav-height 僅記錄膠囊本體高度 + 上下懸浮緩衝，
    // 實際安全底部留白由 App.vue 的 --tg-safe-bottom 一併計算，避免雙重疊加
    const total = Math.ceil(rect.height + FLOAT_BOTTOM * 2 + BUFFER);
    document.documentElement.style.setProperty(
      "--bottom-nav-height",
      `${total}px`,
    );
  }
};

const handleWindowResize = () => {
  nextTick(syncPillHeight);
};

onMounted(async () => {
  await nextTick();
  syncPillHeight();

  stopWatchSafeArea = watch(() => safeAreaInset.value?.bottom, () => {
    nextTick(syncPillHeight);
  });

  stopWatchStableHeight = watch(() => viewportStableHeight.value, () => {
    nextTick(syncPillHeight);
  });

  if (typeof ResizeObserver !== "undefined" && pillEl.value) {
    resizeObserver = new ResizeObserver(syncPillHeight);
    resizeObserver.observe(pillEl.value);
  }

  window.addEventListener("resize", handleWindowResize, { passive: true });
});

onUnmounted(() => {
  stopWatchSafeArea?.();
  stopWatchStableHeight?.();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", handleWindowResize);
  document.documentElement.style.removeProperty("--bottom-nav-height");
});
</script>

<style scoped>
.nav-container {
  position: fixed;
  inset-inline: 12px;
  bottom: 0;
  display: flex;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
}

.floating-pill {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
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
