import { describe, expect, it } from "vitest";
import { shouldWriteSheet } from "../../../scheduler/sideEffectPolicy.mjs";

describe("daily accumulation side-effect policy", () => {
  it("累積模式停用 Google Sheets", () => {
    expect(shouldWriteSheet({ isSheetEnabled: false })).toBe(false);
  });

  it("未指定時維持既有啟用行為", () => {
    expect(shouldWriteSheet({})).toBe(true);
  });
});

// RED first: policy module is introduced only after this test fails.
