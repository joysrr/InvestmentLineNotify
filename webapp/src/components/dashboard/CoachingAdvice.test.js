import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CoachingAdvice from "./CoachingAdvice.vue";

const baseProps = {
  report: { ai: true },
  risks: ["風險 A", "風險 B"],
  actions: ["行動 A"],
  mindset: ["微調 A"],
  thinking: "教練推演內容",
  insight: "核心洞察內容",
  verdict: "謹慎",
};

describe("CoachingAdvice.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=md radius=lg", () => {
    const wrapper = mount(CoachingAdvice, { props: baseProps });
    const contentCard = wrapper.findComponent({ name: "ContentCard" });
    expect(contentCard.exists()).toBe(true);
    expect(contentCard.props("variant")).toBe("outlined");
    expect(contentCard.props("padding")).toBe("md");
    expect(contentCard.props("radius")).toBe("lg");
  });

  it("report.ai 為 false 時不渲染", () => {
    const wrapper = mount(CoachingAdvice, {
      props: { ...baseProps, report: { ai: false } },
    });
    expect(wrapper.find("section").exists()).toBe(false);
    expect(wrapper.find("div").exists()).toBe(false);
  });

  it("顯示 insight 與所有摺疊標題（預設收合）", () => {
    const wrapper = mount(CoachingAdvice, { props: baseProps });
    expect(wrapper.text()).toContain("核心洞察內容");
    expect(wrapper.text()).toContain("風險提示");
    expect(wrapper.text()).toContain("下一步觀察清單");
    expect(wrapper.text()).toContain("行動微調建議");
    expect(wrapper.text()).toContain("教練內心推演");
    // 預設收合，內容區塊不渲染到 DOM
    expect(wrapper.find(".ai-list--risk").exists()).toBe(false);
    expect(wrapper.find(".ai-thinking").exists()).toBe(false);
  });

  it("摺疊標題可點擊切換展開風險列表", async () => {
    const wrapper = mount(CoachingAdvice, { props: baseProps });
    const headers = wrapper.findAll(".collapsible-header");
    expect(headers.length).toBeGreaterThan(0);
    await headers[0].trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".ai-list--risk").exists()).toBe(true);
  });

  it("移除舊的 rgba(0,0,0,0.07) 硬編碼邊框", () => {
    const wrapper = mount(CoachingAdvice, { props: baseProps });
    expect(wrapper.find(".ai-block").exists()).toBe(true);
  });
});
