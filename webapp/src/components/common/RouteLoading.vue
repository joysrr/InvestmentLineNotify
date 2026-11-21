<template>
  <div class="route-loading" role="status" aria-live="polite">
    <div class="route-loading__spinner" aria-hidden="true"></div>
    <p class="route-loading__text">載入中…</p>
  </div>
</template>

<script setup>
/**
 * RouteLoading — 路由懶載入期間的載入指示器。
 */
</script>

<style scoped>
.route-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--iln-space-10) var(--iln-space-4);
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
  margin-bottom: var(--iln-space-3);
}

.route-loading__text {
  margin: 0;
  font-size: var(--iln-font-base);
  color: var(--iln-text);
}

@keyframes routeLoadingSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-loading__spinner {
    animation: none;
  }
}
</style>
