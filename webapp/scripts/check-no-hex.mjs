import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const SRC_DIR = "src";
const WHITELIST = new Set(["src/styles/tokens.css"]);
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(name) === ".vue") out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(SRC_DIR)) {
  const rel = file.replace(/\\/g, "/");
  if (WHITELIST.has(rel)) continue;
  const source = readFileSync(file, "utf8");
  let match;
  while ((match = STYLE_BLOCK_RE.exec(source)) !== null) {
    const block = match[1];
    const hits = block.match(HEX_RE);
    if (hits) {
      violations.push({ file: rel, hex: [...new Set(hits)] });
    }
  }
}

if (violations.length) {
  console.error("❌ 發現 .vue <style> 區塊內的裸 hex 色值：");
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.hex.join(", ")}`);
  }
  process.exit(1);
}
console.log("✅ 未發現裸 hex 色值");
