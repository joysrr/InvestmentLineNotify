<template>
  <div class="deploy-button-wrapper" v-if="isAdmin">
    <el-button
      type="danger"
      size="small"
      :loading="isRunning"
      @click="openConfirmDialog"
      data-testid="deploy-btn"
    >
      <el-icon><Monitor /></el-icon>
      <span>部署</span>
    </el-button>

    <!-- 確認對話框 -->
    <el-dialog
      v-model="showConfirmDialog"
      title="確認部署"
      width="500px"
      :before-close="handleConfirmClose"
      destroy-on-close
    >
      <div class="confirm-content">
        <el-alert
          title="即將執行生產環境部署"
          type="warning"
          show-icon
          :closable="false"
        />

        <div class="version-info tabular">
          <div class="version-row">
            <span class="label">當前版本:</span>
            <span class="value current">{{ currentVersion }}</span>
          </div>
          <div class="version-row">
            <span class="label">即將部署:</span>
            <span class="value target">最新 main 分支</span>
          </div>
        </div>

        <div class="warning-text">
          此操作將會：<br>
          1. 拉取最新代碼 (git pull)<br>
          2. 安裝依賴 (npm ci)<br>
          3. 建置前後端 (npm run build)<br>
          4. 重啟服務 (pm2 reload)<br>
          <br>
          <strong>部署過程中服務可能短暫不可用。</strong>
        </div>

        <el-checkbox v-model="confirmUnderstood" class="confirm-checkbox">
          我了解風險並確認要繼續部署
        </el-checkbox>
      </div>

      <template #footer>
        <el-button @click="handleCancelConfirm" :disabled="isRunning">
          取消
        </el-button>
        <el-button
          type="danger"
          @click="handleStartDeploy"
          :disabled="isRunning || !confirmUnderstood"
          :loading="isRunning"
        >
          確認部署
        </el-button>
      </template>
    </el-dialog>

    <!-- 日誌面板 -->
    <el-dialog
      v-model="showLogDialog"
      title="部署日誌"
      width="800px"
      :fullscreen="true"
      :before-close="handleLogClose"
      destroy-on-close
    >
      <div class="log-panel" data-testid="deploy-log-panel">
        <div class="log-header">
          <div class="log-status" :class="statusClass">
            <el-icon v-if="status === 'running'"><Loading class="spinning" /></el-icon>
            <el-icon v-else-if="status === 'completed'"><CircleCheck /></el-icon>
            <el-icon v-else-if="status === 'failed'"><CircleClose /></el-icon>
            <el-icon v-else><Time /></el-icon>
          </div>
          <span class="status-text">{{ statusText }}</span>
          <el-button
            v-if="status === 'running'"
            size="small"
            type="primary"
            @click="cancelDeploy"
            :disabled="!canCancel"
          >
            取消部署
          </el-button>
        </div>

        <div class="log-content tabular" ref="logContainer">
          <div
            v-for="(log, index) in logs"
            :key="index"
            :class="['log-line', log.level]"
          >
            <span class="timestamp">{{ formatTime(log.timestamp) }}</span>
            <span class="level-badge" :class="log.level">{{ String(log.level || "info").toUpperCase() }}</span>
            <span class="message">{{ log.message }}</span>
          </div>
          <div v-if="logs.length === 0" class="no-logs">等待日誌...</div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showLogDialog = false" :disabled="isRunning">
          關閉
        </el-button>
        <el-button v-if="status === 'failed'" type="primary" @click="handleRetryDeploy">
          重試部署
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from "vue";
import { useAuth } from "@/composables/useAuth";
import { useDeployJob } from "@/composables/useDeployJob.js";
import { Monitor, Loading, CircleCheck, CircleClose, Time } from "@element-plus/icons-vue";
import { haptic } from "@/composables/useTelegram.js";

const { isAdmin, user } = useAuth();

const {
  status,
  statusText,
  statusClass,
  logs,
  isRunning,
  canCancel,
  startDeploy,
  cancelDeploy,
} = useDeployJob({
  pollIntervalMs: 2500,
  authHeader: () => ({
    "X-Telegram-Init-Data": user.value?.initData || "",
  }),
});

