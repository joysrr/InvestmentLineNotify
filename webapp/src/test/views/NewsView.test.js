import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import NewsView from "@/views/NewsView.vue";

const mockReportNews = {
  tw: [{ title: "精選新聞 1", source: "來源 A", pubDate: "2026-11-14" }],
  us: [],
  generatedAt: "2026-11-14T08:00:00Z",
};

const mockArticles = [
  { title: "新聞池新聞 1", source: "來源 B", pubDate: "2026-11-14" },
];

vi.mock("@/api/index.js", () => ({
  fetchReportNews: vi.fn(),
  fetchNews: vi.fn(),
}));

describe("NewsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初始顯示精選報告 tab", () => {
    const wrapper = mount(NewsView);
    expect(wrapper.find(".subtab-btn").text()).toContain("精選報告");
  });

  it("reportLoading=true 時顯示 LoadingSkeleton", () => {
    const wrapper = mount(NewsView, {
      data: () => ({ reportLoading: true, activeTab: "report" }),
    });
    expect(wrapper.findComponent({ name: "LoadingSkeleton" }).exists()).toBe(
      true,
    );
  });

  it("reportError 時顯示 ErrorAlert", () => {
    const wrapper = mount(NewsView, {
      data: () => ({ reportError: "載入失敗", activeTab: "report" }),
    });
    expect(wrapper.findComponent({ name: "ErrorAlert" }).exists()).toBe(true);
  });

  it("reportNews 空時顯示 EmptyState", () => {
    const wrapper = mount(NewsView, {
      data: () => ({
        reportNews: { tw: [], us: [], generatedAt: "" },
        reportLoading: false,
        reportError: null,
        activeTab: "report",
      }),
    });
    expect(wrapper.findComponent({ name: "EmptyState" }).exists()).toBe(true);
  });

  it("poolLoading=true 時顯示 LoadingSkeleton", () => {
    const wrapper = mount(NewsView, {
      data: () => ({ poolLoading: true, activeTab: "pool" }),
    });
    expect(wrapper.findComponent({ name: "LoadingSkeleton" }).exists()).toBe(
      true,
    );
  });

  it("poolError 時顯示 ErrorAlert", () => {
    const wrapper = mount(NewsView, {
      data: () => ({ poolError: "載入失敗", activeTab: "pool" }),
    });
    expect(wrapper.findComponent({ name: "ErrorAlert" }).exists()).toBe(true);
  });

  it("articles 空時顯示 EmptyState", () => {
    const wrapper = mount(NewsView, {
      data: () => ({
        articles: [],
        poolLoading: false,
        poolError: null,
        activeTab: "pool",
      }),
    });
    expect(wrapper.findComponent({ name: "EmptyState" }).exists()).toBe(true);
  });

  it("切換到新聞池 tab", async () => {
    const wrapper = mount(NewsView);
    const poolBtn = wrapper.findAll(".subtab-btn")[1];
    await poolBtn.trigger("click");
    expect(wrapper.vm.activeTab).toBe("pool");
  });
});
