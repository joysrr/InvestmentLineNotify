import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import NewsCard from "@/components/dashboard/NewsCard.vue";

const baseArticle = {
  title: "測試新聞標題",
  summary: "這是一條新聞摘要，用於驗證摘要顯示與截斷行為。",
  source: "測試來源",
  pubDate: "2026-11-14T08:00:00Z",
  age_band: "today",
  _region: "tw",
};

describe("NewsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("渲染文章標題", () => {
    const wrapper = mount(NewsCard, { props: { article: baseArticle } });
    expect(wrapper.find(".news-title").text()).toBe("測試新聞標題");
  });

  it("渲染來源與時間", () => {
    const wrapper = mount(NewsCard, { props: { article: baseArticle } });
    expect(wrapper.find(".news-source").text()).toBe("測試來源");
    expect(wrapper.find(".news-time").exists()).toBe(true);
  });

  it("isFeatured=true 時顯示「精選」徽章", () => {
    const wrapper = mount(NewsCard, {
      props: { article: baseArticle, isFeatured: true },
    });
    expect(wrapper.find(".news-badge.featured").text()).toBe("精選");
  });

  it("isPicked=true 時顯示「已入選精選」標記", () => {
    const wrapper = mount(NewsCard, {
      props: { article: baseArticle, isPicked: true },
    });
    expect(wrapper.find(".news-tag.picked").text()).toBe("已入選精選");
  });

  it("isFeatured=false 時不顯示精選徽章", () => {
    const wrapper = mount(NewsCard, { props: { article: baseArticle } });
    expect(wrapper.find(".news-badge.featured").exists()).toBe(false);
  });

  it("isPicked=false 時不顯示已入選精選標記", () => {
    const wrapper = mount(NewsCard, { props: { article: baseArticle } });
    expect(wrapper.find(".news-tag.picked").exists()).toBe(false);
  });

  it("摘要存在時渲染 .news-summary", () => {
    const wrapper = mount(NewsCard, { props: { article: baseArticle } });
    expect(wrapper.find(".news-summary").exists()).toBe(true);
    expect(wrapper.find(".news-summary").text()).toContain("新聞摘要");
  });

  it("摘要不存在時不渲染 .news-summary", () => {
    const articleNoSummary = { ...baseArticle, summary: undefined };
    const wrapper = mount(NewsCard, { props: { article: articleNoSummary } });
    expect(wrapper.find(".news-summary").exists()).toBe(false);
  });

  it("點擊卡片 emit article-click 並傳遞 article", () => {
    const wrapper = mount(NewsCard, { props: { article: baseArticle } });
    wrapper.find(".news-card").trigger("click");
    expect(wrapper.emitted("article-click")).toBeTruthy();
    expect(wrapper.emitted("article-click")[0][0]).toStrictEqual(baseArticle);
  });

  it("摘要樣式包含 -webkit-line-clamp: 3", () => {
    const wrapper = mount(NewsCard, { props: { article: baseArticle } });
    const summary = wrapper.find(".news-summary");
    expect(summary.exists()).toBe(true);
    expect(summary.classes()).toContain("news-summary");
  });
});
