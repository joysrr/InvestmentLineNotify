#!/usr/bin/env node
/**
 * LLM Wiki Index Generator
 *
 * 掃描 docs/ 目錄下的 Markdown 文件，提取：
 * 1. 概念 → 文件映射
 * 2. 代碼 → 文件映射
 * 3. 知識圖譜（概念間關係）
 *
 * 生成：
 * - docs/wiki-index.json
 * - docs/wiki-graph.json
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

// 全面掃描模式：處理所有目錄（排除特定目錄）
const EXCLUDED_DIRS = ["node_modules", ".git", ".hermes"];

// 檢查是否為原型模式
const isPrototype = process.argv.includes("--prototype");

const PROTOTYPE_DIRS = [
  "modules/ai_news",
  "modules/presentation",
  "architecture",
];

const SCAN_DIRS = isPrototype ? PROTOTYPE_DIRS : null; // null = 掃描全部

/**
 * 提取 YAML frontmatter
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const frontmatter = {};

  // 簡單 YAML 解析（僅處理基本格式）
  const lines = yaml.split("\n");
  let currentKey = null;

  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      currentKey = key;

      if (value.startsWith("[")) {
        // 陣列格式：key: [item1, item2]
        frontmatter[key] = value
          .replace(/[[\]]/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (value) {
        frontmatter[key] = value;
      } else {
        frontmatter[key] = [];
      }
    } else if (currentKey && line.match(/^\s+-\s+(.+)$/)) {
      // 陣列格式：
      // key:
      //   - item1
      //   - item2
      const item = line.match(/^\s+-\s+(.+)$/)[1];
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = [];
      }
      frontmatter[currentKey].push(item);
    }
  }

  return frontmatter;
}

/**
 * 提取 Wiki 連結 [[concept]]
 */
function extractWikiLinks(content) {
  const links = [];
  // Match [[concept]] - no escaping needed inside character class
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return links;
}

/**
 * 提取標題和摘要
 */
function extractTitleAndSummary(content) {
  // 移除 frontmatter
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, "");

  // 提取第一個 # 標題
  const titleMatch = withoutFrontmatter.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : null;

  // 提取摘要（第一個 > 引用或第一段）
  const summaryMatch = withoutFrontmatter.match(/>\s+\*\*摘要\*\*:\s*(.+)$/m);
  const summary = summaryMatch ? summaryMatch[1] : null;

  return { title, summary };
}

/**
 * 從文件路徑推斷概念名稱
 */
function inferConceptFromPath(filePath) {
  const basename = path.basename(filePath, ".md");

  // 特殊處理
  if (basename === "_index") {
    return path.basename(path.dirname(filePath));
  }

  // 轉換為 kebab-case
  return basename.replace(/_/g, "-").toLowerCase();
}

/**
 * 掃描單個文件
 */
async function scanDocument(filePath, relativePath) {
  const content = await fs.readFile(filePath, "utf-8");
  const frontmatter = extractFrontmatter(content);
  const wikiLinks = extractWikiLinks(content);
  const { title, summary } = extractTitleAndSummary(content);
  const concept = inferConceptFromPath(relativePath);

  return {
    path: relativePath,
    concept,
    title,
    summary,
    frontmatter,
    wikiLinks,
  };
}

/**
 * 遞迴掃描目錄
 */
async function scanDirectory(dirPath, baseDir = dirPath) {
  const documents = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // 跳過排除的目錄
    if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      const subDocs = await scanDirectory(fullPath, baseDir);
      documents.push(...subDocs);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const relativePath = path.relative(baseDir, fullPath);
      const doc = await scanDocument(fullPath, relativePath);
      documents.push(doc);
    }
  }

  return documents;
}

/**
 * 建立概念索引
 */
function buildConceptIndex(documents) {
  const concepts = {};

  for (const doc of documents) {
    const { concept, path, title, summary, frontmatter } = doc;

    if (!concepts[concept]) {
      concepts[concept] = {
        primary_doc: path,
        title: title || concept,
        summary: summary || null,
        related_docs: [],
        related_code: [],
        tags: [],
        status: "unknown",
        last_verified: null,
      };
    }

    // 從 frontmatter 提取資訊
    if (frontmatter) {
      if (frontmatter.related_code) {
        concepts[concept].related_code.push(...frontmatter.related_code);
      }
      if (frontmatter.related_docs) {
        concepts[concept].related_docs.push(...frontmatter.related_docs);
      }
      if (frontmatter.tags) {
        concepts[concept].tags.push(...frontmatter.tags);
      }
      if (frontmatter.status) {
        concepts[concept].status = frontmatter.status;
      }
      if (frontmatter.last_verified) {
        concepts[concept].last_verified = frontmatter.last_verified;
      }
    }
  }

  return concepts;
}

/**
 * 建立知識圖譜
 */
