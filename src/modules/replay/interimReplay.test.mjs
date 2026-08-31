import { describe, expect, it } from "vitest";
import { runInterimReplay } from "./interimReplay.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const REPORTS_DIR = path.join(PROJECT_ROOT, "data/reports");

describe("runInterimReplay", () => {
  it("針對真實報告執行中途 replay 並計算 matches", async () => {
    const results = await runInterimReplay(REPORTS_DIR);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.resultHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(results.every((r) => typeof r.matches === "boolean")).toBe(true);
  });
});
