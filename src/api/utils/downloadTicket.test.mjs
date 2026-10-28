// src/api/utils/downloadTicket.test.mjs
// TDD: One-time short-lived download ticket for data evidence report
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 用 unstable_mockModule 以控制 crypto.randomUUID 時序
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

describe("downloadTicket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    // 重置模組狀態（每個 test 使用獨立 instance）
    vi.resetModules();
  });

  it("createTicket 回傳 ticketId 字串", async () => {
    const { createTicket } = await import("./downloadTicket.mjs");
    const id = createTicket("/data/reports/2026-10-28-data-evidence.json");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("redeemTicket 第一次兌換成功，回傳 reportPath", async () => {
    const { createTicket, redeemTicket } = await import("./downloadTicket.mjs");
    const reportPath = "/data/reports/2026-10-28-data-evidence.json";
    const id = createTicket(reportPath);

    const result = redeemTicket(id);
    expect(result).toBe(reportPath);
  });

  it("redeemTicket 兌換後 Ticket 立即失效（一次性）", async () => {
    const { createTicket, redeemTicket } = await import("./downloadTicket.mjs");
    const id = createTicket("/data/reports/test.json");

    redeemTicket(id); // first use
    const second = redeemTicket(id); // should be null
    expect(second).toBeNull();
  });

  it("redeemTicket 傳入不存在的 ticketId 回傳 null", async () => {
    const { redeemTicket } = await import("./downloadTicket.mjs");
    expect(redeemTicket("nonexistent-ticket-id")).toBeNull();
  });

  it("Ticket 在 60 秒內仍有效", async () => {
    const { createTicket, redeemTicket } = await import("./downloadTicket.mjs");
    const id = createTicket("/data/reports/test.json");

    vi.advanceTimersByTime(59_000);
    const result = redeemTicket(id);
    expect(result).not.toBeNull();
  });

  it("Ticket 超過 60 秒後過期，回傳 null", async () => {
    const { createTicket, redeemTicket } = await import("./downloadTicket.mjs");
    const id = createTicket("/data/reports/test.json");

    vi.advanceTimersByTime(61_000);
    const result = redeemTicket(id);
    expect(result).toBeNull();
  });
});
