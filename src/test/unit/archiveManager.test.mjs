import { describe, it, expect, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import { archiveManager } from "../../modules/data/archiveManager.mjs";

describe("ArchiveManager Unit Test", () => {
  const cleanupPaths = [];

  function getTwDateStr() {
    return new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
      .replace(/\//g, "-");
  }

  function getNewsLogPath(region) {
    return path.join(
      process.cwd(),
      "data",
      "news_logs",
      `passedArticles_${region}_${getTwDateStr()}.json`,
    );
  }

  const mockArticlesTW = [
    {
      title: "台積電外資買超創新高",
      link: "https://example.com/news/1",
      pubDate: new Date().toISOString(),
      source: "工商時報",
      _region: "TW",
      _keyword: "台積電",
    },
  ];

  afterAll(async () => {
    for (const p of cleanupPaths) {
      try {
        await fs.unlink(p);
      } catch (e) {
        // Ignore error if file doesn't exist
      }
    }
  });

  it("saveNewsLog(TW) 應成功建立 JSON 檔案並格式正確", async () => {
    const logPath = getNewsLogPath("TW");
    await archiveManager.saveNewsLog(mockArticlesTW, "TW", {
      usedKeywords: ["台積電"],
      fallbackTriggered: false,
    });
    cleanupPaths.push(logPath);

    const stat = await fs.stat(logPath);
    expect(stat.isFile()).toBe(true);

    const content = JSON.parse(await fs.readFile(logPath, "utf-8"));
    expect(content.region).toBe("TW");
    expect(content.count).toBe(mockArticlesTW.length);
    expect(content.fallbackTriggered).toBe(false);
  });

  it("saveNewsLog 同日再次呼叫應覆寫內容 (冪等性)", async () => {
    const logPath = getNewsLogPath("TW");
    await archiveManager.saveNewsLog([mockArticlesTW[0]], "TW", {
      usedKeywords: ["台積電"],
      fallbackTriggered: false,
    });
    const content = JSON.parse(await fs.readFile(logPath, "utf-8"));
    expect(content.count).toBe(1);
  });

  it("cleanOldArchives 應刪除 >30 天的舊檔案並保留今日檔案", async () => {
    const dir = path.join(process.cwd(), "data", "news_logs");
    await fs.mkdir(dir, { recursive: true });

    const oldFilePath = path.join(dir, "passedArticles_TW_2026-01-01.json");
    await fs.writeFile(oldFilePath, JSON.stringify({ _test: true }));

    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFilePath, fortyDaysAgo, fortyDaysAgo);

    await archiveManager.cleanOldArchives(30);

    let exists = true;
    try {
      await fs.stat(oldFilePath);
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);

    const todayStat = await fs.stat(getNewsLogPath("TW"));
    expect(todayStat.isFile()).toBe(true);
  });
});
