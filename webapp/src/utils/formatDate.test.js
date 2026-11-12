import { describe, it, expect } from "vitest";
import {
  formatDateTime,
  formatShortDate,
  formatRelative,
  resolveLastRun,
} from "./formatDate.js";

process.env.TZ = "Asia/Taipei";

describe("formatDate", () => {
  const fixedNow = new Date("2026-11-12T14:30:00+08:00").getTime();

  describe("formatDateTime", () => {
    it("null / undefined 回傳 '—'", () => {
      expect(formatDateTime(null)).toBe("—");
      expect(formatDateTime(undefined)).toBe("—");
    });

    it("無效字串回傳 '—'", () => {
      expect(formatDateTime("not-a-date")).toBe("—");
      expect(formatDateTime("")).toBe("—");
    });

    it("Date 物件格式化為 YYYY-MM-DD HH:mm", () => {
      expect(formatDateTime(new Date("2026-11-12T14:30:00+08:00"))).toBe(
        "2026-11-12 14:30",
      );
    });

    it("ISO 字串格式化", () => {
      expect(formatDateTime("2026-11-12T14:30:00+08:00")).toBe(
        "2026-11-12 14:30",
      );
    });
  });

  describe("formatShortDate", () => {
    it("null / undefined 回傳 '—'", () => {
      expect(formatShortDate(null)).toBe("—");
    });

    it("格式化為 M/DD", () => {
      expect(formatShortDate("2026-11-12T14:30:00+08:00")).toBe("11/12");
    });
  });

  describe("formatRelative", () => {
    it("null / undefined / 無效字串 回傳 '—'", () => {
      expect(formatRelative(null)).toBe("—");
      expect(formatRelative("bad")).toBe("—");
    });

    it("< 60 秒 回傳 '剛剛'", () => {
      expect(formatRelative(fixedNow - 30_000, fixedNow)).toBe("剛剛");
      expect(formatRelative(fixedNow - 59_000, fixedNow)).toBe("剛剛");
    });

    it("< 60 分鐘 回傳 'X 分鐘前'", () => {
      expect(formatRelative(fixedNow - 3 * 60 * 1000, fixedNow)).toBe(
        "3 分鐘前",
      );
      expect(formatRelative(fixedNow - 59 * 60 * 1000, fixedNow)).toBe(
        "59 分鐘前",
      );
    });

    it("< 24 小時 回傳 'X 小時前'", () => {
      expect(formatRelative(fixedNow - 2 * 60 * 60 * 1000, fixedNow)).toBe(
        "2 小時前",
      );
    });

    it("< 30 天 回傳 'X 天前'", () => {
      expect(formatRelative(fixedNow - 5 * 24 * 60 * 60 * 1000, fixedNow)).toBe(
        "5 天前",
      );
    });

    it("超過 30 天 回傳短日期 'M/DD'", () => {
      expect(
        formatRelative(fixedNow - 40 * 24 * 60 * 60 * 1000, fixedNow),
      ).toBe("10/03");
    });
  });

  describe("resolveLastRun", () => {
    it("null 回傳 null", () => {
      expect(resolveLastRun(null)).toBeNull();
    });

    it("{} 回傳 null", () => {
      expect(resolveLastRun({})).toBeNull();
    });

    it("優先取 lastRun", () => {
      expect(
        resolveLastRun({
          lastRun: "2026-11-10",
          updatedAt: "2026-11-11",
        }),
      ).toBe("2026-11-10");
    });

    it("其次取 updatedAt", () => {
      expect(resolveLastRun({ updatedAt: "2026-11-11" })).toBe("2026-11-11");
    });

    it("最後取 updated_at", () => {
      expect(resolveLastRun({ updated_at: "2026-11-12" })).toBe("2026-11-12");
    });
  });
});
