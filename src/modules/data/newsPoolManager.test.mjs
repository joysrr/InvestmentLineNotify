// src/modules/data/newsPoolManager.test.mjs
// TDD: News Pool Manager 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("path", () => ({
  default: { join: vi.fn((...args) => args.join("/")) },
  join: (...args) => args.join("/"),
}));

describe("newsPoolManager - 新聞池管理器", () => {
  let newsPoolManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    newsPoolManager = await import("./newsPoolManager.mjs");
  });

  describe("buildFingerprint - 標題指紋", () => {
    it("相同標題產生相同指紋", () => {
      const title = "台股今日大漲 32 元";
      const fp1 = newsPoolManager.buildFingerprint(title);
      const fp2 = newsPoolManager.buildFingerprint(title);
      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(16);
    });

    it("不同標題產生不同指紋", () => {
      const fp1 = newsPoolManager.buildFingerprint("標題 A");
      const fp2 = newsPoolManager.buildFingerprint("標題 B");
      expect(fp1).not.toBe(fp2);
    });

    it("剝除常見來源尾碼", () => {
      const title1 = "台股大漲 | Reuters";
      const title2 = "台股大漲";
      const fp1 = newsPoolManager.buildFingerprint(title1);
      const fp2 = newsPoolManager.buildFingerprint(title2);
      // 應該相同（尾碼被剝除）
      expect(fp1).toBe(fp2);
    });

    it("大小寫不敏感", () => {
      const fp1 = newsPoolManager.buildFingerprint("TAIWAN STOCK");
      const fp2 = newsPoolManager.buildFingerprint("taiwan stock");
      expect(fp1).toBe(fp2);
    });

    it("去除標點符號", () => {
      const fp1 = newsPoolManager.buildFingerprint("台股, 大漲!");
      const fp2 = newsPoolManager.buildFingerprint("台股 大漲");
      expect(fp1).toBe(fp2);
    });

    it("空/無效輸入回傳空字串 hash", () => {
      const fp = newsPoolManager.buildFingerprint("");
      expect(fp).toBeDefined();
      expect(fp.length).toBe(16);
    });
  });

  describe("buildRegionKey - 區域鍵值 (間接測試)", () => {
    // buildRegionKey 非 export，透過 updatePool 行為間接驗證
    it("TW/US 相同 fingerprint 不互相干擾", async () => {
      const fingerprint = newsPoolManager.buildFingerprint("相同標題");
      // 先建立 TW 文章
      const twArticle = {
        id: fingerprint,
        url: "http://tw.com",
        fetched_at: new Date().toISOString(),
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [twArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.mkdir.mockResolvedValue();

      // US 相同標題應被新增 (不同 region)
      const newArticles = [
        { title: "相同標題", link: "http://us.com", _region: "US" },
      ];
      const result = await newsPoolManager.updatePool(newArticles);

      expect(result.appended).toBe(1);
      expect(result.skipped_fuzzy).toBe(0);
    });

    it("同 region 相同 fingerprint 去重", async () => {
      const fingerprint = newsPoolManager.buildFingerprint("相同標題");
      const twArticle = {
        id: fingerprint,
        url: "http://tw.com",
        fetched_at: new Date().toISOString(),
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [twArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.mkdir.mockResolvedValue();

      const newArticles = [
        { title: "相同標題", link: "http://tw2.com", _region: "TW" },
      ];
      const result = await newsPoolManager.updatePool(newArticles);

      expect(result.appended).toBe(0);
      expect(result.skipped_fuzzy).toBe(1);
    });
  });

  describe("getAgeBand - 年齡分級 (間接測試)", () => {
    it("fresh: 0-6 小時", async () => {
      const now = new Date().toISOString();
      const validArticle = {
        id: "valid",
        url: "http://valid.com",
        fetched_at: now,
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [validArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await newsPoolManager.updatePool([]);
      expect(result.total).toBe(1);
    });

    it("recent: 6-12 小時", async () => {
      const nineHoursAgo = new Date(Date.now() - 9 * 3600 * 1000).toISOString();
      const validArticle = {
        id: "valid",
        url: "http://valid.com",
        fetched_at: nineHoursAgo,
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [validArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await newsPoolManager.updatePool([]);
      expect(result.total).toBe(1);
    });

    it("stale: 12-24 小時", async () => {
      const eighteenHoursAgo = new Date(Date.now() - 18 * 3600 * 1000).toISOString();
      const validArticle = {
        id: "valid",
        url: "http://valid.com",
        fetched_at: eighteenHoursAgo,
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [validArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await newsPoolManager.updatePool([]);
      expect(result.total).toBe(1);
    });

    it("超過 24 小時仍為 stale (但會被歸檔)", async () => {
      const thirtyHoursAgo = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
      const expiredArticle = {
        id: "expired",
        url: "http://expired.com",
        fetched_at: thirtyHoursAgo,
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [expiredArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.mkdir.mockResolvedValue();

      const result = await newsPoolManager.updatePool([]);

      // 超過 24 小時會被歸檔，不在 pool 中
      expect(result.expired).toBe(1);
      expect(result.total).toBe(0);
    });
  });

  describe("isZombieArticle - 殭屍文章檢查 (間接測試)", () => {
    it("殭屍文章在 updatePool 中被清除", async () => {
      const zombieArticle = {
        id: "zombie",
        url: "http://zombie.com",
        _region: "TW",
        // 沒有 fetched_at
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [zombieArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await newsPoolManager.updatePool([]);

      // 殭屍文章不算在 expired，總數應為 0
      expect(result.expired).toBe(0);
      expect(result.total).toBe(0);
    });

    it("有效 fetched_at 文章被保留", async () => {
      const validArticle = {
        id: "valid",
        url: "http://valid.com",
        fetched_at: new Date().toISOString(),
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [validArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await newsPoolManager.updatePool([]);

      expect(result.total).toBe(1);
    });
  });

  describe("updatePool - 更新池", () => {
    it("空 pool 初始化結構", async () => {
      fs.readFile.mockRejectedValue(new Error("ENOENT"));
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const newArticles = [
        { title: "新聞1", link: "http://a.com", _region: "TW" },
      ];

      const result = await newsPoolManager.updatePool(newArticles);

      expect(result.appended).toBe(1);
      expect(result.total).toBe(1);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("URL 去重生效", async () => {
      const existingArticle = {
        id: "existing123",
        url: "http://same.com",
        fetched_at: new Date().toISOString(),
        _region: "TW",
      };
      fs.readFile.mockResolvedValue(JSON.stringify({
        articles: [existingArticle],
        last_updated: new Date().toISOString(),
        fetch_count: 1,
      }));
      fs.writeFile.mockResolvedValue();

      const newArticles = [
        { title: "新聞1", link: "http://same.com", _region: "TW" },
      ];

      const result = await newsPoolManager.updatePool(newArticles);

      expect(result.appended).toBe(0);
      expect(result.skipped_fuzzy).toBe(0);
    });

    it("region-scoped fingerprint 去重生效", async () => {
      // 使用實際會產生的 fingerprint
      const fingerprint = newsPoolManager.buildFingerprint("相同標題");
      const existingArticle = {
        id: fingerprint,
        url: "http://diff.com",
        fetched_at: new Date().toISOString(),
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [existingArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.mkdir.mockResolvedValue();

      // 相同標題但不同 URL，同 region
      const newArticles = [
        { title: "相同標題", link: "http://new.com", _region: "TW" },
      ];

      const result = await newsPoolManager.updatePool(newArticles);

      expect(result.skipped_fuzzy).toBe(1);
      expect(result.appended).toBe(0);
    });

    it("不同 region 相同 fingerprint 不去重", async () => {
      const fingerprint = newsPoolManager.buildFingerprint("相同標題");
      const existingArticle = {
        id: fingerprint,
        url: "http://existing.com",
        fetched_at: new Date().toISOString(),
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [existingArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.mkdir.mockResolvedValue();

      const newArticles = [
        { title: "相同標題", link: "http://new.com", _region: "US" },
      ];

      const result = await newsPoolManager.updatePool(newArticles);

      // 不同 region 應該不被去重
      expect(result.appended).toBe(1);
      expect(result.skipped_fuzzy).toBe(0);
    });

    it("過期文章歸檔", async () => {
      const expiredArticle = {
        id: "expired",
        url: "http://old.com",
        fetched_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 48h ago
        _region: "TW",
      };
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [expiredArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.mkdir.mockResolvedValue();

      await newsPoolManager.updatePool([]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("archive/"),
        expect.any(String),
        "utf-8",
      );
    });

    it("殭屍文章直接清除不歸檔", async () => {
      const zombieArticle = {
        id: "zombie",
        url: "http://zombie.com",
        _region: "TW",
        // 沒有 fetched_at
      };
      fs.readFile.mockResolvedValue(JSON.stringify({
        articles: [zombieArticle],
        last_updated: new Date().toISOString(),
        fetch_count: 1,
      }));
      fs.writeFile.mockResolvedValue();

      const result = await newsPoolManager.updatePool([]);

      expect(result.expired).toBe(0); // 不算在 expired
    });

    it("超過 MAX_POOL_SIZE 截斷保留最新", async () => {
      const manyArticles = Array.from({ length: 210 }, (_, i) => ({
        id: `id${i}`,
        url: `http://${i}.com`,
        fetched_at: new Date(Date.now() - i * 3600 * 1000).toISOString(),
        _region: "TW",
      }));
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: manyArticles,
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await newsPoolManager.updatePool([]);

      expect(result.total).toBeLessThanOrEqual(200); // MAX_POOL_SIZE
    });

    it("更新現有文章 age_band", async () => {
      const nineHoursAgo = new Date(Date.now() - 9 * 3600 * 1000).toISOString();
      const activeArticle = {
        id: "active",
        url: "http://active.com",
        fetched_at: nineHoursAgo,
        age_band: "fresh", // 舊值
        _region: "TW",
      };
      fs.readFile.mockResolvedValue(JSON.stringify({
        articles: [activeArticle],
        last_updated: new Date().toISOString(),
        fetch_count: 1,
      }));
      fs.writeFile.mockResolvedValue();

      await newsPoolManager.updatePool([]);

      // 驗證寫入時 age_band 被更新為 recent
      const writeCall = fs.writeFile.mock.calls.find(c => 
        c[0].includes("pool_active.json")
      );
      expect(writeCall).toBeDefined();
      const writtenData = JSON.parse(writeCall[1]);
      expect(writtenData.articles[0].age_band).toBe("recent");
    });

    it("統計來源分佈", async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ articles: [], last_updated: new Date().toISOString(), fetch_count: 0 }));
      fs.writeFile.mockResolvedValue();

      const newArticles = [
        { title: "新聞1", link: "http://a.com", source: "Reuters", _region: "TW" },
        { title: "新聞2", link: "http://b.com", source: "Bloomberg", _region: "TW" },
        { title: "新聞3", link: "http://c.com", source: "Reuters", _region: "TW" },
      ];

      const result = await newsPoolManager.updatePool(newArticles);

      expect(result.sourceCount).toBe(2); // Reuters, Bloomberg
      expect(result.sourceCounts.Reuters).toBe(2);
      expect(result.sourceCounts.Bloomberg).toBe(1);
    });
  });

  describe("purgeExpiredFromPool - 獨立清理", () => {
    it("清除殭屍文章", async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        articles: [
          { id: "z1", _region: "TW" }, // zombie
          { id: "a1", url: "http://a.com", fetched_at: new Date().toISOString(), _region: "TW" },
        ],
        last_updated: new Date().toISOString(),
        fetch_count: 1,
      }));
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);

      const result = await newsPoolManager.purgeExpiredFromPool();

      expect(result.removed_zombies).toBe(1);
      expect(result.total).toBe(1);
    });

    it("歸檔過期文章", async () => {
      const expiredArticle = {
        id: "expired",
        url: "http://old.com",
        fetched_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        _region: "TW",
      };
      fs.readFile.mockResolvedValue(JSON.stringify({
        articles: [expiredArticle],
        last_updated: new Date().toISOString(),
        fetch_count: 1,
      }));
      fs.writeFile.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.mkdir.mockResolvedValue();
      // archive 讀取現有檔案時回傳空陣列
      fs.readFile.mockImplementation((path) => {
        if (path.includes("archive/")) {
          return Promise.resolve("[]");
        }
        return Promise.resolve(JSON.stringify({
          articles: [expiredArticle],
          last_updated: new Date().toISOString(),
          fetch_count: 1,
        }));
      });

      const result = await newsPoolManager.purgeExpiredFromPool();

      expect(result.expired).toBe(1);
    });
  });

  describe("loadPoolWithFallback - 讀取含降級", () => {
    it("有文章直接回傳", async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        articles: [{ id: "1" }],
        last_updated: new Date().toISOString(),
        fetch_count: 1,
      }));

      const result = await newsPoolManager.loadPoolWithFallback();

      expect(result.isFallback).toBe(false);
      expect(result.articles).toHaveLength(1);
    });

    it("空 pool 降級讀取昨日 archive", async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({ articles: [], last_updated: new Date().toISOString(), fetch_count: 1 }))
        .mockResolvedValueOnce(JSON.stringify([{ id: "archived" }]));

      const result = await newsPoolManager.loadPoolWithFallback();

      expect(result.isFallback).toBe(true);
      expect(result.articles).toHaveLength(1);
      expect(result.meta.fallback_date).toBeDefined();
    });

    it("archive 也不存在回傳空陣列", async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({ articles: [], last_updated: new Date().toISOString(), fetch_count: 1 }))
        .mockRejectedValueOnce(new Error("ENOENT"));

      const result = await newsPoolManager.loadPoolWithFallback();

      expect(result.isFallback).toBe(false);
      expect(result.articles).toEqual([]);
    });
  });

  describe("saveFilteredPool - 過濾池", () => {
    it("寫入 pool_filtered_active.json", async () => {
      fs.writeFile.mockResolvedValue();
      fs.mkdir.mockResolvedValue();

      await newsPoolManager.saveFilteredPool([{ title: "filtered" }], "2024-01-01");

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("pool_filtered_active.json"),
        expect.stringContaining("filtered"),
        "utf-8",
      );
    });
  });

  describe("cleanOldNewsArchives - Archive 清理", () => {
    it("超過保留天數刪除", async () => {
      const oldFile = "2023-01-01.json";
      const recentFile = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0] + ".json";

      fs.readdir.mockResolvedValue([oldFile, recentFile]);
      fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 400 * 86400000 }); // 400 天前
      fs.unlink.mockResolvedValue();

      await newsPoolManager.cleanOldNewsArchives(30);

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining(oldFile));
    });
  });
});