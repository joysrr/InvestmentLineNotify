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
// 保留 iOS 邊緣滑動保護邏輯，但位置已移開，衝突機率大幅降低
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
  pointer-events: none; /* 容器本身不攔截點擊 */
}

.floating-pill {
  pointer-events: auto; /* 導航條攔截點擊 */
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--tg-theme-bg-color, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 32px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.floating-pill::-webkit-scrollbar {
  display: none;
}

.nav-item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  padding: 6px 4px;
  text-decoration: none;
  color: var(--tg-theme-hint-color, #999);
  transition: all 0.2s ease;
  border-radius: 20px;
}

.nav-item--active {
  color: var(--tg-theme-button-color, #2481cc);
  background: var(--tg-theme-secondary-bg-color, rgba(36, 129, 204, 0.08));
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
  font-size: 10px;
  font-weight: 600;
}

/* 深色模式微調 */
:global(.dark) .floating-pill {
  background: #1c1c1d;
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
</style>
