import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

const FILE = "src/components/radar/ExtremeRadarPanel.vue";

function grepCount(pattern) {
  try {
    const out = execSync(`grep -nE '${pattern}' ${FILE}`, {
      encoding: "utf8",
      shell: "/bin/bash",
    });
    return out.trim().split("\n").filter(Boolean).length;
  } catch (e) {
    if (e.status === 1) return 0;
    throw e;
  }
}

describe("P1-3b-補: ExtremeRadarPanel B 類 rgba → token", () => {
  it("語義色 rgba 應為 0 (danger/warn/ok/brand)", () => {
    const n = grepCount(
      "rgba\\(232,\\s*72,\\s*85|rgba\\(255,\\s*159,\\s*10|rgba\\(38,\\s*161,\\s*123|rgba\\(36,\\s*129,\\s*204",
    );
    expect(n).toBe(0);
  });

  it("hex 數量應 ≤ 8", () => {
    const n = grepCount("#[0-9a-fA-F]{3,8}");
    expect(n).toBeLessThanOrEqual(8);
  });

  it("保留項應有「留待 Phase 5」註解", () => {
    const out = execSync(`grep -n '留待 Phase 5' ${FILE}`, {
      encoding: "utf8",
      shell: "/bin/bash",
    });
    expect(out.trim().length).toBeGreaterThan(0);
  });
});
