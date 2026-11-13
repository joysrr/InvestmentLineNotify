import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import DataEvidenceCard from "./DataEvidenceCard.vue";
import ContentCard from "@/components/common/ContentCard.vue";

const telegramState = vi.hoisted(() => ({
  waitReady: vi.fn().mockResolvedValue(undefined),
  useTelegram: vi.fn().mockReturnValue({
    tg: null,
    openLink: vi.fn(),
  }),
}));

const apiState = vi.hoisted(() => ({
  fetchDataEvidenceReport: vi.fn().mockResolvedValue({
    generatedAt: "2026-10-21T00:00:00.000Z",
    items: [{ field: "pb", value: 4.05 }],
  }),
  generateDataEvidenceReport: vi.fn().mockResolvedValue({
    generatedAt: "2026-10-27T00:00:00.000Z",
    items: [
      { field: "pb", value: 4.05 },
      { field: "kellyLimits.conservative", value: 1.6 },
    ],
  }),
  getDataEvidenceReportDownloadUrl: vi
    .fn()
    .mockReturnValue("/api/data-evidence-report/download"),
}));

const exportUtilityMock = vi.hoisted(() => ({
  exportJSON: vi.fn(),
}));

vi.mock("../../api/index.js", () => apiState);
vi.mock("../../composables/useTelegram.js", () => telegramState);
vi.mock("../../utils/exportUtility.js", () => exportUtilityMock);

describe("DataEvidenceCard.vue", () => {
  const baseProps = { report: null };

  it("外層使用 ContentCard，variant=outlined padding=md radius=lg", () => {
    const wrapper = mount(DataEvidenceCard, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("md");
    expect(card.props("radius")).toBe("lg");
  });

  it("report 為 null 時不顯示證據內容", () => {
    const wrapper = mount(DataEvidenceCard, { props: baseProps });
    expect(wrapper.find(".evidence-count").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("個核對項目");
  });

  it("report 有值時顯示證據項目數、範圍、產生時間", async () => {
    const wrapper = mount(DataEvidenceCard, { props: baseProps });
    await vi.waitFor(() => expect(wrapper.text()).toContain("1 個核對項目"));
    expect(wrapper.text()).toContain("2026-10-21T00:00:00.000Z");
  });

  it("loading 時顯示讀取中狀態", () => {
    const wrapper = mount(DataEvidenceCard, {
      props: { report: null, loading: true },
    });
    expect(wrapper.find(".status-text").text()).toContain("讀取證據報告中");
  });

  it("點擊匯出按鈕觸發產出與下載", async () => {
    const wrapper = mount(DataEvidenceCard, {
      props: baseProps,
      global: {
        stubs: {
          "el-button": {
            template: '<button :disabled="loading"><slot /></button>',
            props: ["loading"],
          },
          "el-icon": { template: "<span><slot /></span>" },
        },
      },
    });
    const exportButton = wrapper.get('[data-testid="evidence-export"]');
    expect(exportButton.exists()).toBe(true);
    await exportButton.trigger("click");
    await vi.waitFor(() => {
      expect(apiState.generateDataEvidenceReport).toHaveBeenCalled();
      expect(exportUtilityMock.exportJSON).toHaveBeenCalled();
    });
  });
});
