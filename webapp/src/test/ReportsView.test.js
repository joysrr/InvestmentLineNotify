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

    // 等待非同步資料載入與 DOM 更新
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
});
