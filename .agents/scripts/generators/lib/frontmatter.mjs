// scripts/generators/lib/frontmatter.mjs
// 集中 YAML frontmatter 解析（依 PROPOSAL_20260430_005 抽 lib）
//
// 前身：parseFrontmatterText (gen-rules-version-index) /
//      自包含 fm 解析 (gen-proposal-index, gen-proposal-summary, gen-adr-index)
//
// 4 個 generators 共用本檔；任何 frontmatter parsing 變更必先改本檔。

const FM_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * 從 markdown 字串擷取 frontmatter 文字（不含 ---）。
 * @param {string} content - 完整 markdown 內容
 * @returns {string|null} - frontmatter 內文；無則 null
 */
export function extractFrontmatterText(content) {
  const m = content.match(FM_REGEX);
  return m ? m[1] : null;
}

/**
 * 簡化 YAML 解析：每行 key: value；值可加 "" / ''；# 後為註解。
 * 不支援 nested objects / arrays（generator 場景已足夠）。
 *
 * @param {string} text - frontmatter 文字（不含 ---）
 * @returns {Record<string, string>}
 */
export function parseFrontmatterText(text) {
  if (!text) return {};
  const fm = {};
  for (const line of text.split("\n")) {
    // skip comments-only / empty lines
    if (!line.trim() || line.trim().startsWith("#")) continue;
    // match key: value [# comment]
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)(\s+#.*)?$/);
    if (m) {
      fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return fm;
}

/**
 * 一步到位：從檔案內容抽 frontmatter 並解析。
 * @param {string} content - 完整 markdown 內容
 * @returns {Record<string, string>} - 解析後的 frontmatter 物件；無則空物件
 */
export function parseFrontmatter(content) {
  const text = extractFrontmatterText(content);
  return text ? parseFrontmatterText(text) : {};
}
