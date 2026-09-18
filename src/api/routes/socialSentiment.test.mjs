import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import fs from "fs";
import path from "path";
import socialSentimentRoute from "./socialSentiment.mjs";
import * as socialSentimentProvider from "../../modules/providers/socialSentimentProvider.mjs";

vi.mock("../../modules/providers/socialSentimentProvider.mjs", async () => {
  const actual = await vi.importActual(
    "../../modules/providers/socialSentimentProvider.mjs",
  );
  return {
    ...actual,
    fetchSocialSentimentData: vi.fn(),
  };
});

describe("GET /api/social-sentiment (TDD)", () => {
  let app;

  beforeEach(async () => {
    app = Fastify();
    await app.register(socialSentimentRoute);
  });

  afterEach(async () => {
    await app.close();
  });

  it("應透過 provider 回傳正規化後的社群快照 metadata", async () => {
    socialSentimentProvider.fetchSocialSentimentData.mockResolvedValue({
      success: true,
      data: {
        date: "2026-09-18",
        score: 57,
        ma3: 56.7,
        ma7: 57,
        updatedAt: "2026-09-18T00:05:14.000Z",
        sampleCount: 42,
        pttItems: 30,
        bskyItems: 12,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/social-sentiment",
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.payload);
    expect(data.updatedAt).toBe("2026-09-18T00:05:14.000Z");
    expect(data.sampleCount).toBe(42);
    expect(
      socialSentimentProvider.fetchSocialSentimentData,
    ).toHaveBeenCalledOnce();
  });
});
