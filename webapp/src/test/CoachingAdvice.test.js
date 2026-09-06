import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CoachingAdvice from "../components/dashboard/CoachingAdvice.vue";

describe("CoachingAdvice Component (Progressive Disclosure)", () => {
  const props = {
    report: { ai: {} },
    insight: "大盤 PB 4.01，嚴禁左側接刀",
    risks: ["風險 1", "風險 2"],
    actions: ["觀察 1"],
    mindset: ["微調 1"],
    thinking: "教練推演內容",
  };

  it("預設折疊詳細區塊，呈現極簡首屏與標籤數量", () => {
    const wrapper = mount(CoachingAdvice, { props });

    expect(wrapper.find(".insight-text").text()).toBe(
      "大盤 PB 4.01，嚴禁左側接刀",
    );
    expect(wrapper.find(".ai-list--risk").isVisible()).toBe(false);
    expect(wrapper.find(".ai-list--action").isVisible()).toBe(false);
  });

  it("點擊標頭後應滑出顯示詳細清單內容", async () => {
    const wrapper = mount(CoachingAdvice, { props });

    const riskHeader = wrapper.findAll(".ai-block-header")[0];
    await riskHeader.trigger("click");

    expect(wrapper.find(".ai-list--risk").isVisible()).toBe(true);
    expect(wrapper.findAll(".ai-list--risk li")).toHaveLength(2);
  });
});
