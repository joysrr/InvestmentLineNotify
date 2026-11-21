<template>
  <section class="deployment-control" aria-labelledby="deployment-title">
    <div class="deployment-heading">
      <div class="deployment-copy">
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
  --btn-deploy-bg: rgba(239, 68, 68, 0.16);
  --btn-deploy-bg-hover: rgba(239, 68, 68, 0.24);
  --btn-deploy-bg-active: rgba(239, 68, 68, 0.30);
  --btn-deploy-border: rgba(248, 113, 113, 0.42);
  --btn-deploy-text: #fca5a5;
  --btn-deploy-focus: #f87171;

  padding: var(--iln-space-4, 16px);
  border: 1px solid var(--iln-border-subtle, rgba(148, 163, 184, 0.2));
  border-radius: var(--iln-radius-lg, 16px);
  background: var(--iln-surface-elevated, var(--iln-surface, #161b22));
  color: var(--iln-text, #f3f4f6);
  transition:
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.deployment-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--iln-space-3, 12px);
}

.deployment-copy {
  min-width: 0;
}

.deployment-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  margin: 0;
  font-size: var(--iln-font-base, 15px);
  font-weight: 700;
  color: var(--iln-text, #f3f4f6);
}

.deployment-description {
  margin: var(--iln-space-1, 4px) 0 0;
  color: var(--iln-hint, #9ca3af);
  font-size: var(--iln-font-xs, 12px);
  line-height: 1.5;
}

.deployment-start {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--iln-touch-min, 40px);
  padding: 0 var(--iln-space-4, 16px);
  border: 1px solid var(--btn-deploy-border);
  border-radius: var(--iln-radius-full, 9999px);
  background-color: var(--btn-deploy-bg) !important;
  color: var(--btn-deploy-text) !important;
  font-size: var(--iln-font-sm, 13px);
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    opacity var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    transform var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.deployment-start:hover:not(:disabled) {
  background-color: var(--btn-deploy-bg-hover) !important;
  border-color: rgba(248, 113, 113, 0.58);
}

.deployment-start:active:not(:disabled) {
  background-color: var(--btn-deploy-bg-active) !important;
  transform: scale(0.985);
}

.deployment-start:focus-visible {
  outline: 2px solid var(--btn-deploy-focus);
  outline-offset: 2px;
}

.deployment-start:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.deployment-status {
  margin: var(--iln-space-3, 12px) 0 0;
  padding: var(--iln-space-2, 8px) var(--iln-space-3, 12px);
  border-radius: var(--iln-radius-sm, 8px);
  font-size: var(--iln-font-sm, 13px);
  font-weight: 600;
  background: var(--iln-surface-faintest, var(--iln-surface, #1e242d));
  border: 1px solid var(--iln-border-subtle, rgba(148, 163, 184, 0.2));
}

.status-skipped,
.status-completed {
  color: var(--iln-viz-bull-text, #4ade80);
  background: var(--iln-state-positive-bg, rgba(34, 197, 94, 0.14));
  border-color: var(--iln-state-positive-border, rgba(74, 222, 128, 0.35));
}

.status-failed,
.status-idle {
  color: var(--iln-viz-bear-text, #f87171);
  background: var(--iln-state-negative-bg, rgba(239, 68, 68, 0.14));
  border-color: var(--iln-state-negative-border, rgba(248, 113, 113, 0.35));
}

.status-queued,
.status-running {
  color: var(--iln-viz-alert-text, #fbbf24);
  background: var(--iln-state-caution-bg, rgba(245, 158, 11, 0.14));
  border-color: var(--iln-state-caution-border, rgba(251, 191, 36, 0.35));
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
