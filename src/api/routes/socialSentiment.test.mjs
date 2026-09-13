import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import fs from "fs";
import path from "path";
import socialSentimentRoute from "./socialSentiment.mjs";

describe("GET /api/social-sentiment (TDD)", () => {
  let app;

  beforeEach(async () => {
    app = Fastify();
    await app.register(socialSentimentRoute);
  });

  afterEach(async () => {
    await app.close();
  });

  it("當 social_sentiment_daily.json 存在時，應回傳 200 與快照內容", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/social-sentiment",
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data).toHaveProperty("date");
    expect(data).toHaveProperty("score");
    expect(data).toHaveProperty("ma3");
    expect(data).toHaveProperty("ma7");
  });
});
