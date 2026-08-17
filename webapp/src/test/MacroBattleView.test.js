import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import MacroBattleView from "../views/MacroBattleView.vue";
import { fetchReports } from "../api/index.js";

vi.mock("../api/index.js", () => ({
  fetchReports: vi.fn(),
}));

vi.mock("../composables/useTelegram.js", () => ({
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

const mountView = () => mount(MacroBattleView);

describe("MacroBattleView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("載入無資料時應顯示 empty state", async () => {
    fetchReports.mockResolvedValue([]);
    const wrapper = mountView();

    await flushPromises();

    expect(fetchReports).toHaveBeenCalledWith(3);
    expect(wrapper.find(".inline-hint").exists()).toBe(true);
    expect(wrapper.find(".direction-badge").exists()).toBe(false);
  });

  it("API 失敗時應顯示 error state", async () => {
    fetchReports.mockRejectedValueOnce(new Error("service unavailable"));
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.find(".inline-error").exists()).toBe(true);
    expect(wrapper.find(".skeleton-wrap").exists()).toBe(false);
  });

  it("應排序報告並顯示 bullish、bearish、neutral 事件", async () => {
    fetchReports.mockResolvedValue([
      {
        date: "2026-08-16",
        macroAnalysis: {
          total_bull_score: 4,
          total_bear_score: 2,
          conclusion: {
            market_direction: "BEARISH",
            short_summary: "空方略佔優",
            key_takeaways: ["利率上升"],
          },
          bull_events: [{ score: 2, event: "多方事件", analysis: "支撐" }],
          bear_events: [{ score: 3, event: "空方事件", analysis: "壓力" }],
          neutral_events: [{ score: 0, event: "中性事件", analysis: "觀察" }],
        },
      },
      {
        date: "2026-08-17",
        macroAnalysis: {
          bullish: 6,
          bearish: 1,
          conclusion: {
            market_direction: "BULLISH",
            short_summary: "多方略佔優",
            key_takeaways: ["流動性改善"],
          },
          bull_events: [{ score: 3, event: "最新多方事件", analysis: "支撐" }],
          bear_events: [{ score: 1, event: "最新空方事件", analysis: "壓力" }],
          neutral_events: [
            { score: 0, event: "最新中性事件", analysis: "觀察" },
          ],
        },
      },
    ]);
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.find(".page-date").text()).toBe("2026-08-17");
    expect(wrapper.find(".direction-badge").text()).toContain("多頭偏強");
    expect(wrapper.findAll(".score-num").map((node) => node.text())).toEqual([
      "6",
      "1",
    ]);
    expect(wrapper.find(".takeaway-list").exists()).toBe(true);
    expect(wrapper.findAll(".event-card")).toHaveLength(3);
  });
});
