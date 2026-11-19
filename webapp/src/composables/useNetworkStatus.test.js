import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  useNetworkStatus,
  OfflineError,
  refreshConnection,
} from "../composables/useNetworkStatus.js";

// jsdom 預設 navigator.onLine = true，並無 navigator.connection
const setNavigatorOnline = (value) => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
    writable: true,
  });
};

const setNavigatorConnection = (conn) => {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: conn,
    writable: true,
  });
};

const clearNavigatorConnection = () => {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: undefined,
    writable: true,
  });
};

const dispatch = (type) => {
  window.dispatchEvent(new Event(type));
};

beforeEach(() => {
  setNavigatorOnline(true);
  clearNavigatorConnection();
  // 每個測試取得全新 composable 實例（模組級狀態由 vitest 隔離）
});

afterEach(() => {
  setNavigatorOnline(true);
  clearNavigatorConnection();
});

describe("useNetworkStatus", () => {
  it("初始為線上狀態", () => {
    const { isOnline, status } = useNetworkStatus();
    expect(isOnline.value).toBe(true);
    expect(status.value).toBe("online");
  });

  it("離線事件切換為離線，回線事件切換回線上", () => {
    const { isOnline, status } = useNetworkStatus();

    setNavigatorOnline(false);
    dispatch("offline");
    expect(isOnline.value).toBe(false);
    expect(status.value).toBe("offline");

    setNavigatorOnline(true);
    dispatch("online");
    expect(isOnline.value).toBe(true);
    expect(status.value).toBe("online");
  });

  it("弱網（effectiveType=2g）標記為 weak", () => {
    const { isWeakNetwork, status } = useNetworkStatus();

    setNavigatorConnection({ effectiveType: "2g", rtt: 200, downlink: 10 });
    refreshConnection();
    expect(isWeakNetwork.value).toBe(true);
    expect(status.value).toBe("weak");
  });

  it("弱網（rtt 超過門檻）標記為 weak", () => {
    const { isWeakNetwork, status } = useNetworkStatus();

    setNavigatorConnection({ effectiveType: "4g", rtt: 1500, downlink: 50 });
    refreshConnection();
    expect(isWeakNetwork.value).toBe(true);
    expect(status.value).toBe("weak");
  });

  it("弱網（下行速率過低）標記為 weak", () => {
    const { isWeakNetwork } = useNetworkStatus();

    setNavigatorConnection({ effectiveType: "4g", rtt: 100, downlink: 0.5 });
    refreshConnection();
    expect(isWeakNetwork.value).toBe(true);
  });

  it("優質網路不標記為弱網", () => {
    const { isWeakNetwork, status } = useNetworkStatus();

    setNavigatorConnection({ effectiveType: "4g", rtt: 50, downlink: 50 });
    refreshConnection();
    expect(isWeakNetwork.value).toBe(false);
    expect(status.value).toBe("online");
  });

  it("OfflineError 具備 isOffline 標記", () => {
    const err = new OfflineError("離線中");
    expect(err.name).toBe("OfflineError");
    expect(err.isOffline).toBe(true);
    expect(err.message).toBe("離線中");
  });
});
