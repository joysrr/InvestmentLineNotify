import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ReportsView from "../views/ReportsView.vue";
import * as api from "../api/index.js";

// Mock API 模組
vi.mock("../api/index.js", () => ({
  fetchReports: vi.fn(),
  fetchWeeklyReports: vi.fn(),
  fetchMonthlyReports: vi.fn(),
}));

vi.mock("../composables/useTelegram.js", () => ({
  useTelegram: () => ({}),
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

describe("ReportsView.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始載入時應呼叫 fetchReports 並渲染清單", async () => {
    const mockData = [
      {
        date: "2026-04-25",
        signals: {
          marketStatus: "穩定",
          targetSuggestion: "維持持倉",
          priceChangePercentText: "0.5",
          weightScore: 80,
        },
        ai: { action_items: ["繼續觀測"] },
      },
    ];

    api.fetchReports.mockResolvedValue(mockData);

    const wrapper = mount(ReportsView);

    // 等待非同步資料載入與 DOM 更新 (包含 waitReady)
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
    await nextTick(); // 多等一次確保 state 更新

    expect(api.fetchReports).toHaveBeenCalledWith(30);

    const cards = wrapper.findAll(".report-card");
    expect(cards.length).toBe(1);
    expect(wrapper.text()).toContain("2026-04-25");
    expect(wrapper.text()).toContain("穩定");
  });

  it("點擊 Tab 應切換資料來源", async () => {
    api.fetchReports.mockResolvedValue([]);
    api.fetchWeeklyReports.mockResolvedValue([]);

    const wrapper = mount(ReportsView);
    await nextTick();

    const buttons = wrapper.findAll(".tab-btn");
    const weeklyTab = buttons.find((b) => b.text() === "週報");

    await weeklyTab.trigger("click");

    expect(api.fetchWeeklyReports).toHaveBeenCalled();
  });

  it("點擊月報 Tab 應載入月報資料", async () => {
    api.fetchReports.mockResolvedValue([]);
    api.fetchMonthlyReports.mockResolvedValue([
      { period: "2026-04", summary: "月報摘要" },
    ]);

    const wrapper = mount(ReportsView);
    await nextTick();

    const monthlyTab = wrapper
      .findAll(".tab-btn")
      .find((button) => button.text() === "月報");
    await monthlyTab.trigger("click");
    await nextTick();

    expect(api.fetchMonthlyReports).toHaveBeenCalledWith(12);
    expect(wrapper.text()).toContain("2026 年4月");
  });

  it("API 失敗時應顯示錯誤並可重試", async () => {
    api.fetchReports.mockRejectedValueOnce(new Error("reports unavailable"));
    const wrapper = mount(ReportsView);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();

    expect(wrapper.find(".state-error").text()).toContain(
      "reports unavailable",
    );

    api.fetchReports.mockResolvedValueOnce([]);
    await wrapper.find(".retry-btn").trigger("click");
    await nextTick();

    expect(api.fetchReports).toHaveBeenCalledTimes(2);
  });

  it("點擊「科學回測」分頁不應崩潰且應顯示回測大數據內容", async () => {
    api.fetchReports.mockResolvedValue([]);
    const wrapper = mount(ReportsView);
    await nextTick();

    const buttons = wrapper.findAll(".tab-btn");
    const disciplineTab = buttons.find((b) => b.text() === "科學回測");
    expect(disciplineTab).toBeDefined();

    // 觸發點擊，切至科學回測頁籤
    await disciplineTab.trigger("click");
    await nextTick();

    // 驗證內容已正確呼叫渲染而且完全沒有出錯
    expect(wrapper.text()).toContain("隨波逐流減倉 50%");
    expect(wrapper.text()).toContain("4,620 萬");
    expect(wrapper.find(".discipline-container").exists()).toBe(true);
  });
});
