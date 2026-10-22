import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateDataEvidenceReport } from "../../../modules/verification/generateDataEvidenceReport.mjs";

describe("generate data evidence report", () => {
  it("writes JSON and Markdown reports to the requested output directory", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-evidence-"));
    fs.mkdirSync(path.join(rootDir, "data/market"), { recursive: true });
    fs.mkdirSync(path.join(rootDir, "data/sentiment"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, "data/market/latest.json"),
      JSON.stringify({
        _meta: { lastRun: "2026-10-21T12:00:00.000Z", sources: {} },
        data: {},
      }),
    );
    fs.writeFileSync(path.join(rootDir, "data/pbHistory.json"), "[]");
    fs.writeFileSync(path.join(rootDir, "data/vixHistory.json"), "[]");
    fs.writeFileSync(
      path.join(rootDir, "data/sentiment/social_sentiment_daily.json"),
      JSON.stringify({
        date: "2026-10-21",
        updatedAt: "2026-10-21T12:00:00.000Z",
      }),
    );

    const result = generateDataEvidenceReport({
      rootDir,
      outputDir: path.join(rootDir, "data/verification-reports"),
      generatedAt: "2026-10-21T13:00:00.000Z",
      dateLabel: "2026-10-21",
    });

    expect(fs.existsSync(result.jsonPath)).toBe(true);
    expect(fs.existsSync(result.markdownPath)).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(result.jsonPath, "utf8")).reportType,
    ).toBe("data-evidence");
    expect(fs.readFileSync(result.markdownPath, "utf8")).toContain(
      "# Data Evidence Report",
    );
  });
});
