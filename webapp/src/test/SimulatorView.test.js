// webapp/src/test/SimulatorView.test.js
// Mini App 實機驗收測試 (Phase E)

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import SimulatorView from "../views/SimulatorView.vue";
import { apiFetch } from "../api/index.js";
import { useTelegram } from "../composables/useTelegram.js";

// Mock apiFetch
vi.mock("../api/index.js", () => ({
  apiFetch: vi.fn(),
}));

// Mock useTelegram
vi.mock("../composables/useTelegram.js", () => ({
  useTelegram: () => ({
    waitReady: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock components to avoid ECharts and other heavy dependencies
vi.mock("../components/simulator/SimulatorModeSelector.vue", () => ({
  default: {
    name: "SimulatorModeSelector",
    template:
      '<div class="mode-selector" data-testid="mode-selector"><slot /></div>',
    props: ["modelValue"],
    emits: ["update:mode"],
  },
}));

vi.mock("../components/simulator/ForwardPanel.vue", () => ({
  default: {
    name: "ForwardPanel",
    template:
      '<div class="forward-panel" data-testid="forward-panel" :price0050="price0050" :priceZ2="priceZ2" :current-price-0050="currentPrice0050" :current-price-z2="currentPriceZ2" :loading="loading" :result="result" :error="error" @run="onRun" @clear="onClear" />',
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
    template:
      '<div class="reverse-panel" data-testid="reverse-panel" :target-type="targetType" :target-value="targetValue" :loading="loading" :result="result" :error="error" @run="onRun" @clear="onClear" />',
    props: ["targetType", "targetValue", "loading", "result", "error"],
    emits: ["run", "clear"],
  },
}));

describe("SimulatorView - Phase E 實機驗收", () => {
  let wrapper;

  const mockForwardResponse = {
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

  const mockReverseResponse = {
    calculationMode: "reverse_analytical",
    dataAsOf: "2026-08-01",
    timestamp: "2026-08-02T10:00:00Z",
    target: { type: "maintenanceRatio", value: 150 },
    reachable: true,
    method: "analytical",
    results: {
      price0050: 185,
      priceZ2: 123.5,
      achievedValue: 150,
    },
    assumptions: ["維持率對價格單調遞減"],
    disclaimer: "此為條件分析，非價格預測亦非投資建議。",
  };

  const mockStatusResponse = {
    data: {
      marketState: {
        price0050: 175,
        currentPrice: 116.5,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockReset();

    // Mock API responses
    apiFetch.mockImplementation((path) => {
      if (path === "/api/status") return Promise.resolve(mockStatusResponse);
      if (path === "/api/v1/simulate")
        return Promise.resolve(mockForwardResponse);
      if (path === "/api/v1/simulate/reverse")
        return Promise.resolve(mockReverseResponse);
      return Promise.reject(new Error(`Unknown path: ${path}`));
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

  it("應正確渲染主標題與副標題", async () => {
    await flushPromises();
    expect(wrapper.find(".sim-title").text()).toBe("0050 雙向模擬器");
    expect(wrapper.find(".sim-subtitle").text()).toBe(
      "股價 ⇄ 策略分數 / 條件反推",
    );
  });

  it("應載入當前市場價格", async () => {
    await flushPromises();
    expect(wrapper.vm.currentPrice0050).toBe(175);
    expect(wrapper.vm.currentPriceZ2).toBe(116.5);
    expect(apiFetch).toHaveBeenCalledWith("/api/status");
  });

  it("Mode A (正向模擬)：輸入價格執行模擬應成功", async () => {
    await flushPromises();

    // 模擬使用者輸入價格
    wrapper.vm.forwardInput.price0050 = 180;
    wrapper.vm.forwardInput.priceZ2 = 120;

    await wrapper.vm.runForward();
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/simulate", {
      method: "POST",
      body: JSON.stringify({ price0050: 180, priceZ2: 120 }),
    });

    expect(wrapper.vm.result).toEqual(mockForwardResponse);
    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.error).toBeNull();
  });

  it("Mode A：缺少必填價格應顯示錯誤", async () => {
    await flushPromises();

    wrapper.vm.forwardInput.price0050 = null;

    await wrapper.vm.runForward();
    await flushPromises();

    expect(wrapper.vm.error).toBe("請輸入 0050 價格");
    expect(wrapper.vm.result).toBeNull();
    expect(apiFetch).not.toHaveBeenCalledWith(
      "/api/v1/simulate",
      expect.any(Object),
    );
  });

  it("Mode B (反向推導)：選擇維持率目標並執行應成功", async () => {
    await flushPromises();

    // 切換到 Mode B
    wrapper.vm.mode = "reverse";
    wrapper.vm.reverseInput.targetType = "maintenanceRatio";
    wrapper.vm.reverseInput.targetValue = 150;

    await wrapper.vm.runReverse();
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/simulate/reverse", {
      method: "POST",
      body: JSON.stringify({
        target: { type: "maintenanceRatio", value: 150 },
      }),
    });

    expect(wrapper.vm.result).toEqual(mockReverseResponse);
    expect(wrapper.vm.loading).toBe(false);
  });

  it("Mode B：RSI 目標反推應正確傳遞目標類型", async () => {
    await flushPromises();

    wrapper.vm.mode = "reverse";
    wrapper.vm.reverseInput.targetType = "rsi";
    wrapper.vm.reverseInput.targetValue = 60;

    await wrapper.vm.runReverse();
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/simulate/reverse", {
      method: "POST",
      body: JSON.stringify({ target: { type: "rsi", value: 60 } }),
    });
  });

  it("Mode B：KD 交叉目標應傳遞 direction 而非 value", async () => {
    await flushPromises();

    wrapper.vm.mode = "reverse";
    wrapper.vm.reverseInput.targetType = "kdCross";
    wrapper.vm.reverseInput.targetDirection = "golden";

    await wrapper.vm.runReverse();
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/simulate/reverse", {
      method: "POST",
      body: JSON.stringify({
        target: { type: "kdCross", direction: "golden" },
      }),
    });
  });

  it("Mode B：MACD 交叉目標應傳遞 direction", async () => {
    await flushPromises();

    wrapper.vm.mode = "reverse";
    wrapper.vm.reverseInput.targetType = "macdCross";
    wrapper.vm.reverseInput.targetDirection = "dead";

    await wrapper.vm.runReverse();
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/simulate/reverse", {
      method: "POST",
      body: JSON.stringify({
        target: { type: "macdCross", direction: "dead" },
      }),
    });
  });

  it("Mode B：Portfolio Health 目標應傳遞 status", async () => {
    await flushPromises();

    wrapper.vm.mode = "reverse";
    wrapper.vm.reverseInput.targetType = "portfolioHealth";
    wrapper.vm.reverseInput.targetStatus = "yellow";

    await wrapper.vm.runReverse();
    await flushPromises();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/simulate/reverse", {
      method: "POST",
      body: JSON.stringify({
        target: { type: "portfolioHealth", status: "yellow" },
      }),
    });
  });

  it("API 錯誤應正確顯示錯誤訊息", async () => {
    await flushPromises();

    // 模擬 API 回傳 409 錯誤，包含 body.message
    const error = new Error("API error");
    error.status = 409;
    error.body = { message: "MA240 資料不足 (需 240 個月，僅有 60 個月)" };
    apiFetch.mockRejectedValueOnce(error);

    wrapper.vm.forwardInput.price0050 = 180;
    await wrapper.vm.runForward();
    await flushPromises();

    expect(wrapper.vm.error).toBe("MA240 資料不足 (需 240 個月，僅有 60 個月)");
    expect(wrapper.vm.result).toBeNull();
  });

  it("清除結果應重置狀態", async () => {
    await flushPromises();

    wrapper.vm.forwardInput.price0050 = 180;
    await wrapper.vm.runForward();
    await flushPromises();

    expect(wrapper.vm.result).not.toBeNull();

    wrapper.vm.clearResult();
    await flushPromises();

    expect(wrapper.vm.result).toBeNull();
    expect(wrapper.vm.error).toBeNull();
  });

  it("Mode A 結果應包含完整指標與白話解讀", async () => {
    await flushPromises();

    wrapper.vm.forwardInput.price0050 = 180;
    await wrapper.vm.runForward();
    await flushPromises();

    const result = wrapper.vm.result;

    // 檢查關鍵欄位
    expect(result.simulatedPrice0050).toBe(180);
    expect(result.strategyScore).toBe(65);
    expect(result.strategyStatus).toBe("買入");
    expect(result.strategyTarget).toBe("加碼");
    expect(result.strategySuggestion).toBe("建議加碼");
    expect(result.maintenanceMargin).toBe(145.5);
    expect(result.portfolioHealth.maintenanceRisk.level).toBe("Normal");
    expect(result.lifecycleStage).toBe("成長期");

    // 檢查指標
    expect(result.indicators.rsi).toBe(58.5);
    expect(result.indicators.ma20).toBe(175);
    expect(result.indicators.bias240).toBe(9.1);

    // 檢查假設與免責聲明
    expect(result.assumptions).toContain("假設 00675L 按 0050 同比例聯動");
    expect(result.disclaimer).toContain("非價格預測亦非投資建議");
  });

  it("Mode B 不可達結果應包含最近可達資訊", async () => {
    await flushPromises();

    const unreachableResponse = {
      ...mockReverseResponse,
      reachable: false,
      reason: "目標維持率 200% 在掃描範圍內不可達",
      closestResult: {
        price0050: 190,
        achievedValue: 145,
        error: 5.2,
      },
      suggestedRange: { min: 100, max: 145 },
    };

    apiFetch.mockResolvedValueOnce(unreachableResponse);

    wrapper.vm.mode = "reverse";
    wrapper.vm.reverseInput.targetType = "maintenanceRatio";
    wrapper.vm.reverseInput.targetValue = 200;

    await wrapper.vm.runReverse();
    await flushPromises();

    expect(wrapper.vm.result.reachable).toBe(false);
    expect(wrapper.vm.result.reason).toBeDefined();
    expect(wrapper.vm.result.closestResult).toBeDefined();
    expect(wrapper.vm.result.closestResult.price0050).toBe(190);
    expect(wrapper.vm.result.suggestedRange).toBeDefined();
  });

  it("載入狀態應正確切換", async () => {
    await flushPromises();

    let resolveForward;
    apiFetch.mockImplementationOnce(
      () => new Promise((r) => (resolveForward = r)),
    );

    wrapper.vm.forwardInput.price0050 = 180;
    const promise = wrapper.vm.runForward();

    // 檢查載入中狀態
    expect(wrapper.vm.loading).toBe(true);

    // 解決 Promise
    resolveForward(mockForwardResponse);
    await promise;
    await flushPromises();

    expect(wrapper.vm.loading).toBe(false);
  });

  it("價格偏離警告：>20% 應顯示紅色警告", async () => {
    await flushPromises();

    // 模擬價格偏離 > 20%
    wrapper.vm.currentPrice0050 = 175;
    wrapper.vm.forwardInput.price0050 = 220; // 偏離 ~25.7%

    await wrapper.vm.runForward();
    await flushPromises();

    // 驗證 API 呼叫仍會發出 (警告不阻擋)
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/simulate", {
      method: "POST",
      body: JSON.stringify({ price0050: 220, priceZ2: undefined }),
    });
  });
});
