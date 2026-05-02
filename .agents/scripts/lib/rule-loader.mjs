// rule-loader.mjs
// Rule + Iron Themes composition loader
// 由 PROPOSAL_20260501_002 Phase F + ADR-0037 建立
//
// 用途：載入 rules/<agent>.md 時自動 compose 對應 iron-rules/ themes，
// 提供子 Agent 完整 context（rule + theme bodies）。
//
// API:
//   loadRuleWithThemes(agentId)
//     → { rule, themes, totalContext, totalTokens }

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../../tests/lib/frontmatter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, "..", "..");
const RULES_DIR = join(AGENTS_ROOT, "rules");
const IRON_RULES_DIR = join(AGENTS_ROOT, "iron-rules");

/**
 * Estimate tokens (對齊 schema-validator 公式)
 * @param {string} content
 * @returns {number}
 */
export function estimateTokens(content) {
  const bytes = Buffer.byteLength(content, "utf-8");
  return Math.round((bytes * 0.6) / 4);
}

/**
 * Parse multi-line YAML list field（簡易實作；對齊 iron-theme-validator）
 */
function parseMultilineList(content, key) {
  const re = new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+\\S.*\\n?)+)`, "m");
  const m = content.match(re);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.match(/^\s+-\s+(.+?)$/))
    .filter(Boolean)
    .map((m) => m[1].trim().replace(/^["']|["']$/g, ""));
}

/**
 * 載入單一 rule（不含 themes）
 */
export function loadRule(agentId) {
  const path = join(RULES_DIR, `${agentId}.md`);
  if (!existsSync(path)) throw new Error(`Rule not found: rules/${agentId}.md`);
  const content = readFileSync(path, "utf-8");
  const fm = parseFrontmatter(content) || {};
  const themeIds = parseMultilineList(content, "applies_iron_themes");
  return { agentId: fm.agent_id || agentId, path, content, fm, themeIds };
}

/**
 * 載入單一 iron theme
 */
export function loadIronTheme(themeId) {
  const path = join(IRON_RULES_DIR, `${themeId}.md`);
  if (!existsSync(path))
    throw new Error(`Iron theme not found: iron-rules/${themeId}.md`);
  const content = readFileSync(path, "utf-8");
  const fm = parseFrontmatter(content) || {};
  return { themeId: fm.theme_id || themeId, path, content, fm };
}

/**
 * 載入 rule + 所有引用的 iron themes，組成完整 context
 *
 * @param {string} agentId - 目標 agent rule 檔名（不含 .md）
 * @returns {object}
 *   {
 *     rule: { agentId, path, content, fm, themeIds },
 *     themes: [{ themeId, path, content, fm }, ...],
 *     totalContext: string  -- rule.content + themes 串接
 *     totalTokens: number   -- 估計 tokens（rule + themes）
 *   }
 */
export function loadRuleWithThemes(agentId) {
  const rule = loadRule(agentId);
  const themes = rule.themeIds.map(loadIronTheme);
  const totalContext = [
    rule.content,
    ...themes.map((t) => `\n\n<!-- IRON_THEME: ${t.themeId} -->\n${t.content}`),
  ].join("");
  const totalTokens = estimateTokens(totalContext);
  return { rule, themes, totalContext, totalTokens };
}

/**
 * 列出所有引用同一 theme 的 rules（反查；用於 audit）
 */
export function findRulesByTheme(themeId) {
  const ruleFiles = readdirSync(RULES_DIR).filter((f) => f.endsWith(".md"));
  const matches = [];
  for (const f of ruleFiles) {
    const path = join(RULES_DIR, f);
    const content = readFileSync(path, "utf-8");
    const themeIds = parseMultilineList(content, "applies_iron_themes");
    if (themeIds.includes(themeId)) {
      const fm = parseFrontmatter(content) || {};
      matches.push({ agentId: fm.agent_id, path });
    }
  }
  return matches;
}

// CLI 入口（測試用）
if (import.meta.url === `file://${process.argv[1]}`) {
  const agentId = process.argv[2];
  if (!agentId) {
    console.error("Usage: node rule-loader.mjs <agent_id>");
    console.error("Example: node rule-loader.mjs reviewer");
    process.exit(1);
  }
  const result = loadRuleWithThemes(agentId);
  console.log(`Rule: ${result.rule.path}`);
  console.log(`Themes (${result.themes.length}):`);
  for (const t of result.themes) {
    console.log(`  - ${t.themeId} (${t.path})`);
  }
  console.log(`Total tokens: ${result.totalTokens}`);
  console.log(`---`);
  console.log(`Context preview (first 500 chars):`);
  console.log(result.totalContext.slice(0, 500));
}
