import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CrashToleranceSummary from "@/components/theory/CrashToleranceSummary.vue";

describe("CrashToleranceSummary", () => {
  it("顯示崩盤耐受度並標記狀態為 ESTIMATED", () => {
    const wrapper = mount(CrashToleranceSummary, {
      props: {
        theory: {
          crashTolerance: {
            status: "ESTIMATED",
            crashTolerance: 0.3,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("30%");
    expect(text).toContain("ESTIMATED");
  });

  it("輸入無效時顯示 UNAVAILABLE", () => {
    const wrapper = mount(CrashToleranceSummary, {
      props: {
        theory: {
          crashTolerance: {
            status: "UNAVAILABLE",
            reason: "INVALID_MAINTENANCE_INPUT",
            crashTolerance: null,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("UNAVAILABLE");
    expect(text).toContain("INVALID_MAINTENANCE_INPUT");
  });
});
