import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useTelegramMainButton } from "./useTelegramMainButton.js";

afterEach(() => {
  delete window.Telegram;
  vi.restoreAllMocks();
});

const mountComposable = (factory) => {
  let value;
  const wrapper = mount(
    defineComponent({
      setup() {
        value = factory();
        return () => null;
      },
    }),
  );
  return { value, wrapper };
};

const buildTg = (overrides = {}) => ({
  MainButton: {
    show: vi.fn(),
    hide: vi.fn(),
    setText: vi.fn(),
    setColor: vi.fn(),
    setTextColor: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
    setParams: vi.fn(),
    ...overrides.mainButton,
  },
  ...overrides,
});

describe("useTelegramMainButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows MainButton with text when Telegram available", () => {
    window.Telegram = { WebApp: buildTg() };
    const { value } = mountComposable(() => useTelegramMainButton());
    value.show({ text: "立即決策" });
    expect(window.Telegram.WebApp.MainButton.setText).toHaveBeenCalledWith(
      "立即決策",
    );
    expect(window.Telegram.WebApp.MainButton.show).toHaveBeenCalled();
  });

  it("hides MainButton", () => {
    window.Telegram = { WebApp: buildTg() };
    const { value } = mountComposable(() => useTelegramMainButton());
    value.hide();
    expect(window.Telegram.WebApp.MainButton.hide).toHaveBeenCalled();
  });

  it("registers and removes click handler", () => {
    const handler = vi.fn();
    window.Telegram = { WebApp: buildTg() };
    const { value } = mountComposable(() => useTelegramMainButton());
    value.onClick(handler);
    expect(window.Telegram.WebApp.MainButton.onClick).toHaveBeenCalledWith(
      handler,
    );
    value.offClick(handler);
    expect(window.Telegram.WebApp.MainButton.offClick).toHaveBeenCalledWith(
      handler,
    );
  });

  it("sets params on MainButton", () => {
    window.Telegram = { WebApp: buildTg() };
    const { value } = mountComposable(() => useTelegramMainButton());
    value.setParams({ color: "#2481cc" });
    expect(window.Telegram.WebApp.MainButton.setParams).toHaveBeenCalledWith({
      color: "#2481cc",
    });
  });

  it("is a no-op outside Telegram (dev browser)", () => {
    delete window.Telegram;
    const { value } = mountComposable(() => useTelegramMainButton());
    expect(() => value.show({ text: "X" })).not.toThrow();
    expect(() => value.hide()).not.toThrow();
    expect(() => value.onClick(() => {})).not.toThrow();
    expect(() => value.offClick(() => {})).not.toThrow();
    expect(() => value.setParams({})).not.toThrow();
    expect(value.mainButton).toBeUndefined();
  });

  it("exposes raw mainButton object when available", () => {
    const mainButton = { show: vi.fn(), hide: vi.fn() };
    window.Telegram = {
      WebApp: { ...buildTg(), MainButton: mainButton },
    };
    const { value } = mountComposable(() => useTelegramMainButton());
    expect(value.mainButton).toBe(mainButton);
  });
});
