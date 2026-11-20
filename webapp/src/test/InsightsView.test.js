import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import InsightsView from "../views/InsightsView.vue";
import { useRoute, useRouter } from "vue-router";

vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("@/composables/useSmartMainButton.js", () => ({
  useSmartMainButton: vi.fn(),
}));
vi.mock("../views/MarketRadarView.vue", () => ({
  default: { template: '<div data-testid="radar-content">Market Radar</div>' },
}));
vi.mock("../views/MacroBattleView.vue", () => ({
  default: { template: '<div data-testid="macro-content">Macro Battle</div>' },
}));
vi.mock("@/components/common/Icon.vue", () => ({
  default: { template: "<span />" },
}));

describe("InsightsView", () => {
  it("預設顯示市場雷達內容", () => {
    vi.mocked(useRoute).mockReturnValue({ query: {} });
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() });
    const wrapper = mount(InsightsView);
    expect(wrapper.find('[data-testid="radar-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="macro-content"]').exists()).toBe(false);
  });

  it("tab=macro 時顯示多空對決內嵌內容", () => {
    vi.mocked(useRoute).mockReturnValue({ query: { tab: "macro" } });
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() });
    const wrapper = mount(InsightsView);
    expect(wrapper.find('[data-testid="macro-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="radar-content"]').exists()).toBe(false);
  });
});
