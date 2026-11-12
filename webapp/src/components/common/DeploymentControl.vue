<template>
  <section class="deployment-control" aria-labelledby="deployment-title">
    <div class="deployment-heading">
      <div>
        <h2 id="deployment-title" class="deployment-title">🚀 系統部署</h2>
        <p class="deployment-description">僅限管理員更新正式服務；版本相同時會自動略過。</p>
      </div>
      <button
        class="deployment-start"
        type="button"
        data-testid="deployment-start"
        :disabled="loading"
        @click="startDeployment"
      >
        {{ loading ? "檢查中…" : "檢查並部署" }}
      </button>
    </div>

    <p
      v-if="statusText"
      class="deployment-status"
      data-testid="deployment-status"
      :class="statusClass"
    >
      {{ statusText }}
    </p>
  </section>
</template>

<script setup>
import { computed, onUnmounted, ref } from "vue";
import { apiFetch } from "../../api/index.js";
import {
  getDeploymentStatusText,
  isDeploymentFinished,
} from "./deploymentUiState.js";

const loading = ref(false);
const status = ref("");
const errorMessage = ref("");
const commit = ref("");
let pollTimer = null;

const statusText = computed(() => {
  if (errorMessage.value) return errorMessage.value;
  if (commit.value && status.value === "skipped") {
    return `${getDeploymentStatusText(status.value)}（${commit.value.slice(0, 7)}）`;
  }
  return status.value ? getDeploymentStatusText(status.value) : "";
});

const statusClass = computed(() => `status-${status.value || "idle"}`);

function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function pollJob(jobId) {
  const result = await apiFetch(`/api/deploy/${encodeURIComponent(jobId)}`);
  status.value = result.status;
  commit.value = result.commit || result.verification?.commit || "";

  if (isDeploymentFinished(result.status)) {
    loading.value = false;
    return;
  }

  pollTimer = setTimeout(() => {
    pollJob(jobId).catch(handleError);
  }, 1000);
}

function handleError(error) {
  clearPollTimer();
  loading.value = false;
  errorMessage.value = error.message || "部署狀態查詢失敗";
}

async function startDeployment() {
  clearPollTimer();
  loading.value = true;
  status.value = "queued";
  errorMessage.value = "";
  commit.value = "";

  try {
    const result = await apiFetch("/api/deploy", {
      method: "POST",
      body: JSON.stringify({ rollback: false }),
    });
    status.value = result.status;
    commit.value = result.commit || "";

    if (isDeploymentFinished(result.status)) {
      loading.value = false;
      return;
    }

    await pollJob(result.jobId);
  } catch (error) {
    handleError(error);
  }
}

onUnmounted(clearPollTimer);
</script>

<style scoped>
.deployment-control {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 10px;
  background: var(--el-bg-color, #fff);
}

.deployment-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.deployment-title {
  margin: 0;
  font-size: 16px;
}

.deployment-description {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary, #909399);
  font-size: 12px;
}

.deployment-start {
  flex: 0 0 auto;
  min-height: var(--iln-touch-min);
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: var(--el-color-danger, #f56c6c);
  color: #fff;
  cursor: pointer;
}

.deployment-start:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.deployment-status {
  margin: 14px 0 0;
  font-size: 13px;
}

.status-skipped,
.status-completed {
  color: var(--el-color-success, #67c23a);
}

.status-failed,
.status-idle {
  color: var(--el-color-danger, #f56c6c);
}

.status-queued,
.status-running {
  color: var(--el-color-warning, #e6a23c);
}
</style>
