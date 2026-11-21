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
        {{ isRunning ? "檢查中…" : "檢查並部署" }}
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
  background: var(--iln-surface);
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
  gap: var(--iln-space-1);
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
  min-height: var(--iln-touch-min);
  padding: 0 var(--iln-space-4);
  border: 0;
  border-radius: var(--iln-radius-full, 9999px);
  background: var(--iln-viz-bear);
  color: #ffffff;
  font-size: var(--iln-font-sm);
  font-weight: 600;
  cursor: pointer;
}

.deployment-start:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.deployment-start:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.deployment-status {
  margin: var(--iln-space-3) 0 0;
  font-size: var(--iln-font-sm);
  font-weight: 600;
}

.status-skipped,
.status-completed {
  color: var(--iln-viz-bull-text);
}

.status-failed,
.status-idle {
  color: var(--iln-viz-bear-text);
}

.status-queued,
.status-running {
  color: var(--iln-viz-alert-text);
}
</style>
