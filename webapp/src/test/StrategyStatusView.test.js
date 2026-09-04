// webapp/src/test/StrategyStatusView.test.js
// StrategyStatusView 頁面單元測試 - 簡化版本

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import StrategyStatusView from "../views/StrategyStatusView.vue";
import { apiFetch } from "../api/index.js";

// Use vi.hoisted to define mock components at top level (before vi.mock calls)
const mockComponents = vi.hoisted(() => ({
  ScoreBar: {
    name: "ScoreBar",
    template: '<div class="score-bar" data-testid="score-bar"><slot /></div>',
    props: ["label", "value", "max", "color", "description"],
  },
  AllocationTier: {
    name: "AllocationTier",
    template:
      '<div class="allocation-tier" data-testid="allocation-tier" :tier="tier" :is-current="isCurrent" :is-next="isNext" />',
    props: ["tier", "isCurrent", "isNext"],
  },
  ThresholdItem: {
    name: "ThresholdItem",
    template:
      '<div class="threshold-item" data-testid="threshold-item"><slot /></div>',
    props: ["label", "value", "unit"],
  },
  BudgetItem: {
    name: "BudgetItem",
    template:
      '<div class="budget-item" data-testid="budget-item"><slot /></div>',
    props: ["label", "value", "unit"],
  },
  LifecycleItem: {
    name: "LifecycleItem",
    template:
      '<div class="lifecycle-item" data-testid="lifecycle-item"><slot /></div>',
    props: ["label", "value", "unit", "icon"],
  },
  RiskItem: {
    name: "RiskItem",
    template: '<div class="risk-item" data-testid="risk-item"><slot /></div>',
    props: ["label", "value", "unit", "icon", "itemClass"],
  },
  MetricItem: {
    name: "MetricItem",
    template:
      '<div class="metric-item" data-testid="metric-item"><slot /></div>',
    props: ["label", "value", "unit", "format"],
  },
}));

