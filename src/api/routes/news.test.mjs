import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import newsRoute from "./news.mjs";

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

describe("GET /api/news (TDD Phase 3)", () => {
  let app;
  let readFile;

  beforeEach(async () => {
    const fsPromises = await import("fs/promises");
    readFile = fsPromises.readFile;

    app = Fastify();
    await app.register(newsRoute);
  });

  afterEach(async () => {
    await app.close();
    readFile.mockReset();
  });

  it("讀取成功時回傳 200 並回傳解析後的 JSON 數據", async () => {
    const newsData = [{ id: 1, title: "測試新聞", content: "內容" }];
    readFile.mockResolvedValue(JSON.stringify(newsData));

    const res = await app.inject({
      method: "GET",
      url: "/news",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toEqual(newsData);
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it("檔案不存在 (ENOENT) 時回傳空陣列 []", async () => {
    const err = new Error("ENOENT: no such file");
    err.code = "ENOENT";
    readFile.mockRejectedValue(err);

    const res = await app.inject({
      method: "GET",
      url: "/news",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toEqual([]);
  });

  it("其他錯誤時回傳 500", async () => {
    readFile.mockRejectedValue(new Error("讀取失敗"));

    const res = await app.inject({
      method: "GET",
      url: "/news",
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Internal server error");
  });
});
