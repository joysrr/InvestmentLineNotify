// webapp/src/test/views/MarketRadarView.defenseMode.test.js
// MarketRadarView 長期防禦模式狀態欄測試 — Phase 4

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import MarketRadarView from "@/views/MarketRadarView.vue";

// Mock API
vi.mock("@/api/index.js", () => ({
  fetchStatus: vi.fn(),
  fetchReports: vi.fn(),
}));

const { fetchStatus, fetchReports } = await import("@/api/index.js");

// Mock Telegram composable
vi.mock("@/composables/useTelegram.js", () => ({
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

const baseStatus = {
  updatedAt: "2026-11-06T08:00:00Z",
  leadingIndicators: {
    isLongTermDefense: false,
  },
};

const baseReport = {
  date: "2026-11-06",
  leadingIndicators: {
    isLongTermDefense: false,
  },
};

function mountView(statusOverride = {}, reportOverride = {}) {
  fetchStatus.mockResolvedValue({ data: { ...baseStatus, ...statusOverride } });
  fetchReports.mockResolvedValue([{ ...baseReport, ...reportOverride }]);

  return mount(MarketRadarView, {
    global: {
      stubs: ["router-link", "router-view"],
    },
  });
}

describe("MarketRadarView - 長期防禦模式狀態欄 (Phase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isLongTermDefense 為 false 時不顯示防禦模式狀態欄", async () => {
    const wrapper = mountView();
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.find(".defense-mode-badge").exists()).toBe(false);
  });

  it("isLongTermDefense 為 true 時顯示長期防禦模式狀態欄", async () => {
    const wrapper = mountView(
      { leadingIndicators: { isLongTermDefense: true } },
      { leadingIndicators: { isLongTermDefense: true } },
    );
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.find(".defense-mode-badge").exists()).toBe(true);
    expect(wrapper.text()).toContain("長期防禦模式");
  });

  it("防禦模式狀態欄使用危險色樣式", async () => {
    const wrapper = mountView(
      { leadingIndicators: { isLongTermDefense: true } },
      { leadingIndicators: { isLongTermDefense: true } },
    );
    await new Promise((r) => setTimeout(r, 0));

    const badge = wrapper.find(".defense-mode-badge");
    expect(badge.classes()).toContain("card-danger");
  });
});
