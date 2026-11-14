import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import NewsCard from "./NewsCard.vue";

const baseProps = {
  article: {
    id: "n1",
    title: "台股午評：0050 漲逾 1%",
    source: "鉅亨網",
    pubDate: "2026-11-14T09:30:00Z",
    summary: "0050 今日開高走高，成交額溫和放大。",
  },
};

describe("NewsCard.vue", () => {
  it("渲染標題、來源與發布時間", () => {
    const wrapper = mount(NewsCard, { props: baseProps });
    expect(wrapper.text()).toContain("台股午評：0050 漲逾 1%");
    expect(wrapper.text()).toContain("鉅亨網");
    expect(wrapper.text()).toContain("11/14");
  });

  it("無摘要時不顯示摘要區塊", () => {
    const wrapper = mount(NewsCard, {
      props: { article: { ...baseProps.article, summary: undefined } },
    });
    expect(wrapper.find(".news-summary").exists()).toBe(false);
  });

  it("有摘要時顯示摘要區塊", () => {
    const wrapper = mount(NewsCard, { props: baseProps });
    expect(wrapper.find(".news-summary").exists()).toBe(true);
    expect(wrapper.text()).toContain("0050 今日開高走高");
  });

  it("isFeatured 為 true 時在 news-header 顯示「精選」徽章", () => {
    const wrapper = mount(NewsCard, {
      props: { ...baseProps, isFeatured: true },
    });
    expect(wrapper.text()).toContain("精選");
  });

  it("isFeatured 未設定時不顯示「精選」徽章", () => {
    const wrapper = mount(NewsCard, { props: baseProps });
    expect(wrapper.text()).not.toContain("精選");
  });

  it("isPicked 為 true 時顯示「已入選精選」標記", () => {
    const wrapper = mount(NewsCard, {
      props: { ...baseProps, isPicked: true },
    });
    expect(wrapper.text()).toContain("已入選精選");
  });

  it("isPicked 未設定時不顯示「已入選精選」標記", () => {
    const wrapper = mount(NewsCard, { props: baseProps });
    expect(wrapper.text()).not.toContain("已入選精選");
  });

  it("點擊卡片 emit article-click，攜帶文章物件", () => {
    const wrapper = mount(NewsCard, { props: baseProps });
    wrapper.find(".news-card").trigger("click");
    const emitted = wrapper.emitted("article-click");
    expect(emitted).toHaveLength(1);
    expect(emitted[0][0]).toEqual(baseProps.article);
  });

  it("年齡帶為 fresh 時顯示 age-fresh 樣式與最新標籤", () => {
    const wrapper = mount(NewsCard, {
      props: {
        article: { ...baseProps.article, age_band: "fresh" },
        showAgeBand: true,
      },
    });
    expect(wrapper.find(".age-fresh").exists()).toBe(true);
    expect(wrapper.text()).toContain("最新");
  });

  it("年齡帶為 old 時顯示舊聞標籤", () => {
    const wrapper = mount(NewsCard, {
      props: {
        article: { ...baseProps.article, age_band: "old" },
        showAgeBand: true,
      },
    });
    expect(wrapper.text()).toContain("舊聞");
  });
});
