import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, resolve, relative } from "path";

const SRC_DIR = resolve("src");
const FILE_WHITELIST = [
  "src/styles/tokens.css",
  // theory/ 元件：沿用既有「不動 theory」政策（HEX_AUDIT_2026-11-12.md）
  // 84 處違規全部豁免，由 P8-03 決定是否清除死代碼
  "src/components/theory/",
];
const TEST_FILE_RE = /\.test\.js$|\.spec\.js$/;
const STYLE_OPEN_RE = /<style[^>]*>/;
const STYLE_CLOSE_RE = /<\/style>/;
const ALLOW_RE = /\/\*\s*iln-color-allow:\s*([^*]+?)\s*\*\//;

export { ALLOW_RE, hasValidAllowComment, countColorMatches, scanLine };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      if (statSync(full).isDirectory()) walk(full, out);
      else {
        const ext = extname(name);
        if (ext === ".vue" || ext === ".js" || ext === ".mjs") out.push(full);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return out;
}

function hasValidAllowComment(line) {
  const m = ALLOW_RE.exec(line);
  return m !== null && m[1] && m[1].trim().length > 0;
}

function countColorMatches(line) {
  let count = 0;
  const hexMatches = line.match(/#[0-9a-fA-F]{3,8}\b/g);
  count += hexMatches ? hexMatches.length : 0;
  if (/\brgba?\(/i.test(line)) count++;
  if (/\bhsla?\(/i.test(line)) count++;
  return count;
}

function scanLine(line) {
  if (hasValidAllowComment(line)) return false;
  if (/#[0-9a-fA-F]{3,8}\b/.test(line)) return true;
  if (/\brgba?\(/i.test(line)) return true;
  if (/\bhsla?\(/i.test(line)) return true;
  return false;
}

export function scanColors(srcDir = SRC_DIR) {
  const violations = []; // { file, line, text, matches }
  let scannedFiles = 0;
  let totalLines = 0;
  let totalMatches = 0;

  try {
    const files = walk(srcDir);
    for (const file of files) {
      const rel = "src/" + relative(srcDir, file).replace(/\\/g, "/");
      const isWhitelisted = FILE_WHITELIST.some((w) => {
        if (w.endsWith("/")) return rel.startsWith(w);
        return rel === w;
      });
      if (
        isWhitelisted ||
        TEST_FILE_RE.test(rel) ||
        rel.includes("/test/") ||
        rel.includes("/node_modules/") ||
        rel.includes("/dist/")
      )
        continue;

      const source = readFileSync(file, "utf-8");
      scannedFiles++;

      const fileLines = source.split("\n");

      if (extname(file) === ".vue") {
        // Only scan <style> block content, report file line numbers
        let inStyle = false;
        for (let i = 0; i < fileLines.length; i++) {
          const line = fileLines[i];
          if (STYLE_OPEN_RE.test(line)) inStyle = true;
          if (inStyle) {
            totalLines++;
            if (scanLine(line)) {
              const matches = countColorMatches(line);
              totalMatches += matches;
              violations.push({
                file: rel,
                line: i + 1,
                text: line.trim(),
                matches,
              });
            }
          }
          if (STYLE_CLOSE_RE.test(line)) inStyle = false;
        }
      } else {
        // .js / .mjs: full file scan
        for (let i = 0; i < fileLines.length; i++) {
          const line = fileLines[i];
          totalLines++;
          if (scanLine(line)) {
            const matches = countColorMatches(line);
            totalMatches += matches;
            violations.push({
              file: rel,
              line: i + 1,
              text: line.trim(),
              matches,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error(`❌ check-no-raw-color: 掃描失敗 — ${err.message}`);
    process.exit(2);
  }

  return { violations, scannedFiles, totalLines, totalMatches };
}

function formatAndPrint({ violations, scannedFiles, totalMatches }) {
  const violationFiles = [...new Set(violations.map((v) => v.file))];

  if (violations.length) {
    console.error(
      `❌ check-no-raw-color: 發現 ${violations.length} 處裸色值（${violationFiles.length} 個檔案，${totalMatches} 次出現）`,
    );
    for (const file of violationFiles) {
      const fileViolations = violations
        .filter((v) => v.file === file)
        .sort((a, b) => a.line - b.line);
      console.error(`\n${file}`);
      for (const v of fileViolations) {
        console.error(`  ${v.line}: ${v.text}`);
      }
    }
    console.error(
      "\n提示：請改用 tokens.css 的 --iln-* 令牌；若確有必要（canvas / 業務語義），於同一行加\n      /* iln-color-allow: <理由> */",
    );
    process.exit(1);
  }

  console.log(
    `✅ check-no-raw-color: 0 violations (scanned ${scannedFiles} files)`,
  );
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  formatAndPrint(scanColors());
}
