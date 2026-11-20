import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDateTimeInTaipei,
  formatShortDate,
  formatRelative,
} from "../utils/formatDate.js";

describe("formatDateTime", () => {
  it("formats a valid ISO string into local zh-TW datetime", () => {
    expect(formatDateTime("2026-11-20T14:30:00+08:00")).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
  });

  it("formats a Date instance", () => {
    expect(formatDateTime(new Date("2026-11-20T14:30:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
  });

  it("returns fallback for missing, null, undefined and invalid inputs", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
    expect(formatDateTime(Number.NaN)).toBe("—");
  });
});

describe("formatDateTimeInTaipei", () => {
  it("formats a valid UTC time using Asia/Taipei timezone", () => {
    // 2026-11-20T06:30:00Z => 2026-11-20 14:30 in Taipei (+08:00)
    const result = formatDateTimeInTaipei("2026-11-20T06:30:00Z");
    expect(result).toBe("2026-11-20 14:30");
  });

  it("returns fallback for missing, null, undefined and invalid inputs", () => {
    expect(formatDateTimeInTaipei(null)).toBe("—");
    expect(formatDateTimeInTaipei(undefined)).toBe("—");
    expect(formatDateTimeInTaipei("")).toBe("—");
    expect(formatDateTimeInTaipei("not-a-date")).toBe("—");
    expect(formatDateTimeInTaipei(Number.NaN)).toBe("—");
  });
});

describe("formatShortDate", () => {
  it("formats a valid date into MM/DD", () => {
    expect(formatShortDate("2026-11-20T14:30:00+08:00")).toBe("11/20");
  });

  it("returns fallback for missing, null, undefined and invalid inputs", () => {
    expect(formatShortDate(null)).toBe("—");
    expect(formatShortDate(undefined)).toBe("—");
    expect(formatShortDate("")).toBe("—");
    expect(formatShortDate("not-a-date")).toBe("—");
    expect(formatShortDate(Number.NaN)).toBe("—");
  });
});

describe("formatRelative", () => {
  const now = Date.parse("2026-11-20T14:00:00+08:00");

  it("returns 剛剛 for sub-minute difference", () => {
    expect(formatRelative("2026-11-20T14:00:30+08:00", now)).toBe("剛剛");
  });

  it("returns 分鐘前 for sub-hour difference", () => {
    expect(formatRelative("2026-11-20T13:45:00+08:00", now)).toBe("15 分鐘前");
  });

  it("returns 小時前 for sub-day difference", () => {
    expect(formatRelative("2026-11-20T11:00:00+08:00", now)).toBe("3 小時前");
  });

  it("returns fallback for missing, null, undefined and invalid inputs", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative(undefined)).toBe("—");
    expect(formatRelative("")).toBe("—");
    expect(formatRelative("not-a-date")).toBe("—");
    expect(formatRelative(Number.NaN)).toBe("—");
  });
});
