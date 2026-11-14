import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import TechnicalView from "../views/TechnicalView.vue";
import StatCard from "@/components/common/StatCard.vue";
import { fetchReports } from "../api/index.js";

vi.mock("../api/index.js", () => ({ fetchReports: vi.fn() }));
vi.mock("../composables/useTelegram.js", () => ({
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

const mountView = () =>
  mount(TechnicalView, {
    global: { mocks: { $router: { push: vi.fn() } } },
  });

const report = {
  signals: {
    RSI: 82,
    KD_K: 18,
    KD_D: 22,
    bias240: -3.5,
    macdSignal: { signal: "bullish", description: "MACD 金叉" },
    reversal: {
      triggeredCount: 3,
      totalFactor: 4,
      rsiDrop: true,
      kdDrop: true,
      kdBearCross: false,
      macdBearCross: true,
    },
    sellSignals: {
      signalCount: 2,
      total: 3,
      flags: {
        rsiOverbought: true,
        kdOverbought: true,
        macdDeadCross: false,
      },
    },
    strategy: {
      threshold: { rsiReversalLevel: 60, kReversalLevel: 75 },
      sell: { rsi: { overbought: 75 }, kd: { overboughtK: 80 } },
    },
  },
};

describe("TechnicalView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchReports.mockResolvedValue([report]);
  });

  it("無報告資料時應顯示 empty state", async () => {
    fetchReports.mockResolvedValueOnce([]);
    const wrapper = mountView();

    await flushPromises();

    expect(fetchReports).toHaveBeenCalledWith(1);
    expect(wrapper.text()).toContain("尚無指標數據");
  });

  it("應顯示指標、MACD 與風險訊號", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.findAllComponents(StatCard)).toHaveLength(5);
    expect(wrapper.text()).toContain("過熱");
    expect(wrapper.text()).toContain("超賣");
    expect(wrapper.text()).toContain("多頭");
    expect(wrapper.text()).toContain("近期轉弱");
    expect(wrapper.text()).toContain("3 / 4");
    expect(wrapper.text()).toContain("2 / 3");
    expect(wrapper.text()).toContain("已觸發");
  });

  it("API 失敗後應結束 loading 並顯示 empty state", async () => {
    fetchReports.mockRejectedValueOnce(new Error("technical unavailable"));
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.find(".loading-state").exists()).toBe(false);
    expect(wrapper.text()).toContain("尚無指標數據");
  });

  it("缺少指標時應顯示中性 fallback", async () => {
    fetchReports.mockResolvedValueOnce([{ signals: {} }]);
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.text()).toContain("—");
    expect(wrapper.text()).toContain("未發生");
    expect(wrapper.text()).toContain("0 / 4");
    expect(wrapper.text()).toContain("0 / 3");
  });

  it("應支援收合與展開風險訊號詳細內容", async () => {
    const wrapper = mountView();
    await flushPromises();

    // 兩個 CollapsibleSection 預設展開 (reversalExpanded = sellExpanded = true)
    expect(wrapper.findAll(".collapsible-content")).toHaveLength(2);

    // 點擊第一個 header 收合
    await wrapper.findAll(".collapsible-header")[0].trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".collapsible-content")).toHaveLength(1);

    // 點擊第二個 header 收合
    await wrapper.findAll(".collapsible-header")[1].trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".collapsible-content")).toHaveLength(0);
  });
});

// Tests focus on observable state; API and Telegram readiness are mocked.
