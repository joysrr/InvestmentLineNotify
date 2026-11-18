import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ContentCard from "@/components/common/ContentCard.vue";

describe("ContentCard — click 行為（子元素點擊應觸發）", () => {
  it("點擊卡片根元素應 emit click 事件", async () => {
    const wrapper = mount(ContentCard, {
      props: { clickable: true },
      slots: { default: "<div>內容</div>" },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("點擊卡片內部子元素亦應 emit click 事件（不受 .self 限制）", async () => {
    const wrapper = mount(ContentCard, {
      props: { clickable: true },
      slots: {
        default: '<span class="inner-text">點我</span>',
        header: '<span class="header-text">標題</span>',
      },
    });
    await wrapper.find(".inner-text").trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("點擊 header 內部子元素亦應 emit click 事件", async () => {
    const wrapper = mount(ContentCard, {
      props: { clickable: true },
      slots: {
        default: "<div>內容</div>",
        header: '<span class="header-text">標題</span>',
      },
    });
    await wrapper.find(".header-text").trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("非 clickable 卡片不應 emit click 事件", async () => {
    const wrapper = mount(ContentCard, {
      props: { clickable: false },
      slots: { default: "<div>內容</div>" },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeUndefined();
  });
});
