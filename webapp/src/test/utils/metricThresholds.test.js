import { describe, it, expect } from "vitest";
import { getMaintenanceLevel } from "@/utils/metricThresholds.js";

describe("getMaintenanceLevel", () => {
  it("ratio < 135 → danger（斷頭警戒）", () => {
    const r = getMaintenanceLevel(130);
    expect(r.level).toBe("danger");
    expect(r.cls).toBe("card-danger");
    expect(r.label).toContain("斷頭");
  });

  it("135 <= ratio < 160 → warn（維持率偏低）", () => {
    const r = getMaintenanceLevel(145);
    expect(r.level).toBe("warn");
    expect(r.cls).toBe("card-warn");
    expect(r.label).toContain("偏低");
  });

  it("ratio >= 160 → ok（安全）", () => {
    const r = getMaintenanceLevel(160);
    expect(r.level).toBe("ok");
    expect(r.cls).toBe("card-ok");
    expect(r.label).toContain("安全");
  });

  it("NaN → neutral", () => {
    const r = getMaintenanceLevel(NaN);
    expect(r.level).toBe("neutral");
    expect(r.cls).toBe("");
  });
});
