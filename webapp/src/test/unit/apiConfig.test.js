import { describe, expect, it } from "vitest";
import { buildUrl, buildUrlWithQuery } from "../../api/config.js";

describe("api config buildUrl", () => {
  it("在同源相對路徑下應回傳 /api/reports 開頭的相對路徑，避免觸發跨域 CORS 預檢", () => {
    const url = buildUrlWithQuery("/reports", { limit: 1 });
    expect(url).toBe("/api/reports?limit=1");
    expect(url.startsWith("http://")).toBe(false);
    expect(url.startsWith("https://")).toBe(false);
  });
});
