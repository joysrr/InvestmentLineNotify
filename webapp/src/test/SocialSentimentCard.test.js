import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SocialSentimentCard from "@/components/macro/SocialSentimentCard.vue";

describe("SocialSentimentCard (TDD RED-GREEN)", () => {
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

  it("應顯示可追溯摘要並可開啟判斷依據", async () => {
    const wrapper = mount(SocialSentimentCard, {
      props: {
        sentiment: {
          date: "2026-09-18",
          updatedAt: "2026-09-18T00:05:14.000Z",
          score: 57,
          scoreLabel: "偏多",
          trend: "穩定",
          ma3: 56.7,
          ma7: 57,
          delta: -0.3,
          sampleCount: 42,
          pttItems: 30,
          bskyItems: 12,
          divergenceStatus: "NONE",
          divergenceDetail: "無背離現象",
          signals: [],
          hotTopics: [
            {
              title: "無連結話題",
              source: "PTT",
              sentiment: "NEUTRAL",
              url: "",
            },
          ],
        },
      },
    });

    expect(wrapper.find(".score-label").text()).toContain("偏多");
    expect(wrapper.text()).toContain("更新時間");
    expect(wrapper.text()).toContain("42 筆");
    expect(wrapper.text()).toContain("PTT 30");
    expect(wrapper.text()).toContain("Bluesky 12");
    expect(wrapper.text()).toContain("穩定");
    expect(wrapper.find(".hot-topic-link").exists()).toBe(false);

    await wrapper
      .find('[data-testid="sentiment-evidence-trigger"]')
      .trigger("click");

    expect(
      wrapper.find('[data-testid="sentiment-evidence-sheet"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="sentiment-evidence-sheet"]').text(),
    ).toContain("無背離現象");
    const sheetContent = wrapper.find(".evidence-sheet__content");
    expect(sheetContent.classes()).toContain(
      "evidence-sheet__content--nav-safe",
    );
    expect(sheetContent.attributes("data-nav-safe-area")).toBe("true");
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
