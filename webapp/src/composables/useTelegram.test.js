import { afterEach, describe, expect, it, vi } from "vitest";
import { useTelegram, waitReady } from "./useTelegram.js";

afterEach(() => {
  delete window.Telegram;
  vi.restoreAllMocks();
});

describe("waitReady", () => {
  it("resolves immediately outside Telegram", async () => {
    await expect(waitReady()).resolves.toBeUndefined();
  });

  it("calls Telegram ready before resolving", async () => {
    const ready = vi.fn();
    window.Telegram = { WebApp: { ready } };

    await waitReady();

    expect(ready).toHaveBeenCalledOnce();
  });
});

describe("useTelegram", () => {
  it("exposes Telegram data and actions", () => {
    const openLink = vi.fn();
    const expand = vi.fn();
    const BackButton = { show: vi.fn() };
    window.Telegram = {
      WebApp: {
        initData: "init-data",
        themeParams: { bg_color: "#fff" },
        openLink,
        expand,
        BackButton,
      },
    };

    const telegram = useTelegram();

    expect(telegram.initData).toBe("init-data");
    expect(telegram.themeParams).toEqual({ bg_color: "#fff" });
    expect(telegram.backButton).toBe(BackButton);
    telegram.expand();
    telegram.openLink("https://example.com");
    expect(expand).toHaveBeenCalledOnce();
    expect(openLink).toHaveBeenCalledWith("https://example.com");
  });

  it("falls back to window.open outside Telegram", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    const telegram = useTelegram();
    telegram.expand();
    telegram.openLink("https://example.com");

    expect(open).toHaveBeenCalledWith("https://example.com", "_blank");
    expect(telegram.initData).toBe("");
    expect(telegram.themeParams).toEqual({});
  });
});
