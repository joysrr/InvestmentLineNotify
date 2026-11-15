import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanColors } from "../../scripts/check-no-raw-color.mjs";

let tmpRoot;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "p8-01-test-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeFile(relPath, content) {
  const fs = require("node:fs");
  const full = join(tmpRoot, "src", relPath);
  const dir = full.split("/").slice(0, -1).join("/");
  fs.mkdirSync(dir, { recursive: true });
  writeFileSync(full, content, "utf-8");
  return full;
}

describe("check-no-raw-color", () => {
  it("case 1: .vue <style> 內 color: #fff; 違規", () => {
    writeFile(
      "components/C1.vue",
      `<template><div /></template>\n<style>\n  .a { color: #fff; }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].text).toContain("#fff");
  });

  it("case 2: .vue <style> 內 color: rgba(0,0,0,.5); 違規", () => {
    writeFile(
      "components/C2.vue",
      `<template><div /></template>\n<style>\n  .a { color: rgba(0,0,0,.5); }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(violations.some((v) => v.text.includes("rgba("))).toBe(true);
  });

  it("case 3: .vue <style> 內 color: hsl(0 0% 0%); 違規", () => {
    writeFile(
      "components/C3.vue",
      `<template><div /></template>\n<style>\n  .a { color: hsl(0 0% 0%); }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(violations.some((v) => v.text.includes("hsl("))).toBe(true);
  });

  it("case 4: .vue <template> 內 #default slot 不違規", () => {
    writeFile(
      "components/C4.vue",
      `<template><slot name="default" /></template>\n<style>\n  .a { color: var(--iln-text); }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(violations.length).toBe(0);
  });

  it("case 5: .vue <style> 內 color: var(--iln-text, #222); 違規（fallback 也算）", () => {
    writeFile(
      "components/C5.vue",
      `<template><div /></template>\n<style>\n  .a { color: var(--iln-text, #222); }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].text).toContain("#222");
  });

  it("case 6: 同一行加 /* iln-color-allow: canvas */ 不違規", () => {
    writeFile(
      "components/C6.vue",
      `<template><div /></template>\n<style>\n  .a { color: #ff0000; /* iln-color-allow: canvas */ }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(violations.length).toBe(0);
  });

  it("case 7: 同一行加 /* iln-color-allow: */（空理由） 違規", () => {
    writeFile(
      "components/C7.vue",
      `<template><div /></template>\n<style>\n  .a { color: #ff0000; /* iln-color-allow: */ }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(violations.length).toBeGreaterThan(0);
  });

  it('case 8: .js 檔內 const c = "#10b981"; 違規', () => {
    writeFile("utils/color.js", `const c = "#10b981";\nexport default c;\n`);
    const { violations } = scanColors(join(tmpRoot, "src"));
    expect(
      violations.some(
        (v) => v.file.endsWith("utils/color.js") && v.text.includes("#10b981"),
      ),
    ).toBe(true);
  });

  it("同層 *.test.js 不違規（測試假資料應排除）", () => {
    writeFile("components/Button.test.js", `const color = "#ff0000";\n`);
    const { violations } = scanColors(join(tmpRoot, "src"));
    const ignored = violations.some((v) => v.file.includes("Button.test.js"));
    expect(ignored).toBe(false);
  });

  it("同層 *.spec.js 不違規（預防性排除）", () => {
    writeFile("utils/helper.spec.js", `const c = "#00ff00";\n`);
    const { violations } = scanColors(join(tmpRoot, "src"));
    const ignored = violations.some((v) => v.file.includes("helper.spec.js"));
    expect(ignored).toBe(false);
  });

  it("theory/ 目錄整體排除（既有政策不動）", () => {
    writeFile(
      "components/theory/SomeDetail.vue",
      `<template><div /></template>\n<style>\n  .a { background: rgba(0,0,0,0.5); }\n</style>`,
    );
    const { violations } = scanColors(join(tmpRoot, "src"));
    const ignored = violations.some((v) => v.file.includes("theory/"));
    expect(ignored).toBe(false);
  });

  it("排除 src/test/ 目錄不被掃描", () => {
    writeFile("test/should-be-ignored.js", `const x = "#ff0000";\n`);
    writeFile(
      "components/ShouldBeScanned.vue",
      `<template><div /></template>\n<style>\n  .a { color: var(--iln-text); }\n</style>`,
    );
    const { violations, scannedFiles } = scanColors(join(tmpRoot, "src"));
    const ignored = violations.some((v) =>
      v.file.includes("test/should-be-ignored.js"),
    );
    expect(ignored).toBe(false);
    expect(scannedFiles).toBeGreaterThan(0);
  });
});
