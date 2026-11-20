import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
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
  haptic: vi.fn(),
  useTelegram: vi.fn().mockReturnValue({
    tg: null,
    openLink: vi.fn(),
  }),
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
vi.mock("element-plus", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ElMessageBox: { confirm: vi.fn() },
  };
});

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

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/account", component: AccountView }],
});

const mountView = () =>
  mount(AccountView, {
    global: {
      plugins: [router],
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
    // 點擊「資料來源」的 CollapsibleSection 標題以展開
    const sourcesHeader = Array.from(
      wrapper.findAll(".collapsible-header"),
    ).find((h) => h.text().includes("資料來源"));
    await sourcesHeader.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("provider failed");
  });

  it("API 失敗時應顯示錯誤並可重試", async () => {
    fetchStatus.mockRejectedValueOnce(new Error("status unavailable"));
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find(".error-alert").exists()).toBe(true);
    fetchStatus.mockResolvedValueOnce(status);
    // 點擊 ErrorAlert 內的重試按鈕（錯誤狀態下不渲染 CollapsibleSection）
    await wrapper.find(".error-alert-actions button").trigger("click");
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

  it("缺少股數時顯示未知標記，真實 0 仍顯示 0", async () => {
    snapshotState.latestSnapshot.value = {
      date: "2026-08-17",
      qty0050: 0,
      totalLoan: 500000,
      cash: 120000,
    };
    const wrapper = mountView();
    await flushPromises();
    const values = wrapper
      .findAll(".snapshot-card")
      .map((card) => card.find(".snapshot-value").text());
    expect(values[0]).toBe("0");
    expect(values[1]).toBe("—");
  });

  it("應包含連結至 /chart 的資產趨勢圖表按鈕", async () => {
    const wrapper = mountView();
    await flushPromises();
    const btn = wrapper.find(".chart-link-btn");
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("href")).toBe("/chart");
    expect(btn.text()).toContain("資產趨勢圖表");
  });

  it("當 panel=about 時顯示「關於」面板", async () => {
    const aboutRouter = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/account", component: AccountView }],
    });
    await aboutRouter.push({ path: "/account", query: { panel: "about" } });
    const wrapper = mount(AccountView, {
      global: {
        plugins: [aboutRouter],
        stubs: {
          "router-link": {
            template: '<a :href="to"><slot /></a>',
            props: ["to"],
          },
        },
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("關於");
  });

  // ── CARD-5.5：設定項分組測試 ──
  it("應渲染 3 個 CollapsibleSection 設定分組：通知 / 策略 / 關於，外加 1 個 資料來源 分組", async () => {
    const wrapper = mountView();
    await flushPromises();
    const titles = wrapper.findAll(".collapsible-title").map((t) => t.text());
    expect(titles).toContain("通知設定");
    expect(titles).toContain("策略參數");
    expect(titles).toContain("關於");
    expect(titles).toContain("資料來源");
  });

  it("通知設定預設展開，包含 Telegram 開關與通知時段輸入", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("通知設定");
    expect(wrapper.text()).toContain("Telegram 通知開關");
    expect(wrapper.text()).toContain("通知時段（小時）");
  });

  it("儲存通知設定後顯示成功回饋訊息", async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.vm.saveNotificationSettings();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(wrapper.text()).toContain("通知設定已儲存");
  });

  it("關於面板位於 id=about 的 CollapsibleSection 內（展開後可見）", async () => {
    const wrapper = mountView();
    await flushPromises();
    // 點擊「關於」標題以展開
    const aboutHeader = Array.from(wrapper.findAll(".collapsible-header")).find(
      (h) => h.text().includes("關於"),
    );
    expect(aboutHeader.exists()).toBe(true);
    await aboutHeader.trigger("click");
    await flushPromises();
    const aboutSection = wrapper.find("#about");
    expect(aboutSection.exists()).toBe(true);
    expect(wrapper.text()).toContain("InvestmentLineNotify");
    expect(wrapper.text()).toContain("單一使用者投資監控與通知系統");
  });
});

// ECharts rendering is mocked; tests focus on observable state.
