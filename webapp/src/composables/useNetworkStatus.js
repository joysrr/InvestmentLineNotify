import { ref } from "vue";

/**
 * 離線 / 弱網錯誤
 */
export class OfflineError extends Error {
  constructor(message = "網路離線，無法發出請求") {
    super(message);
    this.name = "OfflineError";
    this.isOffline = true;
  }
}

// ── 弱網判斷門檻 ──
const WEAK_RTT_THRESHOLD = 1000; // ms，超過此 RTT 視為弱網
const WEAK_DOWNLINK_THRESHOLD = 1.5; // Mbps，低於此下行速率視為弱網

// ── 模組級響應式狀態（單例，整個應用共用） ──
export const isOnline = ref(
  typeof navigator !== "undefined" ? navigator.onLine : true,
);
export const isWeakNetwork = ref(false);
const connectionInfo = ref(null);
const status = ref(isOnline.value ? "online" : "offline");

let listenersAttached = false;

const updateConnection = () => {
  const nc =
    typeof navigator !== "undefined" && navigator.connection
      ? navigator.connection
      : null;
  connectionInfo.value = nc;

  let weak = false;
  if (nc) {
    const { effectiveType, rtt, downlink } = nc;
    weak =
      effectiveType === "slow-2g" ||
      effectiveType === "2g" ||
      (typeof rtt === "number" && rtt > WEAK_RTT_THRESHOLD) ||
      (typeof downlink === "number" && downlink < WEAK_DOWNLINK_THRESHOLD);
  }
  isWeakNetwork.value = weak;
  updateStatus();
};

const updateStatus = () => {
  if (!isOnline.value) {
    status.value = "offline";
  } else if (isWeakNetwork.value) {
    status.value = "weak";
  } else {
    status.value = "online";
  }
};

const attachListeners = () => {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;

  const handleOnline = () => {
    isOnline.value = true;
    updateConnection();
    updateStatus();
  };
  const handleOffline = () => {
    isOnline.value = false;
    updateStatus();
  };

  if (typeof window.addEventListener === "function") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  const nc =
    typeof navigator !== "undefined" && navigator.connection
      ? navigator.connection
      : null;
  if (nc && typeof nc.addEventListener === "function") {
    nc.addEventListener("change", updateConnection);
  }

  updateConnection();
};

// 模組載入即自動綁定線上/離線與弱網監聽，供 apiFetch 等非元件模組直接匯入 refs
attachListeners();

/**
 * 重新評估弱網狀態（供測試或外部觸發使用）。
 */
export const refreshConnection = updateConnection;

/**
 * 取得目前網路狀態（可供非元件模組，例如 apiFetch 直接匯入）。
 * @returns {{ isOnline: import('vue').Ref<boolean>, isWeakNetwork: import('vue').Ref<boolean>, connectionInfo: import('vue').Ref, status: import('vue').Ref<'online'|'weak'|'offline'>, OfflineError: class }}
 */
export const networkStatus = {
  isOnline,
  isWeakNetwork,
  connectionInfo,
  status,
  OfflineError,
};

/**
 * 組合式函式：在元件 setup 中使用，回應式追蹤線上/離線/弱網狀態。
 * 模組載入時會自動綁定 window online/offline 與 Network Information API。
 * @returns {{ isOnline, isWeakNetwork, connectionInfo, status, OfflineError }}
 */
export function useNetworkStatus() {
  attachListeners();
  return {
    isOnline,
    isWeakNetwork,
    connectionInfo,
    status,
    OfflineError,
  };
}
