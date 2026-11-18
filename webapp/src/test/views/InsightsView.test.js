import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import InsightsView from "@/views/InsightsView.vue";

vi.mock("@/views/MarketRadarView.vue", () => ({
  default: { template: '<div class="market-radar-stub" />' },
}));
vi.mock("@/views/MacroBattleView.vue", () => ({
  default: { template: '<div class="macro-battle-stub" />' },
}));

const stubs = {
  SegmentedControl: { template: '<div class="segmented-control-stub" />' },
  "router-link": {
    template: '<a class="router-link-stub" :href="to"><slot /></a>',
    props: ["to"],
  },
};

describe("InsightsView — 雙入口卡片取代 SegmentedControl", () => {
  let wrapper;
  let router;

  beforeEach(() => {
    setActivePinia(createPinia());
    router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/insights", component: { template: "<div />" } }],
    });
  });

  async function mountView() {
    wrapper = mount(InsightsView, {
      global: { plugins: [router], stubs },
    });
    await router.isReady();
  }

  it("不應渲染 SegmentedControl（已移除頂部雙 tab 按鈕）", async () => {
    await mountView();
    expect(wrapper.findComponent({ name: "SegmentedControl" }).exists()).toBe(
      false,
    );
  });

  it("應渲染兩個入口卡片：市場雷達與多空對決", async () => {
    await mountView();
    expect(wrapper.find(".entry-card--radar").exists()).toBe(true);
    expect(wrapper.find(".entry-card--macro").exists()).toBe(true);
  });

  it("市場雷達卡片標題正確", async () => {
    await mountView();
    expect(wrapper.find(".entry-card--radar .entry-card-title").text()).toBe(
      "市場雷達",
    );
  });

  it("多空對決卡片標題正確", async () => {
    await mountView();
    expect(wrapper.find(".entry-card--macro .entry-card-title").text()).toBe(
      "多空對決",
    );
  });

  it("內容區應根據 route.query.tab 顯示對應子頁", async () => {
    await mountView();
    expect(wrapper.find(".market-radar-stub").exists()).toBe(true);
    expect(wrapper.find(".macro-battle-stub").exists()).toBe(false);
  });
});
