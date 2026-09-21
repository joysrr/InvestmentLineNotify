import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs/promises", () => ({
  default: {
    access: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

const { default: fs } = await import("fs/promises");
const { archiveManager } = await import("../modules/data/archiveManager.mjs");

describe("daily report storage contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.access.mockResolvedValue(undefined);
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
  });

  it("同日再次儲存時覆寫 YYYY-MM-DD.json，不建立時間戳版本", async () => {
    await archiveManager.saveReport({ date: "2026-09-21" });

    const reportWrite = fs.writeFile.mock.calls.find(([filePath]) =>
      /reports[\\/]\d{4}-\d{2}-\d{2}(?:_\d{6})?\.json$/.test(filePath),
    );
    expect(reportWrite).toBeDefined();
    expect(reportWrite[0]).toMatch(/reports[\\/]\d{4}-\d{2}-\d{2}\.json$/);
    expect(reportWrite[0]).not.toMatch(/_\d{6}\.json$/);
  });

  it("listArchiveDates只列出每日主檔，忽略同日時間戳舊檔", async () => {
    fs.readdir.mockResolvedValue([
      "2026-09-21.json",
      "2026-09-21_120426.json",
      "2026-09-20.json",
    ]);

    await expect(archiveManager.listArchiveDates()).resolves.toEqual([
      "2026-09-21",
      "2026-09-20",
    ]);
  });

  it("getLatestReport只讀取最新每日主檔", async () => {
    fs.readdir.mockResolvedValue([
      "2026-09-21.json",
      "2026-09-21_120426.json",
      "2026-09-20.json",
    ]);
    fs.readFile.mockResolvedValue(JSON.stringify({ date: "2026-09-21" }));

    await archiveManager.getLatestReport();

    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringMatching(/reports\/2026-09-21\.json$/),
      "utf-8",
    );
  });
});
