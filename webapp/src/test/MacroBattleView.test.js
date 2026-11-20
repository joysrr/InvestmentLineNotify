import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import MacroBattleView from "../views/MacroBattleView.vue";
import Icon from "@/components/common/Icon.vue";
import { fetchReports, fetchSocialSentiment } from "../api/index.js";

vi.mock("../api/index.js", () => ({
  fetchReports: vi.fn(),
  fetchSocialSentiment: vi.fn(),
}));

vi.mock("../composables/useTelegram.js", () => ({
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

const mountView = () =>
  mount(MacroBattleView, {
    global: {
      stubs: {
        "router-link": {
          template: '<a :href="to"><slot /></a>',
          props: ["to"],
        },
      },
    },
  });

describe("MacroBattleView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSocialSentiment.mockResolvedValue(null); // default fallback
  });

  it("載入無資料時應顯示 empty state", async () => {
    fetchReports.mockResolvedValue([]);
    const wrapper = mountView();

    await flushPromises();

    expect(fetchReports).toHaveBeenCalledWith(3);
    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.find(".direction-badge").exists()).toBe(false);
  });

  it("API 失敗時應顯示 error state", async () => {
    fetchReports.mockRejectedValueOnce(new Error("service unavailable"));
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.find(".error-alert").exists()).toBe(true);
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
        date: "2026-08-17T01:30:00.000Z",
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

    expect(wrapper.find(".page-date").text()).toBe("2026-08-17 09:30");
    expect(wrapper.find(".direction-badge").text()).toContain("多頭偏強");
    expect(wrapper.findAll(".score-num").map((node) => node.text())).toEqual([
      "6",
      "1",
    ]);
    expect(wrapper.find(".takeaway-list").exists()).toBe(true);
    expect(wrapper.findAll(".event-card")).toHaveLength(3);
  });

  it("缺少報告日期時顯示未知標記", async () => {
    fetchReports.mockResolvedValue([
      {
        date: null,
        macroAnalysis: {
          total_bull_score: 0,
          total_bear_score: 0,
          conclusion: { market_direction: "NEUTRAL" },
          bull_events: [],
          bear_events: [],
          neutral_events: [],
        },
      },
    ]);
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find(".page-date").text()).toBe("—");
  });

  it("應移除跨頁子分頁列，改為返回膠囊", async () => {
    fetchReports.mockResolvedValue([]);
    const wrapper = mountView();
    await flushPromises();
    // P1-9：RadarSubtabs 已刪除，不應再有跨頁分頁列
    expect(wrapper.findAll(".iln-tab").length).toBe(0);
    // 改為返回「洞察 · 多空對決」膠囊
    const pill = wrapper.find('[data-testid="back-pill"]');
    expect(pill.exists()).toBe(true);
    expect(pill.text()).toContain("洞察 · 多空對決");
  });

  it("應在社群情緒資料就緒時渲染 SocialSentimentCard", async () => {
    fetchReports.mockResolvedValue([
      {
        date: "2026-09-12",
        macroAnalysis: {
          total_bull_score: 4,
          total_bear_score: 2,
          conclusion: {
            market_direction: "BULLISH",
            short_summary: "多頭優勢",
            key_takeaways: ["測試"],
          },
          bull_events: [],
          bear_events: [],
          neutral_events: [],
        },
      },
    ]);
    fetchSocialSentiment.mockResolvedValue({
      date: "2026-09-12",
      score: 72.5,
      ma3: 68.0,
      ma7: 64.2,
      divergenceStatus: "NONE",
      signals: [],
      hotTopics: [],
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find('[data-testid="social-sentiment-card"]').exists()).toBe(
      true,
    );
  });

  it("應渲染 .score-wrap 並包含 bull/bear 雙區塊", async () => {
    fetchReports.mockResolvedValue([
      {
        date: "2026-09-12",
        macroAnalysis: {
          total_bull_score: 4,
          total_bear_score: 2,
          conclusion: {
            market_direction: "BULLISH",
            short_summary: "多頭優勢",
            key_takeaways: ["測試"],
          },
          bull_events: [{ score: 2, event: "多方事件", analysis: "支撐" }],
          bear_events: [{ score: 3, event: "空方事件", analysis: "壓力" }],
          neutral_events: [],
        },
      },
    ]);
    const wrapper = mountView();
    await flushPromises();

    const scoreWrap = wrapper.find(".score-wrap");
    expect(scoreWrap.exists()).toBe(true);

    // bull/bear 都在 score-wrap 內
    expect(scoreWrap.find(".score-side--bull").exists()).toBe(true);
    expect(scoreWrap.find(".score-side--bear").exists()).toBe(true);
  });

  it("積分條佈局緊湊：score-wrap gap 6px、score-side 寬 30px、score-num 寬 20px", async () => {
    fetchReports.mockResolvedValue([
      {
        date: "2026-09-12",
        macroAnalysis: {
          total_bull_score: 4,
          total_bear_score: 2,
          conclusion: {
            market_direction: "BULLISH",
            short_summary: "多頭優勢",
            key_takeaways: [],
          },
          bull_events: [],
          bear_events: [],
          neutral_events: [],
        },
      },
    ]);
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find(".score-wrap").exists()).toBe(true);
    expect(wrapper.find(".score-side").exists()).toBe(true);
    expect(wrapper.find(".score-num").exists()).toBe(true);
  });
});
