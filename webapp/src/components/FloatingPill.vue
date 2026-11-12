<template>
  <div class="nav-container">
    <nav class="floating-pill" ref="pillRef">
      <router-link
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="nav-item"
        active-class="nav-item--active"
        :exact="tab.exact"
        :data-testid="tab.testId"
      >
        <span class="nav-icon" v-html="tab.icon"></span>
        <span class="nav-label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { tabs } from "../config/tabsConfig.js";
import { useIOSSwipeGuard } from "../composables/useIOSSwipeGuard.js";

const pillRef = ref(null);
useIOSSwipeGuard(pillRef);
</script>

<style scoped>
.nav-container {
  position: fixed;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
}

.floating-pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-2) var(--iln-space-3);
  background: var(--tg-theme-bg-color, #ffffff);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-full);
  box-shadow: var(--iln-shadow-3);
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.floating-pill::-webkit-scrollbar {
  display: none;
}

.nav-item {
  flex: 1 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: var(--iln-space-2) var(--iln-space-1);
  text-decoration: none;
  color: var(--tg-theme-hint-color, #999);
  transition: all var(--iln-duration-base) var(--iln-ease-standard);
  border-radius: var(--iln-radius-xl);
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-semibold);
}

.nav-item--active {
  color: var(--iln-brand);
  background: var(--iln-brand-soft);
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-bottom: 2px;
}

.nav-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.nav-label {
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-semibold);
  white-space: nowrap;
}

:global(.dark) .floating-pill {
  background: var(--iln-surface);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
</style>
