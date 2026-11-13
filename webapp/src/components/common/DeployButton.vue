<template>
  <div class="deploy-button-wrapper" v-if="isAdmin">
    <el-button
      type="danger"
      size="small"
      :loading="deploying"
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

        <div class="version-info">
          <div class="version-row">
            <span class="label">當前版本:</span>
            <span class="value current">{{ currentVersion || "未知" }}</span>
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

        <el-checkbox v-model="confirmUnderstood" style="margin-top: 12px;">
          我了解風險並確認要繼續部署
        </el-checkbox>
      </div>

      <template #footer>
        <el-button @click="showConfirmDialog = false" :disabled="deploying">
          取消
        </el-button>
        <el-button
          type="danger"
          @click="startDeploy"
          :disabled="deploying || !confirmUnderstood"
          :loading="deploying"
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
          <div class="log-status" :class="logStatusClass">
            <el-icon v-if="deployStatus === 'running'"><Loading class="spinning" /></el-icon>
            <el-icon v-else-if="deployStatus === 'completed'"><CircleCheck /></el-icon>
            <el-icon v-else-if="deployStatus === 'failed'"><CircleClose /></el-icon>
            <el-icon v-else><Time /></el-icon>
          </div>
          <span class="status-text">{{ deployStatusText }}</span>
          <el-button
            v-if="deployStatus === 'running'"
            size="small"
            type="primary"
            @click="cancelDeploy"
            :disabled="!canCancel"
          >
            取消部署
          </el-button>
        </div>

        <div class="log-content" ref="logContainer">
          <div
            v-for="(log, index) in logs"
            :key="index"
            :class="['log-line', log.level]"
          >
            <span class="timestamp">{{ formatTime(log.timestamp) }}</span>
            <span class="level-badge" :class="log.level">{{ log.level.toUpperCase() }}</span>
            <span class="message">{{ log.message }}</span>
          </div>
          <div v-if="logs.length === 0" class="no-logs">等待日誌...</div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showLogDialog = false" :disabled="deploying">
          關閉
        </el-button>
        <el-button v-if="deployStatus === 'failed'" type="primary" @click="retryDeploy">
          重試部署
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from "vue";
import { useAuth } from "@/composables/useAuth";
import { Monitor, Loading, CircleCheck, CircleClose, Time } from "@element-plus/icons-vue";

const { isAdmin, user } = useAuth();

// 狀態
const showConfirmDialog = ref(false);
const showLogDialog = ref(false);
const deploying = ref(false);
const deployStatus = ref("queued"); // queued, running, completed, failed, cancelled
const logs = ref([]);
const confirmUnderstood = ref(false);
const currentJobId = ref(null);
const ws = ref(null);
const logContainer = ref(null);

// 計算屬性
const currentVersion = computed(() => {
  // 可以從版本資訊獲取
  return import.meta.env.VITE_APP_VERSION || "開發版本";
});

const deployStatusText = computed(() => {
  const texts = {
    queued: "排隊中...",
    running: "部署執行中...",
    completed: "部署成功完成",
    failed: "部署失敗",
    cancelled: "已取消",
  };
  return texts[deployStatus.value] || deployStatus.value;
});

const logStatusClass = computed(() => ({
  "status-running": deployStatus.value === "running",
  "status-completed": deployStatus.value === "completed",
  "status-failed": deployStatus.value === "failed",
  "status-cancelled": deployStatus.value === "cancelled",
}));

const canCancel = computed(() => deployStatus.value === "running" || deployStatus.value === "queued");

// 方法
const openConfirmDialog = () => {
  confirmUnderstood.value = false;
  showConfirmDialog.value = true;
};

const handleConfirmClose = (done) => {
  if (!deploying.value) {
    done();
  }
};

const handleLogClose = (done) => {
  if (deployStatus.value === "completed" || deployStatus.value === "failed" || deployStatus.value === "cancelled") {
    done();
  }
};

const startDeploy = async () => {
  showConfirmDialog.value = false;
  showLogDialog.value = true;
  deploying.value = true;
  deployStatus.value = "queued";
  logs.value = [];

  try {
    const response = await fetch("/api/deploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": user.value?.initData || "",
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "部署啟動失敗");
    }

    currentJobId.value = data.jobId;
    deployStatus.value = "running";
    connectWebSocket(data.jobId);
  } catch (err) {
    deployStatus.value = "failed";
    deploying.value = false;
    logs.value.push({
      timestamp: Date.now(),
      level: "error",
      message: err.message,
    });
  }
};

