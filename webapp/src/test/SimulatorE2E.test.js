// webapp/src/test/SimulatorE2E.test.js
// E2E 風格整合測試：模擬真實使用者流程

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import SimulatorView from "../views/SimulatorView.vue";
import { apiFetch } from "../api/index.js";
import { useTelegram, waitReady } from "../composables/useTelegram.js";

vi.mock("../api/index.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../composables/useTelegram.js", () => ({
  useTelegram: () => ({}),
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../components/simulator/SimulatorModeSelector.vue", () => ({
  default: {
    name: "SimulatorModeSelector",
    template: '<div class="mode-selector" data-testid="mode-selector" />',
    props: ["modelValue"],
    emits: ["update:mode"],
  },
}));
vi.mock("../components/simulator/ForwardPanel.vue", () => ({
  default: {
    name: "ForwardPanel",
    template: '<div class="forward-panel" data-testid="forward-panel" />',
    props: [
      "price0050",
      "priceZ2",
      "currentPrice0050",
      "currentPriceZ2",
      "loading",
      "result",
      "error",
    ],
    emits: ["run", "clear"],
  },
}));
vi.mock("../components/simulator/ReversePanel.vue", () => ({
  default: {
    name: "ReversePanel",
    template: '<div class="reverse-panel" data-testid="reverse-panel" />',
    props: ["targetType", "targetValue", "loading", "result", "error"],
    emits: ["run", "clear"],
  },
}));

