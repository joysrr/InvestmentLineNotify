<template>
  <section class="deployment-control" aria-labelledby="deployment-title">
    <div class="deployment-heading">
      <div>
        <h2 id="deployment-title" class="deployment-title">
          <Icon name="settings" size="sm" />
          <span>系統部署</span>
        </h2>
        <p class="deployment-description">僅限管理員更新正式服務；版本相同時會自動略過。</p>
      </div>
      <button
        class="deployment-start"
        type="button"
        data-testid="deployment-start"
        :disabled="isRunning"
        @click="handleStart"
      >
        <span class="btn-label">{{ isRunning ? "檢查中…" : "檢查並部署" }}</span>
      </button>
    </div>

    <p
      v-if="statusText"
      class="deployment-status tabular"
      data-testid="deployment-status"
      :class="statusClass"
    >
      {{ statusText }}
    </p>
  </section>
</template>

<script setup>
import Icon from "@/components/common/Icon.vue";
import { useDeployJob } from "@/composables/useDeployJob.js";

const { isRunning, statusText, statusClass, startDeploy } = useDeployJob({
  pollIntervalMs: 1000,
});

function handleStart() {
  startDeploy({
    payload: { rollback: false },
    useStream: false,
  });
}
</script>

<style scoped>
.deployment-control {
  padding: var(--iln-space-4);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-lg, 16px);
  background: var(--iln-surface-elevated, var(--iln-surface));
  color: var(--iln-text);
  transition:
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.deployment-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-3);
  flex-wrap: wrap;
}

.deployment-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  margin: 0;
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}

.deployment-description {
  margin: var(--iln-space-1) 0 0;
  color: var(--iln-hint);
  font-size: var(--iln-font-xs);
  line-height: 1.45;
}

.deployment-start {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--iln-touch-min, 40px);
  padding: 0 var(--iln-space-4, 16px);
  border: 1px solid var(--iln-viz-bear-border, transparent);
  border-radius: var(--iln-radius-full, 9999px);
  background: var(--iln-viz-bear, #dc2626);
  color: var(--iln-on-accent, #ffffff);
  font-size: var(--iln-font-sm);
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    opacity var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    transform var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.deployment-start:hover:not(:disabled) {
  background: var(--iln-viz-bear-hover, var(--iln-viz-bear, #b91c1c));
}

.deployment-start:active:not(:disabled) {
  transform: scale(0.98);
}

.deployment-start:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.deployment-start:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.deployment-status {
  margin: var(--iln-space-3) 0 0;
  padding: var(--iln-space-2) var(--iln-space-3);
  border-radius: var(--iln-radius-sm, 8px);
  font-size: var(--iln-font-sm);
  font-weight: 600;
  background: var(--iln-surface-faintest, var(--iln-surface));
  border: 1px solid var(--iln-border-subtle);
}

.status-skipped,
.status-completed {
  color: var(--iln-viz-bull-text);
  background: var(--iln-state-positive-bg, var(--iln-surface));
  border-color: var(--iln-state-positive-border, var(--iln-border-subtle));
}

.status-failed,
.status-idle {
  color: var(--iln-viz-bear-text);
  background: var(--iln-state-negative-bg, var(--iln-surface));
  border-color: var(--iln-state-negative-border, var(--iln-border-subtle));
}

.status-queued,
.status-running {
  color: var(--iln-viz-alert-text);
  background: var(--iln-state-caution-bg, var(--iln-surface));
  border-color: var(--iln-state-caution-border, var(--iln-border-subtle));
}

:global(:root[data-theme="dark"]) .deployment-control,
:global(.dark) .deployment-control {
  background: var(--iln-surface-elevated, var(--iln-surface));
  border-color: var(--iln-border-subtle);
}

:global(:root[data-theme="dark"]) .deployment-start,
:global(.dark) .deployment-start {
  box-shadow: 0 0 0 1px var(--iln-border-subtle);
}

@media (prefers-reduced-motion: reduce) {
  .deployment-control,
  .deployment-start {
    transition: none;
  }

  .deployment-start:active:not(:disabled) {
    transform: none;
  }
}
</style>
