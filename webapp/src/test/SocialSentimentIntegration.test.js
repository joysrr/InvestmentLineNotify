import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import SocialSentimentCard from "@/components/macro/SocialSentimentCard.vue";
import MacroBattleView from "@/views/MacroBattleView.vue";
import { fetchReports, fetchSocialSentiment } from "@/api/index.js";
import { flushPromises } from "@vue/test-utils";

vi.mock("@/api/index.js", () => ({
  fetchReports: vi.fn(),
  fetchSocialSentiment: vi.fn(),
}));

vi.mock("@/composables/useTelegram.js", () => ({
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

describe("Phase 3: Social Sentiment UI Integration", () => {
  describe("SocialSentimentCard 單元測試", () => {
    it("應渲染情緒分數、3D/7D MA 與背離標籤", () => {
      const wrapper = mount(SocialSentimentCard, {
        props: {
          sentiment: {
            date: "2026-09-12",
            score: 72.5,
            ma3: 68.0,
            ma7: 64.2,
            divergenceStatus: "NONE",
            signals: ["HIGH_VOLATILITY"],
            hotTopics: [
              {
                title: "台股今日情緒指數回升",
                source: "PTT",
                sentiment: "BULL",
                url: "https://www.ptt.cc/bbs/Stock/M.12345.html",
              },
            ],
          },
        },
      });

      expect(wrapper.find(".score-value").text()).toContain("72.5");
      expect(wrapper.findAll(".ma-value")[0].text()).toContain("68");
      expect(wrapper.findAll(".ma-value")[1].text()).toContain("64");
      expect(wrapper.find(".sentiment-divergence").text()).toContain("正常");
    });

    it("應在 BEARISH_DIVERGENCE 時顯示警示徽章與琥珀色背景", () => {
      const wrapper = mount(SocialSentimentCard, {
        props: {
          sentiment: {
            date: "2026-09-12",
            score: 85.0,
            ma3: 64.2,
            ma7: 58.8,
            divergenceStatus: "BEARISH_DIVERGENCE",
            signals: ["GOLDEN_CROSS"],
            hotTopics: [],
          },
        },
      });

      const badge = wrapper.find(".sentiment-divergence");
      expect(badge.classes()).toContain("divergence-bearish");
      expect(badge.text()).toContain("散戶過熱背離");
    });

    it("應渲染 2 則焦點貼文與跳出原站連結", () => {
      const wrapper = mount(SocialSentimentCard, {
        props: {
          sentiment: {
            date: "2026-09-12",
            score: 65.0,
            ma3: 62.0,
            ma7: 59.0,
            divergenceStatus: "NONE",
            signals: [],
            hotTopics: [
              {
                title: "PTT 熱議：0050 今日成交量激增",
                source: "PTT",
                sentiment: "BULL",
                url: "https://www.ptt.cc/bbs/Stock/M.111.html",
              },
              {
                title: "Bluesky 用戶分析月線形狀",
                source: "Bluesky",
                sentiment: "NEUTRAL",
                url: "https://bsky.app/profile/xyz",
              },
            ],
          },
        },
      });

      const links = wrapper.findAll(".hot-topic-link");
      expect(links).toHaveLength(2);
      expect(links[0].attributes("href")).toBe(
        "https://www.ptt.cc/bbs/Stock/M.111.html",
      );
    });

    it("應在情緒資料缺失時顯示 graceful fallback", () => {
      const wrapper = mount(SocialSentimentCard, {
        props: {
          sentiment: null,
        },
      });

      expect(wrapper.find(".sentiment-fallback").exists()).toBe(true);
    });
  });

  describe("MacroBattleView 整合測試", () => {
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

    beforeEach(() => {
      vi.clearAllMocks();
      fetchSocialSentiment.mockResolvedValue(null);
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

      expect(
        wrapper.find('[data-testid="social-sentiment-card"]').exists(),
      ).toBe(true);
    });

    it("應在社群情緒資料缺失時優雅降級為 fallback", async () => {
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
      fetchSocialSentiment.mockRejectedValue(new Error("API error"));

      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find(".sentiment-fallback").exists()).toBe(true);
    });
  });
});
