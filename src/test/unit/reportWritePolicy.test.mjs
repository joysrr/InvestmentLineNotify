import { describe, expect, it } from "vitest";
import { shouldPersistDailyReport } from "../../domain/reportWritePolicy.mjs";

describe("reportWritePolicy", () => {
  it("AI 新聞精選失敗時不得覆寫每日報告", () => {
    expect(shouldPersistDailyReport({ newsAnalysisStatus: "failed" })).toBe(
      false,
    );
  });

  it("AI 新聞精選成功時允許儲存每日報告", () => {
    expect(shouldPersistDailyReport({ newsAnalysisStatus: "success" })).toBe(
      true,
    );
  });

  it("未提供狀態時維持既有儲存行為", () => {
    expect(shouldPersistDailyReport({})).toBe(true);
  });
});
