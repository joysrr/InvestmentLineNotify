import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import NewsView from "../views/NewsView.vue";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import { fetchNews, fetchReportNews } from "../api/index.js";

const openLink = vi.fn();

vi.mock("../api/index.js", () => ({
  fetchNews: vi.fn(),
  fetchReportNews: vi.fn(),
}));

vi.mock("../composables/useTelegram.js", () => ({
  useTelegram: () => ({ openLink }),
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

const mountView = () => mount(NewsView);

describe("NewsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("報告 API 回傳空資料時應顯示 empty state", async () => {
    fetchReportNews.mockResolvedValue({});
    const wrapper = mountView();

    await flushPromises();

    expect(fetchReportNews).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("今日精選報告尚未產生");
  });

  it("應顯示台灣與國際精選新聞", async () => {
    fetchReportNews.mockResolvedValue({
      tw: [
        {
          source: "TW News",
          title: "台灣市場新聞",
          summary: "摘要",
          pubDate: "2026-08-17T08:00:00Z",
          link: "https://example.com/tw",
        },
      ],
      us: [
        {
          source: "US News",
          title: "國際市場新聞",
          pubDate: "invalid date",
          url: "https://example.com/us",
        },
      ],
      generatedAt: "2026-08-17 08:00",
    });
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.findAll(".news-card")).toHaveLength(2);
    expect(wrapper.text()).toContain("台灣市場新聞");
    expect(wrapper.text()).toContain("國際市場新聞");
    expect(wrapper.text()).toContain("2026-08-17 08:00");

    await wrapper.find(".news-card").trigger("click");
    expect(openLink).toHaveBeenCalledWith("https://example.com/tw");
  });

  it("報告 API 失敗時應顯示錯誤並可重試", async () => {
    fetchReportNews.mockRejectedValueOnce(new Error("report unavailable"));
    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.findComponent(ErrorAlert).props("description")).toContain(
      "report unavailable",
    );

    fetchReportNews.mockResolvedValueOnce({});
    await wrapper.find(".error-alert-actions button").trigger("click");
    await flushPromises();

    expect(fetchReportNews).toHaveBeenCalledTimes(2);
  });

  it("切換新聞池應支援 array 與 articles response", async () => {
    fetchReportNews.mockResolvedValue({});
    fetchNews.mockResolvedValueOnce([
      {
        id: "array-1",
        age_band: "fresh",
        _region: "TW",
        source: "Pool News",
        title: "新聞池文章",
        pubDate: null,
        link: "https://example.com/pool",
      },
    ]);
    const wrapper = mountView();

    await flushPromises();
    await wrapper.findAll(".subtab-btn")[1].trigger("click");
    await flushPromises();

    expect(wrapper.find(".view-subtitle").text()).toContain("共 1 則");
    expect(wrapper.text()).toContain("新聞池文章");
    expect(wrapper.text()).toContain("🔴 最新");
    expect(wrapper.text()).toContain("🇹🇼");

    const objectWrapper = mountView();
    fetchReportNews.mockResolvedValueOnce({});
    fetchNews.mockResolvedValueOnce({
      articles: [
        {
          id: "object-1",
          age_band: "old",
          _region: "OTHER",
          source: "Other News",
          title: "其他新聞",
          pubDate: "bad date",
        },
      ],
    });
    await flushPromises();
    await objectWrapper.findAll(".subtab-btn")[1].trigger("click");
    await flushPromises();

    expect(objectWrapper.text()).toContain("其他新聞");
    expect(objectWrapper.text()).toContain("⚪ 舊聞");
    expect(objectWrapper.text()).toContain("🌐");
  });

  it("新聞池 API 失敗時應顯示錯誤", async () => {
    fetchReportNews.mockResolvedValue({});
    fetchNews.mockRejectedValueOnce(new Error("pool unavailable"));
    const wrapper = mountView();

    await flushPromises();
    await wrapper.findAll(".subtab-btn")[1].trigger("click");
    await flushPromises();

    expect(wrapper.findComponent(ErrorAlert).props("description")).toContain(
      "pool unavailable",
    );
  });
});

// Keep this file focused on observable UI behavior.
