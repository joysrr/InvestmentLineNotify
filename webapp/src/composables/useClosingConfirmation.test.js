import { describe, it, expect, vi, beforeEach } from "vitest";
import { useClosingConfirmation } from "./useClosingConfirmation.js";
import { useTelegram } from "./useTelegram.js";

vi.mock("./useTelegram.js");

describe("useClosingConfirmation", () => {
  const telegram = {
    enableClosingConfirmation: vi.fn(),
    disableClosingConfirmation: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(useTelegram).mockReturnValue(telegram);
    vi.clearAllMocks();
  });

  it("exposes enableClosingConfirmation and disableClosingConfirmation", () => {
    const cc = useClosingConfirmation();
    expect(typeof cc.enableClosingConfirmation).toBe("function");
    expect(typeof cc.disableClosingConfirmation).toBe("function");
  });

  it("delegates enableClosingConfirmation to useTelegram", () => {
    const cc = useClosingConfirmation();
    cc.enableClosingConfirmation();
    expect(telegram.enableClosingConfirmation).toHaveBeenCalled();
  });

  it("delegates disableClosingConfirmation to useTelegram", () => {
    const cc = useClosingConfirmation();
    cc.disableClosingConfirmation();
    expect(telegram.disableClosingConfirmation).toHaveBeenCalled();
  });
});
