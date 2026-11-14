import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { ICON_NAMES } from "@/components/common/icon-registry.js";

const SRC = "src";

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("Icon 使用守衛", () => {
  it('所有 <Icon name="..."> 皆存在於 ICON_MAP', () => {
    const files = walk(SRC).filter(
      (f) => f.endsWith(".vue") && !f.includes(".test."),
    );
    const bad = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // 僅檢查 <Icon> 的靜態 name="..."；動態 :name="..." / v-bind:name 無法靜態解析，屬已知限制，不在此範圍。
      for (const m of src.matchAll(/<Icon\b[^>]*?(?<!:)name="([^"]*)"/g)) {
        if (!ICON_NAMES.includes(m[1])) bad.push(`${f} → ${m[1]}`);
      }
    }
    // 動態 :name="..." 無法靜態檢查，屬已知限制，不在此測試範圍。
    expect(bad).toEqual([]);
  });
});