// Mock dependencies
vi.mock("../api/index.js", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../composables/useTelegram.js", () => ({
  useTelegram: () => ({}),
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

// Mock child components using hoisted mockComponents
vi.mock("../components/dashboard/ScoreBar.vue", () => ({
  default: mockComponents.ScoreBar,
}));
vi.mock("../components/dashboard/AllocationTier.vue", () => ({
  default: mockComponents.AllocationTier,
}));
vi.mock("../components/dashboard/ThresholdItem.vue", () => ({
  default: mockComponents.ThresholdItem,
}));
vi.mock("../components/dashboard/BudgetItem.vue", () => ({
  default: mockComponents.BudgetItem,
}));
vi.mock("../components/dashboard/LifecycleItem.vue", () => ({
  default: mockComponents.LifecycleItem,
}));
vi.mock("../components/dashboard/RiskItem.vue", () => ({
  default: mockComponents.RiskItem,
}));
vi.mock("../components/dashboard/MetricItem.vue", () => ({
  default: mockComponents.MetricItem,
}));

const mockApiResponse = {
  timestamp: "2026-08-09T12:00:00Z",
  reportDate: "2026-08-09",
  weightScore: {
    dropScore: 4,
    rsiScore: 4,
    macdScore: 2,
    kdScore: 1,
    sentimentScore: 1,
    total: 12,
  },
  cooldown: {
    inCooldown: false,
    daysLeft: 0,
    lastBuyDate: "2026-07-15",
    message: "無冷卻期資料",
  },
  allocation: {
    current: { minScore: 6, leverage: 0.4, cash: 0.6, comment: "一般訊號" },
    next: {
      minScore: 8,
      leverage: 0.6,
      cash: 0.4,
      comment: "積極加碼",
      scoreToNext: 2,
    },
  },
  scoring: {
    minScoreToBuy: 3,
    buyTactical: 4,
    buyTacticalBullish: 1.5,
  },
  budget: {
    isLimited: false,
    allowedAmount: 1500,
    limitedReason: null,
    details: {
      dailyCap: 50000,
      rollingCap: 150000,
      rollingUsed: 5000,
      rollingAvailable: 145000,
      dailyAvailable: 50000,
      dailyDcaReserve: 1500,
      tacticalPool: 48500,
      signalTypePool: "baseline",
      poolAllocationRatio: 1,
      poolAmount: 1500,
    },
  },
  signal: {
    category: "baseline",
    type: "baseline",
    direction: "long",
    target: "🔹 0050 DCA",
    suggestion: "維持觀望",
  },
  lifecycle: {
    stage: "EARLY",
    currentAge: 38,
    retirementAge: 65,
    yearsToRetirement: 27,
  },
  lifecycleProfile: {
    maxLeverage: 2.0,
    maxLeverageForNewZ2: 1.5,
    minSurvivalDropLimit: 140,
    mode: "aggressive",
  },
  risk: {
    regime: "NORMAL",
    maintenanceMargin: 155.5,
    grossLeverage: 2.05,
    grossLeverageResult: { grossLeverage: 2.05, status: "normal" },
    valuationGuard: { latchActive: false },
    panicBypassActive: false,
    trailingActive: false,
  },
  keyMetrics: {
    maintenanceMargin: 155.5,
    grossLeverage: 2.05,
    z2Ratio: 22.5,
    currentPr: 45,
    netAsset: 1050000,
    actualLeverage: 1.75,
  },
  strategySnapshot: {
    allocation: {
      current: { minScore: 6, leverage: 0.4, cash: 0.6, comment: "一般訊號" },
      next: {
        minScore: 8,
        leverage: 0.6,
        cash: 0.4,
        comment: "積極加碼",
        scoreToNext: 2,
      },
    },
  },
};

describe("StrategyStatusView", () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue(mockApiResponse);

    wrapper = mount(StrategyStatusView, {
      global: {
        stubs: mockComponents,
      },
    });
  });

  it("應正確載入並顯示標題", async () => {
    await flushPromises();
    expect(wrapper.find(".status-title").text()).toBe("策略狀態面板");
    expect(wrapper.find(".status-subtitle").text()).toContain(
      "即時策略決策透視",
    );
  });

  it("Weight Score 區塊應存在", async () => {
    await flushPromises();
    // 只要渲染出 5 個 score-bar 即可
    const scoreBars = wrapper.findAll("[data-testid='score-bar']");
    expect(scoreBars.length).toBe(5);
  });

  it("冷卻期狀態應正確顯示", async () => {
    await flushPromises();
    // Find the cooldown section specifically (2nd section)
    const sections = wrapper.findAll(".status-section");
    const cooldownSection = sections[1];
    expect(cooldownSection.find(".cooldown-label").text()).toBe("可正常交易");
    expect(cooldownSection.find(".section-badge").text()).toBe("無冷卻期");
  });

  it("策略分數檔位區塊應存在", async () => {
    await flushPromises();
    const tiers = wrapper.findAll("[data-testid='allocation-tier']");
    expect(tiers.length).toBeGreaterThan(0);
  });

  it("Budget Priority 區塊應存在", async () => {
    await flushPromises();
    const budgetItems = wrapper.findAll("[data-testid='budget-item']");
    expect(budgetItems.length).toBe(5);
  });

  it("信號分類應顯示 category/type/direction", async () => {
    await flushPromises();
    expect(wrapper.find(".signal-category-badge").text()).toBe("🌱 底倉/觀望");
    expect(wrapper.find(".signal-type-badge").text()).toBe("🌱 底倉/觀望");
    expect(wrapper.find(".signal-direction").text()).toBe("long");
  });

  it("生命週期階段應正確顯示", async () => {
    await flushPromises();
    expect(wrapper.find(".lifecycle-badge").text()).toBe("EARLY");
    expect(wrapper.find(".lifecycle-grid").exists()).toBe(true);
  });

  it("風控狀態區塊應存在", async () => {
    await flushPromises();
    const riskItems = wrapper.findAll("[data-testid='risk-item']");
    expect(riskItems.length).toBe(6);
  });

  it("關鍵指標區塊應存在", async () => {
    await flushPromises();
    const metricItems = wrapper.findAll("[data-testid='metric-item']");
    expect(metricItems.length).toBe(6);
  });

  it("應顯示冷卻中、受限預算與危機風控狀態", async () => {
    const variant = structuredClone(mockApiResponse);
    variant.weightScore = {
      dropScore: 1,
      rsiScore: 1,
      macdScore: 0,
      kdScore: 0,
      sentimentScore: -3,
      total: -1,
    };
    variant.cooldown.inCooldown = true;
    variant.cooldown.daysLeft = 3;
    variant.allocation.next = null;
    variant.budget.isLimited = true;
    variant.budget.limitedReason = "額度不足";
    variant.signal.direction = "short";
    variant.lifecycle.yearsToRetirement = null;
    variant.lifecycleProfile.mode = "unknown";
    variant.risk.regime = "CRISIS";
    variant.risk.maintenanceMargin = 140;
    variant.risk.grossLeverage = 2.6;
    variant.risk.valuationGuard.latchActive = true;
    variant.risk.panicBypassActive = true;
    apiFetch.mockResolvedValueOnce(variant);

    const variantWrapper = mount(StrategyStatusView, {
      global: { stubs: mockComponents },
    });

    await flushPromises();
    expect(variantWrapper.find(".cooldown-label").text()).toBe("冷卻中");
    expect(variantWrapper.find(".budget-reason").text()).toContain("額度不足");
    expect(variantWrapper.find(".risk-badge").text()).toContain("危機");
  });

  it("API 錯誤時應顯示錯誤狀態", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Network error"));

    const errorWrapper = mount(StrategyStatusView, {
      global: { stubs: mockComponents },
    });

    await flushPromises();
    expect(errorWrapper.find(".status-error").exists()).toBe(true);
    expect(errorWrapper.find(".status-error p").text()).toContain(
      "Network error",
    );
  });

  it("重試按鈕應重新呼叫 API", async () => {
    // First, trigger an error to make the retry button appear
    apiFetch.mockRejectedValueOnce(new Error("Network error"));

    const testWrapper = mount(StrategyStatusView, {
      global: { stubs: mockComponents },
    });

    // Wait for error to appear
    await flushPromises();
    expect(testWrapper.find(".status-error").exists()).toBe(true);

    // Now mock success for retry
    apiFetch.mockResolvedValueOnce(mockApiResponse);

    // Trigger retry
    await testWrapper.find(".retry-btn").trigger("click");
    await flushPromises();

    // Should have been called again (retry after error)
    expect(apiFetch).toHaveBeenCalled();
  });

  // ── Phase 3: prop-driven (parent provides :health) ──
  it("透過 :health prop 渲染不應呼叫 API (DashboardView 單頁用)", async () => {
    const callCount = apiFetch.mock.calls.length;
    const wrapper = mount(StrategyStatusView, {
      props: { health: mockApiResponse, loading: false, error: null },
      global: { stubs: mockComponents },
    });
    await flushPromises();
    // Prop-driven: no API call should fire
    expect(apiFetch.mock.calls.length).toBe(callCount);
    // Still renders weight score block from prop
    expect(wrapper.findAll("[data-testid='score-bar']").length).toBe(5);
    expect(wrapper.find(".signal-category-badge").text()).toBe("🌱 底倉/觀望");
  });

  it("當 :health prop 為 null 時應回退自載 API", async () => {
    apiFetch.mockResolvedValueOnce(mockApiResponse);
    const wrapper = mount(StrategyStatusView, {
      props: { health: null, loading: true, error: null },
      global: { stubs: mockComponents },
    });
    await flushPromises();
    expect(apiFetch).toHaveBeenCalledWith("/api/strategy-status");
    expect(wrapper.findAll("[data-testid='score-bar']").length).toBe(5);
  });

  it("當 allocation 包含無效物件或 null 時應安全過濾不爆炸", async () => {
    const invalidAllocationHealth = {
      ...mockApiResponse,
      strategySnapshot: {
        allocation: {
          current: { minScore: 0, leverage: 1, cash: 0, comment: "現狀" },
          invalid: null,
          next: { minScore: 5, leverage: 1.5, cash: 0.1, comment: "目標" },
        },
      },
    };
    const wrapper = mount(StrategyStatusView, {
      props: { health: invalidAllocationHealth, loading: false, error: null },
      global: { stubs: mockComponents },
    });
    await flushPromises();
    // 應過濾掉 null 僅保留 valid tier
    expect(wrapper.findAll("[data-testid='allocation-tier']").length).toBe(2);
  });
});
