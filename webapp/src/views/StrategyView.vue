<template>
    <GlobalErrorBoundary>
    <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">⚙️ 投資策略設定</h2>
      <p class="view-subtitle">管理核心邏輯與風險參數</p>
    </div>

    <StrategyConfigPanel />
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import StrategyConfigPanel from "../components/StrategyConfigPanel.vue";
</script>

<style scoped>
.view-container {
  padding: 16px 16px 100px; /* 留空間給浮動導航 */
}

.view-header {
  margin-bottom: 20px;
  padding-left: 4px;
}

.view-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--tg-theme-text-color, #111);
  margin: 0 0 4px;
}

.view-subtitle {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #888);
  margin: 0;
}
</style>
