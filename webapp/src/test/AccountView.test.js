import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AccountView from "../views/AccountView.vue";
import {
  fetchDataEvidenceReport,
  fetchStatus,
  fetchReports,
} from "../api/index.js";

const snapshotState = vi.hoisted(() => {
  const fakeRef = (value) => ({
    __v_isRef: true,
    get value() {
      return this._value;
    },
    set value(next) {
      this._value = next;
    },
    _value: value,
  });
  return {
    latestSnapshot: fakeRef(null),
    hasEncryption: fakeRef(true),
    load: vi.fn(),
  };
});

vi.mock("../api/index.js", () => ({
  fetchDataEvidenceReport: vi.fn(),
  fetchStatus: vi.fn(),
  fetchReports: vi.fn(),
}));
vi.mock("../composables/usePortfolioSnapshots.js", () => ({
  usePortfolioSnapshots: () => snapshotState,
}));
vi.mock("../composables/useTelegram.js", () => ({
  waitReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../components/common/DeploymentControl.vue", () => ({
  default: {
    template: '<section data-testid="deployment-control" />',
  },
}));
vi.mock("vue-echarts", () => ({
  default: { template: '<div class="mock-chart" />', props: ["option"] },
}));
vi.mock("echarts/core", () => ({ use: vi.fn() }));
vi.mock("echarts/charts", () => ({ LineChart: {}, GaugeChart: {} }));
vi.mock("echarts/components", () => ({
  TitleComponent: {},
  TooltipComponent: {},
  GridComponent: {},
}));
vi.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));

const status = {
  _meta: {
    lastRun: "2026-08-17T08:00:00Z",
    sources: {
      cnnFearGreed: { status: "SUCCESS", lastFetch: "2026-08-17T07:00:00Z" },
      marginKgi: { status: "FAILED", error: "provider failed" },
    },
  },
  data: {
    rawCnn: { score: 20, rating: "Fear" },
    rawFx: { currentRate: 32.1, changePercent: -0.5 },
  },
};
const reports = [
  {
    date: "2026-08-17",
    signals: {
      valuationGuardResult: { currentPR: 40 },
      grossLeverage: 1.8,
      maintenanceMargin: 165,
    },
  },
];

const mountView = () =>
  mount(AccountView, {
    global: {
      stubs: {
        "router-link": {
          template: '<a :href="to"><slot /></a>',
          props: ["to"],
        },
      },
    },
  });

describe("AccountView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotState.latestSnapshot.value = null;
    snapshotState.hasEncryption.value = true;
    fetchStatus.mockResolvedValue(status);
    fetchReports.mockResolvedValue(reports);
    fetchDataEvidenceReport.mockResolvedValue({
      verificationScope: "persisted evidence only",
      generatedAt: "2026-10-21T00:00:00Z",
      items: [{ field: "test.field" }],
    });
  });

  it("應在帳戶設定頁顯示部署控制，且位於資料證據之前", async () => {
    const wrapper = mountView();
    await flushPromises();
    const deployment = wrapper.find('[data-testid="deployment-control"]');
    const evidence = wrapper.find('[data-testid="data-evidence-card"]');
    expect(deployment.exists()).toBe(true);
    expect(
      deployment.element.compareDocumentPosition(evidence.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("應在設定與帳戶頁顯示資料證據卡", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find('[data-testid="data-evidence-card"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("資料證據");
  });

  it("應載入系統狀態並顯示來源健康度", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(fetchStatus).toHaveBeenCalledOnce();
    expect(fetchReports).toHaveBeenCalledWith(30);
    expect(wrapper.text()).toContain("系統狀態");
    expect(wrapper.text()).toContain("CNN 恐懼貪婪");
    await wrapper.find(".toggle-btn").trigger("click");
    expect(wrapper.text()).toContain("provider failed");
  });

  it("API 失敗時應顯示錯誤並可重試", async () => {
    fetchStatus.mockRejectedValueOnce(new Error("status unavailable"));
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find(".error-state").exists()).toBe(true);
    fetchStatus.mockResolvedValueOnce(status);
    await wrapper.find(".retry-btn").trigger("click");
    await flushPromises();
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  it("快照未啟用時應顯示 encryption notice", async () => {
    snapshotState.hasEncryption.value = false;
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("尚未啟用帳戶快照");
  });

  it("有加密但無快照時應顯示 empty notice", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("尚無快照資料");
  });

  it("有快照時應顯示帳戶數據", async () => {
    snapshotState.latestSnapshot.value = {
      date: "2026-08-17",
      qty0050: 100,
      qtyZ2: 20,
      totalLoan: 500000,
      cash: 120000,
      avgCost0050: 180.5,
      avgCostZ2: 10.25,
      lastBuyDate: "2026-08-16",
    };
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("2026-08-17 快照");
    expect(wrapper.text()).toContain("最後買進日：2026-08-16");
    expect(wrapper.findAll(".snapshot-card").length).toBeGreaterThanOrEqual(6);
  });

  it("應包含連結至 /chart 的資產趨勢圖表按鈕", async () => {
    const wrapper = mountView();
    await flushPromises();
    const btn = wrapper.find(".chart-link-btn");
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("href")).toBe("/chart");
    expect(btn.text()).toContain("資產趨勢圖表");
  });
});

// ECharts rendering is mocked; tests focus on observable state.
