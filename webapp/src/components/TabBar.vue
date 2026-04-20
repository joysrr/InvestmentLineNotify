<template>
  <!-- 左右可滾動 Tab Bar（7 Tab）-->
  <nav class="tab-bar" ref="tabBarRef">
    <router-link
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="tab-item"
      active-class="tab-item--active"
      :exact="tab.exact"
    >
      <span class="tab-indicator"></span>
      <span class="tab-icon" v-html="tab.icon"></span>
      <span class="tab-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { tabs } from '../config/tabsConfig.js'
import { useIOSSwipeGuard } from '../composables/useIOSSwipeGuard.js'

const tabBarRef = ref(null)

// iOS 邊緣手勢防呆：自動綁定/解綁事件
useIOSSwipeGuard(tabBarRef)
</script>

<style scoped>
/* Tab Bar
   - overflow-x: auto 保留水平滾動，供 7 Tab 可左右滾動查看
   - overscroll-behavior-x: contain 防止滾動事件冒泡至父層（避免觸發 iOS 系統操作）
   - -webkit-overflow-scrolling: touch 保持慣性滾動體驗
   - JS 偵測邊緣 20px，邊緣起始的觸控不介入事件 */
.tab-bar {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;    /* 防止事件冒泡，避免觸發 iOS App Switcher */
  scrollbar-width: none;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background: var(--tg-theme-bg-color, rgba(255, 255, 255, 0.92));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  flex-shrink: 0;
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab-item {
  flex: 0 0 auto;
  min-width: 60px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 14px 6px;
  text-decoration: none;
  color: var(--tg-theme-hint-color, #aaa);
  gap: 3px;
  transition: color 0.18s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.tab-item--active {
  color: var(--tg-theme-button-color, #2481cc);
}

.tab-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 24px;
  height: 2.5px;
  border-radius: 0 0 3px 3px;
  background: var(--tg-theme-button-color, #2481cc);
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tab-item--active .tab-indicator {
  transform: translateX(-50%) scaleX(1);
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  transition: transform 0.18s ease;
}
.tab-item--active .tab-icon {
  transform: translateY(-1px);
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.2px;
  white-space: nowrap;
}
</style>
