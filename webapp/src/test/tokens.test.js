import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");

function readCss(filename) {
  return readFileSync(join(ROOT, "src/styles", filename), "utf8");
}

const tokensCss = readCss("tokens.css");
const overridesCss = readCss("element-plus-overrides.css");

describe("P1-5 字體縮放保護（clamp() + tabular-nums）", () => {
  it("--iln-font-base 使用 clamp() 保護字體縮放", () => {
    const def = tokensCss.match(/--iln-font-base:\s*([^;]+);/);
    expect(def).toBeTruthy();
    expect(/clamp\(/.test(def[1])).toBe(true);
  });

  it("--iln-font-lg 使用 clamp()", () => {
    const def = tokensCss.match(/--iln-font-lg:\s*([^;]+);/);
    expect(def).toBeTruthy();
    expect(/clamp\(/.test(def[1])).toBe(true);
  });

  it("--iln-font-xl 使用 clamp()", () => {
    const def = tokensCss.match(/--iln-font-xl:\s*([^;]+);/);
    expect(def).toBeTruthy();
    expect(/clamp\(/.test(def[1])).toBe(true);
  });

  it("--iln-num-tabular 為 tabular-nums", () => {
    const def = tokensCss.match(/--iln-num-tabular:\s*([^;]+);/);
    expect(def).toBeTruthy();
    expect(def[1].trim()).toBe("tabular-nums");
  });

  it("--iln-font-mono 已定義等寬字族", () => {
    const def = tokensCss.match(/--iln-font-mono:\s*([^;]+);/);
    expect(def).toBeTruthy();
    expect(def[1].length).toBeGreaterThan(0);
  });

  it(".iln-num-tabular 在 element-plus-overrides.css 中套用 tabular-nums 與等寬字族", () => {
    expect(
      /font-variant-numeric:\s*var\(--iln-num-tabular\)/.test(overridesCss),
    ).toBe(true);
    expect(/font-family:\s*var\(--iln-font-mono\)/.test(overridesCss)).toBe(
      true,
    );
  });
});
