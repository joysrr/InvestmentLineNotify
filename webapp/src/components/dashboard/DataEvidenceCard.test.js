import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import DataEvidenceCard from "./DataEvidenceCard.vue";

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

describe("DataEvidenceCard", () => {
  it("shows the persisted item count and export action", async () => {
    const wrapper = mount(DataEvidenceCard, {
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

    await vi.waitFor(() => expect(wrapper.text()).toContain("1 個核對項目"));
    expect(telegramState.waitReady).toHaveBeenCalledOnce();
    const exportButton = wrapper.get('[data-testid="evidence-export"]');
    expect(exportButton.exists()).toBe(true);

    // 觸發即時產出並匯出
    await exportButton.trigger("click");
    await vi.waitFor(() => {
      expect(apiState.generateDataEvidenceReport).toHaveBeenCalledOnce();
      expect(exportUtilityMock.exportJSON).toHaveBeenCalledOnce();
    });
    expect(wrapper.text()).toContain("2 個核對項目");
  });
});
