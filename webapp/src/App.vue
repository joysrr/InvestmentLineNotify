<template>
  <div class="app-container">
    <main class="app-main">
      <router-view />
    </main>

    <nav class="tab-bar">
      <router-link to="/" class="tab-item" active-class="tab-item--active" exact>
        <span class="tab-icon">📈</span>
        <span class="tab-label">圖表</span>
      </router-link>
      <router-link to="/reports" class="tab-item" active-class="tab-item--active">
        <span class="tab-icon">📋</span>
        <span class="tab-label">報告</span>
      </router-link>
      <router-link to="/news" class="tab-item" active-class="tab-item--active">
        <span class="tab-icon">📰</span>
        <span class="tab-label">新聞</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useTelegram } from './composables/useTelegram.js'

const { expand } = useTelegram()
onMounted(() => expand())
</script>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.tab-bar {
  display: flex;
  border-top: 1px solid var(--tg-theme-hint-color, #e0e0e0);
  background: var(--tg-theme-bg-color, #ffffff);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  text-decoration: none;
  color: var(--tg-theme-hint-color, #999);
  font-size: 11px;
  gap: 2px;
  transition: color 0.15s;
}

.tab-item--active {
  color: var(--tg-theme-button-color, #2481cc);
}

.tab-icon {
  font-size: 20px;
  line-height: 1;
}

.tab-label {
  font-size: 11px;
}
</style>
