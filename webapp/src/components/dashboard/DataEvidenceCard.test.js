import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import DataEvidenceCard from "./DataEvidenceCard.vue";

vi.mock("../../api/index.js", () => ({
  fetchDataEvidenceReport: vi.fn().mockResolvedValue({
    generatedAt: "2026-10-21T00:00:00.000Z",
    items: [{ field: "pb", value: 4.05 }],
  }),
}));

vi.mock("../../components/common/ExportButton.vue", () => ({
  default: {
    props: ["directCommand"],
    template:
      '<button data-testid="evidence-export" :data-direct-command="directCommand">匯出</button>',
  },
}));

describe("DataEvidenceCard", () => {
  it("shows the persisted item count and export action", async () => {
    const wrapper = mount(DataEvidenceCard, {
      global: {
        stubs: {
          "el-button": { template: "<button><slot /></button>" },
        },
      },
    });

    await vi.waitFor(() => expect(wrapper.text()).toContain("1 個核對項目"));
    const exportButton = wrapper.get('[data-testid="evidence-export"]');
    expect(exportButton.exists()).toBe(true);
    expect(exportButton.attributes("data-direct-command")).toBe("json");
  });
});