const showConfirmDialog = ref(false);
const showLogDialog = ref(false);
const confirmUnderstood = ref(false);
const logContainer = ref(null);

const currentVersion = computed(() => import.meta.env.VITE_APP_VERSION || "開發版本");

const openConfirmDialog = () => {
  confirmUnderstood.value = false;
  showConfirmDialog.value = true;
};

const handleCancelConfirm = () => {
  haptic("medium");
  showConfirmDialog.value = false;
};

const handleConfirmClose = (done) => {
  if (!isRunning.value) {
    done();
  }
};

const handleLogClose = (done) => {
  if (!isRunning.value) {
    done();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
};

const handleStartDeploy = async () => {
  showConfirmDialog.value = false;
  showLogDialog.value = true;
  await startDeploy({
    payload: {},
    useStream: true,
    onLog: scrollToBottom,
  });
  scrollToBottom();
};

const handleRetryDeploy = async () => {
  haptic("medium");
  showLogDialog.value = false;
  await nextTick();
  await handleStartDeploy();
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--:--:--.---";
  return (
    date.toLocaleTimeString("zh-TW", { hour12: false }) +
    `.${String(date.getMilliseconds()).padStart(3, "0")}`
  );
};
</script>

<style scoped>
.deploy-button-wrapper {
  display: flex;
  align-items: center;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.confirm-content {
  padding: var(--iln-space-2) 0;
}

.confirm-checkbox {
  margin-top: var(--iln-space-3);
}

.version-info {
  margin: var(--iln-space-4) 0;
  padding: var(--iln-space-3);
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-sm);
}

.version-row {
  display: flex;
  justify-content: space-between;
  margin: var(--iln-space-2) 0;
  font-size: var(--iln-font-sm);
}

.version-row .label {
  color: var(--iln-hint);
}

.version-row .value {
  font-weight: 600;
}

.version-row .value.current {
  color: var(--iln-hint);
}

.version-row .value.target {
  color: var(--iln-brand);
}

.warning-text {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  line-height: 1.6;
}

.warning-text strong {
  color: var(--iln-viz-alert-text);
}

.log-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-3);
  padding-bottom: var(--iln-space-3);
  border-bottom: 1px solid var(--iln-border-subtle);
  margin-bottom: var(--iln-space-3);
}

.log-status {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
}

.log-status .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-text {
  font-weight: 600;
  font-size: var(--iln-font-base);
}

.status-running { color: var(--iln-brand); }
.status-completed { color: var(--iln-viz-bull-text); }
.status-failed { color: var(--iln-viz-bear-text); }
.status-cancelled { color: var(--iln-hint); }

.log-content {
  flex: 1;
  overflow-y: auto;
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-sm);
  padding: var(--iln-space-3);
  font-family: var(--iln-font-mono, monospace);
  font-size: var(--iln-font-xs);
  line-height: var(--iln-leading-normal);
  min-height: 300px;
}

.log-line {
  display: flex;
  gap: var(--iln-space-2);
  padding: 2px 0;
  border-bottom: 1px solid var(--iln-border-subtle);
}

.log-line:last-child {
  border-bottom: none;
}

.timestamp {
  color: var(--iln-hint);
  min-width: 80px;
}

.level-badge {
  padding: 1px var(--iln-space-1-5, 6px);
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  min-width: 50px;
  text-align: center;
}

.level-badge.info { background: var(--iln-badge-info-bg); color: var(--iln-badge-info-text); }
.level-badge.warn { background: var(--iln-badge-warn-bg); color: var(--iln-badge-warn-text); }
.level-badge.error { background: var(--iln-badge-error-bg); color: var(--iln-badge-error-text); }

.message {
  color: var(--iln-text);
  word-break: break-all;
  flex: 1;
}

.no-logs {
  color: var(--iln-hint);
  text-align: center;
  padding: var(--iln-space-10) 0;
}

:deep(.el-dialog--fullscreen .log-content) {
  height: calc(100vh - 200px);
}
</style>
