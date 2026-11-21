import { ref, computed, onUnmounted } from "vue";
import { apiFetch } from "@/api/index.js";
import { getDeploymentStatusText, isDeploymentFinished } from "@/components/common/deploymentUiState.js";
import { haptic } from "@/composables/useTelegram.js";

export function useDeployJob({ pollIntervalMs = 1000, authHeader = null } = {}) {
  const loading = ref(false);
  const status = ref("idle");
  const errorMessage = ref("");
  const commit = ref("");
  const jobId = ref(null);
  const logs = ref([]);
  const ws = ref(null);

  let pollTimer = null;
  let reconnectTimer = null;
  let unmounted = false;

  const isRunning = computed(
    () => loading.value || status.value === "queued" || status.value === "running",
  );

  const canCancel = computed(
    () => Boolean(jobId.value) && (status.value === "queued" || status.value === "running"),
  );

  const statusText = computed(() => {
    if (errorMessage.value) return errorMessage.value;
    if (commit.value && status.value === "skipped") {
      return `${getDeploymentStatusText(status.value)}（${commit.value.slice(0, 7)}）`;
    }
    return status.value && status.value !== "idle"
      ? getDeploymentStatusText(status.value)
      : "";
  });

  const statusClass = computed(() => `status-${status.value || "idle"}`);

  function clearTimers() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function closeSocket() {
    if (ws.value) {
      ws.value.onclose = null;
      ws.value.onerror = null;
      ws.value.onmessage = null;
      ws.value.close();
      ws.value = null;
    }
  }

  function appendLog(entry) {
    if (!entry) return;
    logs.value.push({
      timestamp: entry.timestamp ?? Date.now(),
      level: entry.level || "info",
      message: entry.message ?? "",
      historical: Boolean(entry.historical),
    });
  }

  function buildHeaders() {
    const headers = { "Content-Type": "application/json" };
    const extra = typeof authHeader === "function" ? authHeader() : authHeader;
    if (extra && typeof extra === "object") {
      Object.assign(headers, extra);
    }
    return headers;
  }

  function handleError(err) {
    clearTimers();
    closeSocket();
    loading.value = false;
    status.value = "failed";
    errorMessage.value = err?.message || "部署狀態查詢失敗";
    appendLog({
      timestamp: Date.now(),
      level: "error",
      message: errorMessage.value,
    });
  }

  function connectWebSocket(targetJobId, onLog) {
    if (typeof window === "undefined" || !targetJobId || unmounted) return;
    closeSocket();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/deploy/${encodeURIComponent(targetJobId)}/ws`;
    const socket = new WebSocket(wsUrl);
    ws.value = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "done") {
          status.value = data.status || status.value;
          loading.value = false;
          if (data.error) {
            errorMessage.value = data.error;
            appendLog({
              timestamp: Date.now(),
              level: "error",
              message: data.error,
            });
          }
          clearTimers();
          closeSocket();
        } else {
          appendLog(data);
        }
        onLog?.(data);
      } catch (err) {
        console.error("[useDeployJob] Failed to parse WebSocket message:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("[useDeployJob] WebSocket error:", err);
    };

    socket.onclose = () => {
      ws.value = null;
      if (!unmounted && isRunning.value && jobId.value) {
        reconnectTimer = setTimeout(() => {
          if (!unmounted && isRunning.value && jobId.value) {
            connectWebSocket(jobId.value, onLog);
          }
        }, 3000);
      }
    };
  }

  async function pollJob(targetJobId) {
    if (unmounted || !targetJobId) return;
    const result = await apiFetch(`/api/deploy/${encodeURIComponent(targetJobId)}`);
    if (unmounted) return;

    status.value = result.status;
    commit.value = result.commit || result.verification?.commit || "";

    if (isDeploymentFinished(result.status)) {
      loading.value = false;
      clearTimers();
      closeSocket();
      return;
    }

    pollTimer = setTimeout(() => {
      pollJob(targetJobId).catch(handleError);
    }, pollIntervalMs);
  }

  async function startDeploy({ payload = { rollback: false }, useStream = false, onLog } = {}) {
    haptic("medium");
    clearTimers();
    closeSocket();

    loading.value = true;
    status.value = "queued";
    errorMessage.value = "";
    commit.value = "";
    jobId.value = null;
    logs.value = [];

    try {
      const result = await apiFetch("/api/deploy", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      if (unmounted) return;

      jobId.value = result.jobId || null;
      status.value = result.status || "running";
      commit.value = result.commit || "";

      if (useStream && jobId.value) {
        connectWebSocket(jobId.value, onLog);
      }

      if (isDeploymentFinished(status.value)) {
        loading.value = false;
        clearTimers();
        closeSocket();
        return;
      }

      if (jobId.value) {
        await pollJob(jobId.value);
      } else {
        loading.value = false;
      }
    } catch (err) {
      handleError(err);
    }
  }

  async function cancelDeploy() {
    if (!jobId.value || !canCancel.value) return false;
    try {
      await apiFetch(`/api/deploy/cancel/${encodeURIComponent(jobId.value)}`, {
        method: "POST",
        headers: buildHeaders(),
      });
      status.value = "cancelled";
      loading.value = false;
      clearTimers();
      closeSocket();
      return true;
    } catch (err) {
      console.error("[useDeployJob] Cancel failed:", err);
      return false;
    }
  }

  onUnmounted(() => {
    unmounted = true;
    clearTimers();
    closeSocket();
  });

  return {
    loading,
    status,
    errorMessage,
    commit,
    jobId,
    logs,
    isRunning,
    canCancel,
    statusText,
    statusClass,
    startDeploy,
    cancelDeploy,
    clearTimers,
    closeSocket,
  };
}