describe("SimulatorView - E2E 使用者流程", () => {
  let wrapper;

  const mockStatus = {
    data: { marketState: { price0050: 175, currentPrice: 116.5 } },
  };

  const mockForward = {
    calculationMode: "forward",
    dataAsOf: "2026-08-01",
    timestamp: "2026-08-02T10:00:00Z",
    simulatedPrice0050: 180,
    simulatedPriceZ2: 120,
    priceDiffPct0050: 2.86,
    priceDiffPctZ2: 3.0,
    strategyScore: 65,
    strategyStatus: "買入",
    strategyTarget: "加碼",
    strategySuggestion: "建議加碼",
    indicators: {
      rsi: 58.5,
      kd: { k: 60, d: 55 },
      macd: { MACD: 0.5, signal: 0.3 },
      ma20: 175,
      ma60: 170,
      ma240: 165,
      bias240: 9.1,
      atr: 2.5,
    },
    maintenanceMargin: 145.5,
    portfolioHealth: { maintenanceRisk: { level: "Normal" } },
    lifecycleStage: "成長期",
    currentPrice0050: 175,
    currentPriceZ2: 116.5,
    assumptions: ["假設 00675L 按 0050 同比例聯動"],
    warnings: [],
    disclaimer: "此為條件分析，非價格預測亦非投資建議。",
  };

  const mockReverseRSI = {
    calculationMode: "reverse_analytical",
    dataAsOf: "2026-08-01",
    timestamp: "2026-08-02T10:00:00Z",
    target: { type: "rsi", value: 60 },
    reachable: true,
    method: "binary_search_converged",
    results: { price0050: 182, priceZ2: 121.5, achievedValue: 60.1 },
    scanDetails: { iterations: 8, durationMs: 45 },
    assumptions: ["RSI 對價格單調遞增", "搜尋範圍 ±30%"],
    disclaimer: "此為條件分析，非價格預測亦非投資建議。",
  };

  const mockReverseKDCross = {
    calculationMode: "reverse_scan",
    dataAsOf: "2026-08-01",
    timestamp: "2026-08-02T10:00:00Z",
    target: { type: "kdCross", direction: "golden" },
    reachable: true,
    method: "scan",
    results: { price0050: 185, priceZ2: 123.5, achievedValue: "golden" },
    scanDetails: {
      iterations: 60,
      durationMs: 1200,
      range: [148.75, 201.25],
      step: 0.005,
      matchedCount: 3,
    },
    assumptions: ["KD 交叉對價格非單調，需區間掃描", "掃描範圍 ±15%"],
    disclaimer: "此為條件分析，非價格預測亦非投資建議。",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockReset();
    apiFetch.mockImplementation((path) => {
      if (path === "/api/status") return Promise.resolve(mockStatus);
      if (path === "/api/v1/simulate") return Promise.resolve(mockForward);
      if (path === "/api/v1/simulate/reverse")
        return Promise.resolve(mockReverseRSI);
      return Promise.reject(new Error(`Unknown: ${path}`));
    });
    wrapper = mount(SimulatorView, {
      global: {
        stubs: {
          SimulatorModeSelector: true,
          ForwardPanel: true,
          ReversePanel: true,
        },
      },
    });
  });

  it("完整流程：載入 → 正向模擬 → 切換 Mode B → 反向推導 RSI → 切回 Mode A", async () => {
    await flushPromises();

    // 1. 載入當前價格
    expect(wrapper.vm.currentPrice0050).toBe(175);
    expect(wrapper.vm.currentPriceZ2).toBe(116.5);

    // 2. Mode A: 正向模擬
    wrapper.vm.forwardInput.price0050 = 180;
    wrapper.vm.forwardInput.priceZ2 = 120;
    await wrapper.vm.runForward();
    await flushPromises();

    expect(wrapper.vm.result).toEqual(mockForward);
    expect(wrapper.vm.result.strategyScore).toBe(65);
    expect(wrapper.vm.result.maintenanceMargin).toBe(145.5);

    // 3. 切換到 Mode B
    wrapper.vm.mode = "reverse";
    await flushPromises();

    // 4. Mode B: 反向推導 RSI 60
    wrapper.vm.reverseInput.targetType = "rsi";
    wrapper.vm.reverseInput.targetValue = 60;
    await wrapper.vm.runReverse();
    await flushPromises();

    expect(wrapper.vm.result.reachable).toBe(true);
    expect(wrapper.vm.result.results.price0050).toBe(182);
    expect(wrapper.vm.result.scanDetails.iterations).toBe(8);
    expect(wrapper.vm.result.calculationMode).toBe("reverse_analytical");

    // 5. 切回 Mode A 並清除結果
    wrapper.vm.mode = "forward";
    wrapper.vm.clearResult();
    await flushPromises();

    expect(wrapper.vm.result).toBeNull();
    expect(wrapper.vm.error).toBeNull();
  });

  it("完整流程：Mode B 掃描 KD 黃金交叉", async () => {
    await flushPromises();

    // 設定掃描回應
    apiFetch.mockResolvedValueOnce(mockReverseKDCross);

    wrapper.vm.mode = "reverse";
    wrapper.vm.reverseInput.targetType = "kdCross";
    wrapper.vm.reverseInput.targetDirection = "golden";

    await wrapper.vm.runReverse();
    await flushPromises();

    expect(wrapper.vm.result.method).toBe("scan");
    expect(wrapper.vm.result.scanDetails.iterations).toBe(60);
    expect(wrapper.vm.result.scanDetails.matchedCount).toBe(3);
    expect(wrapper.vm.result.results.price0050).toBe(185);
    expect(wrapper.vm.result.calculationMode).toBe("reverse_scan");
  });

  it("錯誤流程：API 409 錯誤 → 顯示錯誤 → 清除 → 重試成功", async () => {
    await flushPromises();

    // 1. 觸發 API 錯誤
    const error = new Error("API error");
    error.status = 409;
    error.body = { message: "MA240 資料不足 (需 240 個月，僅有 60 個月)" };
    apiFetch.mockRejectedValueOnce(error);

    wrapper.vm.forwardInput.price0050 = 180;
    await wrapper.vm.runForward();
    await flushPromises();

    expect(wrapper.vm.error).toBe("MA240 資料不足 (需 240 個月，僅有 60 個月)");
    expect(wrapper.vm.result).toBeNull();

    // 2. 清除錯誤
    wrapper.vm.clearResult();
    await flushPromises();
    expect(wrapper.vm.error).toBeNull();

    // 3. 重試成功
    apiFetch.mockResolvedValueOnce(mockForward);
    wrapper.vm.forwardInput.price0050 = 180;
    await wrapper.vm.runForward();
    await flushPromises();

    expect(wrapper.vm.result).toEqual(mockForward);
    expect(wrapper.vm.error).toBeNull();
  });

  it("切換 Mode 可保留上一個 Mode 的結果供比較", async () => {
    await flushPromises();

    // Mode A 執行
    wrapper.vm.forwardInput.price0050 = 180;
    await wrapper.vm.runForward();
    await flushPromises();
    expect(wrapper.vm.result).not.toBeNull();

    // 切換到 Mode B
    wrapper.vm.mode = "reverse";
    await flushPromises();

    // Mode B 切換時保留上一個結果 (UX 設計：方便比較)
    expect(wrapper.vm.result).not.toBeNull();
    expect(wrapper.vm.result.calculationMode).toBe("forward");

    // 設定具體的反向回應
    apiFetch.mockResolvedValueOnce({
      calculationMode: "reverse_analytical",
      dataAsOf: "2026-08-01",
      timestamp: "2026-08-02T10:00:00Z",
      target: { type: "rsi", value: 60 },
      reachable: true,
      method: "binary_search_converged",
      results: { price0050: 182, priceZ2: 121.5, achievedValue: 60.1 },
      scanDetails: { iterations: 8, durationMs: 45 },
      assumptions: ["RSI 對價格單調遞增", "搜尋範圍 ±30%"],
      disclaimer: "此為條件分析，非價格預測亦非投資建議。",
    });

    // 執行 Mode B 後會覆蓋
    wrapper.vm.reverseInput.targetType = "rsi";
    wrapper.vm.reverseInput.targetValue = 60;
    await wrapper.vm.runReverse();
    await flushPromises();
    expect(wrapper.vm.result.calculationMode).toBe("reverse_analytical");
  });
});
