import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import {
  fetchSocialSentimentData,
  DEFAULT_SOCIAL_SENTIMENT,
} from "./socialSentimentProvider.mjs";

describe("socialSentimentProvider - 社群情緒資料適配器 (TDD)", () => {
  const mockValidData = {
    date: "2026-09-12",
    score: 72.5,
    ma3: 68.0,
    ma7: 64.2,
    divergenceStatus: "BEARISH_DIVERGENCE",
    signals: ["GOLDEN_CROSS"],
    hotTopics: [
      {
        title: "台積電衝破千元散戶全嗨翻",
        source: "PTT",
        sentiment: "BULL",
        url: "https://www.ptt.cc/bbs/Stock/M.12345.html",
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("當檔案存在且內容有效時，應成功讀取並正規化所有欄位", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.promises, "readFile").mockResolvedValue(
      JSON.stringify(mockValidData),
    );

    const result = await fetchSocialSentimentData("/path/to/sentiment.json");

    expect(result.success).toBe(true);
    expect(result.data.date).toBe("2026-09-12");
    expect(result.data.score).toBe(72.5);
    expect(result.data.ma3).toBe(68.0);
    expect(result.data.ma7).toBe(64.2);
    expect(result.data.divergenceStatus).toBe("BEARISH_DIVERGENCE");
    expect(result.data.signals).toEqual(["GOLDEN_CROSS"]);
    expect(result.data.hotTopics).toHaveLength(1);
    expect(result.data.hotTopics[0].source).toBe("PTT");
  });

  it("當檔案不存在時，應 Safe-Fallback 回傳預設值，不擲出例外阻斷主流程", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const result = await fetchSocialSentimentData("/non/existent/path.json");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("FILE_NOT_FOUND");
    expect(result.data).toEqual(DEFAULT_SOCIAL_SENTIMENT);
    expect(result.data.divergenceStatus).toBe("資料不足");
  });

  it("當檔案內容為損毀 JSON 時，應 Safe-Fallback 回傳預設值並標記 JSON_PARSE_ERROR", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.promises, "readFile").mockResolvedValue("{ bad_json: ");

    const result = await fetchSocialSentimentData("/path/to/corrupt.json");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("JSON_PARSE_ERROR");
    expect(result.data).toEqual(DEFAULT_SOCIAL_SENTIMENT);
  });

  it("當檔案缺漏部分數值欄位時，應補齊安全預設值", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.promises, "readFile").mockResolvedValue(
      JSON.stringify({
        date: "2026-09-12",
        score: "invalid_num",
      }),
    );

    const result = await fetchSocialSentimentData("/path/to/partial.json");

    expect(result.success).toBe(true);
    expect(result.data.score).toBe(50); // 中性預設
    expect(result.data.ma3).toBe(50);
    expect(result.data.ma7).toBe(50);
    expect(result.data.divergenceStatus).toBe("NONE");
    expect(result.data.hotTopics).toEqual([]);
  });
});
