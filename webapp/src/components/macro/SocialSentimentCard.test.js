import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SocialSentimentCard from "./SocialSentimentCard.vue";

const baseProps = {
  sentiment: {
    score: 65,
    label: "中性偏多",
    scoreLabel: "中性",
    ma3: 60,
    ma7: 58,
    trend: "穩定",
    divergenceText: "無明顯背離",
    divergenceDetail: "情緒與價格同步",
    divergenceStatus: "NONE",
    sampleCount: 75,
    pttItems: 45,
    bskyItems: 30,
    updatedAt: "2026-11-13T09:00:00+08:00",
    signals: ["強勢上漲", "成交量擴大"],
    hotTopics: [
      {
        source: "PTT",
        title: "台股多頭延續",
        url: "https://www.ptt.cc/bbs/Stock/M.1234567890.A.001.html",
        sentiment: "BULL",
      },
      {
        source: "Bluesky",
        title: "0050 吸籌跡象",
        url: null,
        sentiment: "NEUTRAL",
      },
    ],
  },
};

describe("SocialSentimentCard.vue", () => {
  it("外層包含 ContentCard (variant=outlined, padding=md, radius=lg)", () => {
    const wrapper = mount(SocialSentimentCard, { props: baseProps });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].props("variant")).toBe("outlined");
    expect(cards[0].props("padding")).toBe("md");
    expect(cards[0].props("radius")).toBe("lg");
  });

  it("顯示社群情緒標題", () => {
    const wrapper = mount(SocialSentimentCard, { props: baseProps });
    expect(wrapper.text()).toContain("社群情緒觀察");
  });

  it("顯示情緒分數", () => {
    const wrapper = mount(SocialSentimentCard, { props: baseProps });
    expect(wrapper.text()).toContain("65");
  });

  it("顯示更新時間", () => {
    const wrapper = mount(SocialSentimentCard, { props: baseProps });
    expect(wrapper.text()).toContain("2026/11/13");
  });

  it("顯示樣本數", () => {
    const wrapper = mount(SocialSentimentCard, { props: baseProps });
    expect(wrapper.text()).toContain("75");
  });

  it("顯示熱門話題標題", () => {
    const wrapper = mount(SocialSentimentCard, { props: baseProps });
    expect(wrapper.text()).toContain("台股多頭延續");
  });
});
