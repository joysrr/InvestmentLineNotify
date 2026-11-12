<template>
  <div class="route-loading">
    <div class="route-loading__spinner"></div>
    <p class="route-loading__text">載入中…</p>
  </div>
</template>

<script setup>
/**
 * RouteLoading — 路由懶載入期間的載入指示器。
 * 樣式全面使用 design tokens (--iln-*)，作為 1.2 階段令牌對齊的驗收樣本。
 */
</script>

<style scoped>
.route-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 16px;
  color: var(--iln-hint, var(--tg-theme-hint-color, #999));
  background: var(--iln-surface, var(--tg-theme-secondary-bg-color, #f5f5f5));
}

.route-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--iln-border-default, rgba(0, 0, 0, 0.1));
  border-top-color: var(--iln-brand, var(--tg-theme-button-color, #2481cc));
  border-radius: 50%;
  animation: routeLoadingSpin 0.8s linear infinite;
  margin-bottom: 12px;
}

.route-loading__text {
  font-size: 14px;
  color: var(--iln-text, var(--tg-theme-text-color, #000));
}

@keyframes routeLoadingSpin {
  to {
    transform: rotate(360deg);
  }
}
</style>
