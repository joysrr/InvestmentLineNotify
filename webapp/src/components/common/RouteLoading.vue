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
  color: var(--iln-hint);
  background: var(--iln-surface);
}

.route-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--iln-border-default);
  border-top-color: var(--iln-brand);
  border-radius: 50%;
  animation: routeLoadingSpin 0.8s linear infinite;
  margin-bottom: 12px;
}

.route-loading__text {
  font-size: var(--iln-font-base);
  color: var(--iln-text);
}

@keyframes routeLoadingSpin {
  to {
    transform: rotate(360deg);
  }
}
</style>
