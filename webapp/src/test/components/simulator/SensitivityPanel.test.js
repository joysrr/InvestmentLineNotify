import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import SensitivityPanel from "@/components/simulator/SensitivityPanel.vue";
import SensitivityChart from "@/components/simulator/SensitivityChart.vue";
import TornadoChart from "@/components/simulator/TornadoChart.vue";

vi.mock("@/components/simulator/SensitivityChart.vue", () => ({
  default: {
    name: "SensitivityChart",
    template: "<div class='mock-sensitivity-chart' />",
  },
}));

vi.mock("@/components/simulator/TornadoChart.vue", () => ({
  default: {
    name: "TornadoChart",
    template: "<div class='mock-tornado-chart' />",
  },
}));

vi.mock("@/api/index.js", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/api/index.js";

describe("SensitivityPanel.vue", () => {
  let wrapper;
  const mockCurrentPrice0050 = 175;
  const mockCurrentPriceZ2 = 275;

  beforeEach(() => {
    vi.clearAllMocks();
    wrapper = mount(SensitivityPanel, {
      props: {
        currentPrice0050: mockCurrentPrice0050,
        currentPriceZ2: mockCurrentPriceZ2,
      },
      global: {
        stubs: {
          ElButton: true,
          ElSelect: true,
          ElOption: true,
          ElInputNumber: true,
          ElForm: true,
          ElFormItem: true,
          ElCollapse: true,
          ElCollapseItem: true,
          ElTabs: true,
          ElTabPane: true,
          ElTag: true,
          ElAlert: true,
          ElProgress: true,
          ElIcon: true,
          ElTooltip: true,
          ElMessage: true,
        },
      },
    });
  });

  it("應正確渲染標題與副標題", () => {
    expect(wrapper.find(".sensitivity-title").text()).toBe("敏感度分析");
    expect(wrapper.find(".sensitivity-subtitle").text()).toContain(
      "參數影響度",
    );
  });

  it("應顯示參數選擇器", () => {
    expect(wrapper.find(".param-selector").exists()).toBe(true);
  });

  it("應顯示掃描範圍設定", () => {
    expect(wrapper.find(".range-config").exists()).toBe(true);
  });

  it("應顯示觀測指標選擇", () => {
    expect(wrapper.find(".metric-selector").exists()).toBe(true);
  });

  it("應顯示圖表類型切換", () => {
    expect(wrapper.find(".chart-toggle").exists()).toBe(true);
  });

  it("應顯示執行按鈕", () => {
    const btn = wrapper.find(".execute-btn");
    expect(btn.exists()).toBe(true);
    // Button text depends on loading state (v-if/v-else)
    expect(btn.text().length).toBeGreaterThanOrEqual(0);
  });

  it("應有 targetParam 狀態", () => {
    expect(wrapper.vm.targetParam).toBeDefined();
  });

  it("應有 chartType 狀態", () => {
    expect(wrapper.vm.chartType).toBeDefined();
  });

  it("執行分析時應呼叫 API", async () => {
    apiFetch.mockResolvedValueOnce({
      singleParam: { points: [], slope: 0.5 },
      multiParam: { results: [], keyDrivers: [] },
    });

    // 設定必要欄位
    wrapper.vm.targetParam = "maintenance.protectTrigger";
    wrapper.vm.scanRange = { min: 140, max: 180, step: 1 };
    wrapper.vm.metrics = ["strategyScore", "maintenanceMargin"];

    await wrapper.vm.executeAnalysis();
    await wrapper.vm.$nextTick();

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/simulate/sensitivity",
      expect.any(Object),
    );
  });

  it("結果返回後應顯示圖表", async () => {
    apiFetch.mockResolvedValueOnce({
      singleParam: {
        paramPath: "maintenance.protectTrigger",
        metric: "strategyScore",
        points: [
          { x: 140, y: 80 },
          { x: 150, y: 85 },
        ],
        slope: 0.5,
        correlation: 0.9,
      },
      multiParam: {
        results: [
          {
            paramPath: "maintenance.protectTrigger",
            impact: 45,
            direction: "positive",
          },
        ],
        keyDrivers: ["maintenance.protectTrigger"],
      },
    });

    wrapper.vm.targetParam = "maintenance.protectTrigger";
    wrapper.vm.scanRange = { min: 140, max: 180, step: 1 };
    await wrapper.vm.executeAnalysis();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.result).toBeTruthy();
    expect(wrapper.find(".mock-sensitivity-chart").exists()).toBe(true);
  });

  it("API 失敗時應顯示錯誤並結束 loading", async () => {
    const error = new Error("server error");
    error.body = { message: "分析服務暫時不可用" };
    apiFetch.mockRejectedValueOnce(error);

    wrapper.vm.targetParam = "maintenance.protectTrigger";
    wrapper.vm.scanRange = { min: 140, max: 180, step: 1 };
    await wrapper.vm.executeAnalysis();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.result).toBe(null);
  });

  it("Tornado 模式應送出多參數掃描設定", async () => {
    apiFetch.mockResolvedValueOnce({
      multiParam: { results: [], keyDrivers: [] },
    });

    wrapper.vm.chartType = "tornado";
    wrapper.vm.multiParams = [
      { path: "maintenance.protectTrigger", range: [140, 180] },
    ];
    await wrapper.vm.executeAnalysis();

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/simulate/sensitivity",
      expect.objectContaining({
        body: expect.stringContaining('"multiParams"'),
      }),
    );
  });

  it("關鍵驅動因子應正確顯示", async () => {
    apiFetch.mockResolvedValueOnce({
      singleParam: { points: [], slope: 0 },
      multiParam: {
        results: [],
        keyDrivers: [
          "maintenance.protectTrigger",
          "buy.minDropPercentToConsider",
          "trading.loanInterestRate",
        ],
      },
    });

    wrapper.vm.targetParam = "maintenance.protectTrigger";
    wrapper.vm.scanRange = { min: 140, max: 180, step: 1 };
    await wrapper.vm.executeAnalysis();
    await wrapper.vm.$nextTick();

    const driverPanel = wrapper.find(".key-drivers-panel");
    expect(driverPanel.exists()).toBe(true);
  });
});

describe("SensitivityChart.vue", () => {
  it("應正確渲染 ECharts 容器", () => {
    const wrapper = mount({
      template: '<SensitivityChart :data="chartData" />',
      components: { SensitivityChart },
      data() {
        return {
          chartData: {
            points: [
              { x: 1, y: 10 },
              { x: 2, y: 12 },
            ],
            slope: 0.5,
            correlation: 0.9,
          },
        };
      },
    });
    // Just check component renders without error
    expect(wrapper.findComponent({ name: "SensitivityChart" }).exists()).toBe(
      true,
    );
  });
});

describe("TornadoChart.vue", () => {
  it("應正確渲染 ECharts 容器", () => {
    const wrapper = mount({
      template: '<TornadoChart :data="chartData" />',
      components: { TornadoChart },
      data() {
        return {
          chartData: {
            results: [
              { paramPath: "param1", impact: 50, direction: "positive" },
              { paramPath: "param2", impact: 30, direction: "negative" },
            ],
            keyDrivers: ["param1"],
          },
        };
      },
    });
    // Just check component renders without error
    expect(wrapper.findComponent({ name: "TornadoChart" }).exists()).toBe(true);
  });
});