function buildKnowledgeGraph(documents) {
  const graph = {};

  for (const doc of documents) {
    const { concept, wikiLinks } = doc;

    if (wikiLinks.length > 0) {
      graph[concept] = wikiLinks.map((link) =>
        link.toLowerCase().replace(/\s+/g, "-"),
      );
    }
  }

  return graph;
}

/**
 * 建立代碼映射（反向索引）
 */
function buildCodeMap(concepts) {
  const codeMap = {};

  for (const [concept, data] of Object.entries(concepts)) {
    for (const codePath of data.related_code) {
      if (!codeMap[codePath]) {
        codeMap[codePath] = [];
      }
      codeMap[codePath].push({
        concept,
        doc: data.primary_doc,
      });
    }
  }

  return codeMap;
}

/**
 * 生成統計資訊
 */
function generateStats(concepts, graph, codeMap) {
  return {
    total_concepts: Object.keys(concepts).length,
    total_edges: Object.values(graph).reduce(
      (sum, links) => sum + links.length,
      0,
    ),
    total_code_mappings: Object.keys(codeMap).length,
    concepts_with_code: Object.values(concepts).filter(
      (c) => c.related_code.length > 0,
    ).length,
    concepts_with_links: Object.keys(graph).length,
    generated_at: new Date().toISOString(),
  };
}

/**
 * 主函數
 */
async function main() {
  const mode = isPrototype ? "Prototype" : "Full Scan";
  console.log(`🚀 LLM Wiki Index Generator - ${mode}\n`);

  // 掃描文件
  console.log("📂 掃描文件...");
  const allDocuments = [];

  if (SCAN_DIRS) {
    // 原型模式：只掃描指定目錄
    for (const dir of SCAN_DIRS) {
      const fullPath = path.join(DOCS_DIR, dir);
      try {
        const docs = await scanDirectory(fullPath, DOCS_DIR);
        allDocuments.push(...docs);
        console.log(`   ✓ ${dir}: ${docs.length} 個文件`);
      } catch (err) {
        console.error(`   ✗ ${dir}: ${err.message}`);
      }
    }
  } else {
    // 全面掃描：掃描整個 docs 目錄
    try {
      const docs = await scanDirectory(DOCS_DIR, DOCS_DIR);
      allDocuments.push(...docs);
      console.log(`   ✓ 全部掃描: ${docs.length} 個文件`);
    } catch (err) {
      console.error(`   ✗ 掃描失敗: ${err.message}`);
      throw err;
    }
  }

  console.log(`\n📊 總計: ${allDocuments.length} 個文件\n`);

  // 建立索引
  console.log("🔨 建立索引...");
  const concepts = buildConceptIndex(allDocuments);
  const graph = buildKnowledgeGraph(allDocuments);
  const codeMap = buildCodeMap(concepts);
  const stats = generateStats(concepts, graph, codeMap);

  console.log(`   ✓ 概念: ${stats.total_concepts} 個`);
  console.log(`   ✓ 連結: ${stats.total_edges} 條`);
  console.log(`   ✓ 代碼映射: ${stats.total_code_mappings} 個\n`);

  // 生成索引檔案
  console.log("💾 生成索引檔案...");

  const wikiIndex = {
    version: "1.0.0",
    prototype: isPrototype,
    scanned_dirs: isPrototype ? SCAN_DIRS : ["all"],
    stats,
    concepts,
    code_map: codeMap,
  };

  const wikiGraph = {
    version: "1.0.0",
    prototype: isPrototype,
    stats: {
      nodes: Object.keys(concepts).length,
      edges: stats.total_edges,
    },
    graph,
  };

  await fs.writeFile(
    path.join(DOCS_DIR, "wiki-index.json"),
    JSON.stringify(wikiIndex, null, 2),
    "utf-8",
  );
  console.log("   ✓ docs/wiki-index.json");

  await fs.writeFile(
    path.join(DOCS_DIR, "wiki-graph.json"),
    JSON.stringify(wikiGraph, null, 2),
    "utf-8",
  );
  console.log("   ✓ docs/wiki-graph.json\n");

  // 顯示範例
  console.log("📋 範例概念:\n");
  const sampleConcepts = Object.entries(concepts).slice(0, 3);
  for (const [concept, data] of sampleConcepts) {
    console.log(`   ${concept}:`);
    console.log(`     📄 ${data.primary_doc}`);
    console.log(`     💻 代碼: ${data.related_code.length} 個`);
    console.log(`     🔗 連結: ${graph[concept]?.length || 0} 條`);
    console.log();
  }

  console.log("✅ 完成！\n");
  console.log("下一步：");
  console.log("  1. 檢查 docs/wiki-index.json");
  console.log("  2. 執行驗證腳本: node scripts/validate-wiki-index.mjs");
  console.log("  3. 如果成功，擴展到全部文件\n");
}

main().catch((err) => {
  console.error("❌ 錯誤:", err);
  process.exit(1);
});