const connectWebSocket = (jobId) => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/api/deploy/${jobId}/ws`;

  ws.value = new WebSocket(wsUrl);

  ws.value.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.historical) {
        // 歷史日誌
        logs.value.push(data);
      } else if (data.type === "done") {
        // 部署完成
        deployStatus.value = data.status;
        deploying.value = false;
        if (data.error) {
          logs.value.push({
            timestamp: Date.now(),
            level: "error",
            message: data.error,
          });
        }
        ws.value?.close();
      } else {
        // 即時日誌
        logs.value.push(data);
      }

      scrollToBottom();
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  };

  ws.value.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  ws.value.onclose = () => {
    console.log("WebSocket closed");
    if (deploying.value) {
      // 嘗試重連
      setTimeout(() => {
        if (currentJobId.value && deploying.value) {
          connectWebSocket(currentJobId.value);
        }
      }, 3000);
    }
  };
};

const scrollToBottom = () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
};

const cancelDeploy = async () => {
  if (!currentJobId.value) return;

  try {
    const response = await fetch(`/api/deploy/cancel/${currentJobId.value}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": user.value?.initData || "",
      },
    });

    if (response.ok) {
      deployStatus.value = "cancelled";
      deploying.value = false;
      ws.value?.close();
    }
  } catch (err) {
    console.error("Cancel failed:", err);
  }
};

const retryDeploy = async () => {
  showLogDialog.value = false;
  await nextTick();
  startDeploy();
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-TW", { hour12: false }) + `.${String(date.getMilliseconds()).padStart(3, "0")}`;
};

// 生命週期
onMounted(() => {
  // 檢查是否有進行中的部署（可選：從 localStorage 恢復）
});

onUnmounted(() => {
  ws.value?.close();
});
</script>

<style scoped>
.deploy-button-wrapper {
  display: flex;
  align-items: center;
}

.confirm-content {
  padding: 8px 0;
}

.version-info {
  margin: var(--iln-space-4) 0;
  padding: var(--iln-space-3);
  background: var(--iln-surface);
  border-radius: var(--iln-radius-sm);
}

.version-row {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  font-size: 13px;
}

.version-row .label {
  color: var(--iln-hint);
}

.version-row .value {
  font-weight: 500;
}

.version-row .value.current {
  color: var(--iln-hint);
}

.version-row .value.target {
  color: var(--iln-brand);
}

.warning-text {
  font-size: 12px;
  color: var(--iln-hint);
  line-height: 1.6;
}

.warning-text strong {
  color: var(--iln-warn-text);
}

/* 日誌面板 */
.log-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--iln-border-subtle);
  margin-bottom: 12px;
}

.log-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-status .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-text {
  font-weight: 500;
  font-size: 14px;
}

.status-running { color: var(--iln-brand); }
.status-completed { color: var(--iln-ok-text); }
.status-failed { color: var(--iln-danger-text); }
.status-cancelled { color: var(--iln-hint); }

.log-content {
  flex: 1;
  overflow-y: auto;
  background: var(--iln-surface);
  border-radius: var(--iln-radius-sm);
  padding: var(--iln-space-3);
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: var(--iln-font-xs);
  line-height: var(--iln-leading-normal);
  min-height: 300px;
}

.log-line {
  display: flex;
  gap: 8px;
  padding: 2px 0;
  border-bottom: 1px solid var(--iln-hint);
}

.log-line:last-child {
  border-bottom: none;
}

.timestamp {
  color: var(--iln-hint);
  min-width: 80px;
}

.level-badge {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-transform: uppercase;
  min-width: 50px;
  text-align: center;
}

.level-badge.info { background: var(--iln-badge-info-bg); color: var(--iln-badge-info-text); }
.level-badge.warn { background: var(--iln-badge-warn-bg); color: var(--iln-badge-warn-text); }
.level-badge.error { background: var(--iln-badge-error-bg); color: var(--iln-badge-error-text); }

.message {
  color: var(--iln-hint);
  word-break: break-all;
  flex: 1;
}

.no-logs {
  color: var(--iln-hint);
  text-align: center;
  padding: 40px 0;
}

/* 對話框全螢幕時的調整 */
:deep(.el-dialog--fullscreen .log-content) {
  height: calc(100vh - 200px);
}
</style>