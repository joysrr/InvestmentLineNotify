import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ChartView from "../views/ChartView.vue";
import {
  fetchSnapshots,
  fetchSnapshotsWeekly,
  fetchSnapshotsMonthly,
} from "../api/index.js";

vi.mock("../api/index.js", () => ({
  fetchSnapshots: vi.fn(),
  fetchSnapshotsWeekly: vi.fn(),
  fetchSnapshotsMonthly: vi.fn(),
}));
vi.mock("vue-echarts", () => ({
  default: {
    name: "mock-chart",
    template: '<div class="mock-chart" />',
    props: ["option"],
  },
}));
vi.mock("echarts/core", () => ({ use: vi.fn() }));
vi.mock("echarts/charts", () => ({ LineChart: {} }));
vi.mock("echarts/components", () => ({
  TitleComponent: {},
  TooltipComponent: {},
  GridComponent: {},
  MarkLineComponent: {},
  LegendComponent: {},
}));
vi.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));

const mountView = () => mount(ChartView);
const snapshot = (date = "2026-08-17") => ({
  date,
  netValueMarket: 100000,
  price0050: 180,
  priceZ2: 10,
  totalLoan: 20000,
  qty0050: 10,
  qtyZ2: 5,
});

describe("ChartView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("daily API 應排序並顯示圖表摘要", async () => {
    fetchSnapshots.mockResolvedValue({
      hasEncryption: true,
      snapshots: [snapshot("2026-08-16"), snapshot("2026-08-17")],
    });
    const wrapper = mountView();
    await flushPromises();
    expect(fetchSnapshots).toHaveBeenCalledWith(90);
    expect(wrapper.find(".chart-wrapper").exists()).toBe(true);
    expect(wrapper.find(".view-subtitle").text()).toContain("日 90");
    expect(wrapper.findAll(".summary-card")).toHaveLength(4);
  });

  it("encryption disabled 應顯示提示", async () => {
    fetchSnapshots.mockResolvedValue({ hasEncryption: false, snapshots: [] });
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("快照功能未啟用");
  });

  it("空快照應顯示 empty state", async () => {
    fetchSnapshots.mockResolvedValue({ hasEncryption: true, snapshots: [] });
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("尚無快照資料");
  });

  it("weekly 與 monthly 應支援 array response", async () => {
    fetchSnapshots.mockResolvedValue({ hasEncryption: true, snapshots: [] });
    fetchSnapshotsWeekly.mockResolvedValue([snapshot("2026-08-16")]);
    fetchSnapshotsMonthly.mockResolvedValue([snapshot("2026-08-01")]);
    const wrapper = mountView();
    await flushPromises();

    await wrapper.findAll(".seg-btn")[1].trigger("click");
    await flushPromises();
    expect(fetchSnapshotsWeekly).toHaveBeenCalledWith(52);
    expect(wrapper.find(".chart-wrapper").exists()).toBe(true);

    await wrapper.findAll(".seg-btn")[2].trigger("click");
    await flushPromises();
    expect(fetchSnapshotsMonthly).toHaveBeenCalledWith(120);
  });

  it("weekly object 與 monthly object 應使用 snapshots fallback", async () => {
    fetchSnapshots.mockResolvedValue({ hasEncryption: true, snapshots: [] });
    fetchSnapshotsWeekly.mockResolvedValue({
      hasEncryption: true,
      snapshots: [snapshot()],
    });
    fetchSnapshotsMonthly.mockResolvedValue({
      hasEncryption: false,
      snapshots: [],
    });
    const wrapper = mountView();
    await flushPromises();

    await wrapper.findAll(".seg-btn")[1].trigger("click");
    await flushPromises();
    await wrapper.findAll(".seg-btn")[2].trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("快照功能未啟用");
  });

  it("切換指標應更新 chart option 與 tooltip 格式", async () => {
    fetchSnapshots.mockResolvedValue({
      hasEncryption: true,
      snapshots: [snapshot()],
    });
    const wrapper = mountView();
    await flushPromises();

    const chart = wrapper.findComponent({ name: "mock-chart" });
    const totalLoanChip = wrapper.findAll(".metric-chip")[3];
    await totalLoanChip.trigger("click");
    await flushPromises();

    const loanOption = chart.props("option");
    expect(loanOption.series[0].lineStyle.color).toBe("#e84855");
    expect(loanOption.tooltip.formatter([{ dataIndex: 0 }])).toContain("融資");

    const qtyChip = wrapper.findAll(".metric-chip")[1];
    await qtyChip.trigger("click");
    await flushPromises();
    const qtyOption = chart.props("option");
    expect(qtyOption.series[0].lineStyle.color).toBe("#26a17b");
    expect(qtyOption.tooltip.formatter([{ dataIndex: 0 }])).toContain("股");
  });

  it("應格式化金額、數量與空值軸標籤", async () => {
    fetchSnapshots.mockResolvedValue({
      hasEncryption: true,
      snapshots: [snapshot()],
    });
    const wrapper = mountView();
    await flushPromises();

    const chart = wrapper.findComponent({ name: "mock-chart" });
    const axisFormatter = chart.props("option").yAxis.axisLabel.formatter;
    expect(axisFormatter(100000)).toContain("萬");
    expect(axisFormatter(null)).toBe("—");

    await wrapper.findAll(".metric-chip")[1].trigger("click");
    await flushPromises();
    const quantityFormatter = chart.props("option").yAxis.axisLabel.formatter;
    expect(quantityFormatter(5)).toContain("股");

    await wrapper.findAll(".metric-chip")[3].trigger("click");
    await flushPromises();
    const loanFormatter = chart.props("option").yAxis.axisLabel.formatter;
    expect(loanFormatter(5)).toContain("$5");
  });

  it("weekly 與 monthly tooltip 應使用 period label", async () => {
    fetchSnapshots.mockResolvedValue({ hasEncryption: true, snapshots: [] });
    fetchSnapshotsWeekly.mockResolvedValue([
      {
        endDate: "2026-08-16",
        startDate: "2026-08-10",
        period: "W33",
        netValueMarket: 1,
      },
    ]);
    fetchSnapshotsMonthly.mockResolvedValue([
      {
        endDate: "2026-08-01",
        startDate: "2026-08-01",
        period: "2026-08",
        netValueMarket: 1,
      },
    ]);
    const wrapper = mountView();
    await flushPromises();

    await wrapper.findAll(".seg-btn")[1].trigger("click");
    await flushPromises();
    const chart = wrapper.findComponent({ name: "mock-chart" });
    expect(
      chart.props("option").tooltip.formatter([{ dataIndex: 0 }]),
    ).toContain("2026-08-10");

    const monthlyButton = wrapper
      .findAll(".seg-btn")
      .find((button) => button.text() === "月 120");
    await monthlyButton.trigger("click");
    await nextTick();
    await flushPromises();
    await nextTick();
    expect(fetchSnapshotsMonthly).toHaveBeenCalledWith(120);
    expect(wrapper.find(".seg-btn.active").text()).toBe("月 120");
  });

  it("API 失敗應顯示錯誤並可重試", async () => {
    fetchSnapshots.mockRejectedValueOnce(new Error("snapshot unavailable"));
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find(".state-error").text()).toContain(
      "snapshot unavailable",
    );
    fetchSnapshots.mockResolvedValueOnce({
      hasEncryption: true,
      snapshots: [],
    });
    await wrapper.find(".retry-btn").trigger("click");
    await flushPromises();
    expect(fetchSnapshots).toHaveBeenCalledTimes(2);
  });
});

// Focus on observable state transitions; ECharts rendering is mocked.
