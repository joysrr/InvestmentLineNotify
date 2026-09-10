#!/usr/bin/env node
/**
 * Documentation Health Analyzer
 *
 * 分析所有文件的健康度，生成優先處理清單
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

/**
 * 載入 Wiki 索引
 */
async function loadWikiIndex() {
  const content = await fs.readFile(
    path.join(DOCS_DIR, "wiki-index.json"),
    "utf-8",
  );
  return JSON.parse(content);
}

/**
 * 獲取文件的 git 最後修改時間
 */
function getFileLastModified(filePath) {
  try {
    const result = execSync(`git log -1 --format=%at -- "${filePath}"`, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    }).trim();
    return result ? parseInt(result) * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * 計算文件健康度評分 (0-100)
 */
function calculateHealthScore(concept, data, filePath) {
  let score = 0;
  const issues = [];
  const suggestions = [];

  // 1. Frontmatter 存在 (+20)
  if (data.status !== "unknown") {
    score += 20;
  } else {
    issues.push("缺少 frontmatter");
    suggestions.push("添加 YAML frontmatter");
  }

  // 2. 狀態標記 (+10)
  if (data.status === "current") {
    score += 10;
  } else if (data.status === "needs-review") {
    score += 5;
    issues.push("需要審查");
  } else {
    issues.push("狀態未知");
  }

  // 3. 最後驗證日期 (+15)
  if (data.last_verified) {
    const daysSince =
      (Date.now() - new Date(data.last_verified).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < 30) {
      score += 15;
    } else if (daysSince < 90) {
      score += 10;
      issues.push(`${Math.floor(daysSince)} 天未驗證`);
    } else {
      score += 5;
      issues.push(`${Math.floor(daysSince)} 天未驗證（過時）`);
      suggestions.push("驗證並更新內容");
    }
  } else {
    issues.push("從未驗證");
    suggestions.push("添加 last_verified 日期");
  }

  // 4. 相關代碼 (+15)
  if (data.related_code && data.related_code.length > 0) {
    score += 15;
  } else {
    issues.push("缺少代碼連結");
    suggestions.push("添加 related_code");
  }

  // 5. 相關文件 (+10)
  if (data.related_docs && data.related_docs.length > 0) {
    score += 10;
  } else {
    issues.push("缺少文件連結");
    suggestions.push("添加 related_docs");
  }

  // 6. 標籤 (+10)
  if (data.tags && data.tags.length > 0) {
    score += 10;
  } else {
    issues.push("缺少標籤");
    suggestions.push("添加 tags");
  }

  // 7. 標題和摘要 (+10)
  if (data.title && data.summary) {
    score += 10;
  } else if (data.title) {
    score += 5;
    issues.push("缺少摘要");
  } else {
    issues.push("缺少標題和摘要");
  }

  // 8. Git 修改時間檢查 (+10)
  const lastModified = getFileLastModified(filePath);
  if (lastModified) {
    const daysSince = (Date.now() - lastModified) / (1000 * 60 * 60 * 24);
    if (daysSince < 90) {
      score += 10;
    } else {
      score += 5;
      issues.push(`${Math.floor(daysSince)} 天未修改`);
    }
  }

  return { score, issues, suggestions };
}

/**
 * 判斷文件類別
 */
function categorizeFile(filePath) {
  if (filePath.includes("modules/")) return "reference";
  if (
    filePath.includes("architecture/") ||
    filePath.includes("decisions/") ||
    filePath.includes("design/")
  )
    return "explanation";
  if (
    filePath.includes("guides/") ||
    filePath.includes("GUIDE") ||
    filePath.includes("CHECKLIST")
  )
    return "guide";
  if (filePath.includes("api/")) return "reference";
  if (filePath.includes("plans/")) return "plan";
  if (filePath.includes("Reports/")) return "report";
  return "other";
}

/**
 * 計算影響力評分
 */
function calculateImpactScore(concept, data, wikiIndex, wikiGraph) {
  let impact = 0;

  // 1. 被引用次數（inbound links）
  let inboundCount = 0;
  for (const [source, targets] of Object.entries(wikiGraph.graph || {})) {
    if (targets.includes(concept)) {
      inboundCount++;
    }
  }
  impact += inboundCount * 5;

  // 2. 引用次數（outbound links）
  const outboundCount = (wikiGraph.graph[concept] || []).length;
  impact += outboundCount * 2;

  // 3. 代碼連結數
  impact += (data.related_code || []).length * 10;

  // 4. 類別權重
  const category = categorizeFile(data.primary_doc);
  const categoryWeights = {
    reference: 10, // 模組文件最重要
    explanation: 8, // ADR/DEC 次之
    guide: 7,
    report: 3,
    plan: 5,
    other: 2,
  };
  impact += categoryWeights[category] || 0;

  return impact;
}

/**
 * 主函數
 */
async function main() {
  console.log("📊 文件健康度分析工具\n");
  console.log("=".repeat(60));
  console.log();

  // 載入索引
  const wikiIndex = await loadWikiIndex();
  const wikiGraph = JSON.parse(
    await fs.readFile(path.join(DOCS_DIR, "wiki-graph.json"), "utf-8"),
  );

  console.log(`📂 分析 ${wikiIndex.stats.total_concepts} 個文件...\n`);

  // 分析每個文件
  const results = [];
  for (const [concept, data] of Object.entries(wikiIndex.concepts)) {
    const filePath = path.join(DOCS_DIR, data.primary_doc);
    const health = calculateHealthScore(concept, data, filePath);
    const impact = calculateImpactScore(concept, data, wikiIndex, wikiGraph);
    const category = categorizeFile(data.primary_doc);

    results.push({
      concept,
      filePath: data.primary_doc,
      category,
      health: health.score,
      impact,
      priority: health.score < 60 ? (100 - health.score) * (impact / 10) : 0,
      issues: health.issues,
      suggestions: health.suggestions,
      status: data.status,
    });
  }

  // 統計
  const totalScore =
    results.reduce((sum, r) => sum + r.health, 0) / results.length;
  const byCategory = {};
  const byHealth = { excellent: 0, good: 0, fair: 0, poor: 0 };

  for (const result of results) {
    // 按類別統計
    if (!byCategory[result.category]) {
      byCategory[result.category] = { count: 0, avgHealth: 0, totalHealth: 0 };
    }
    byCategory[result.category].count++;
    byCategory[result.category].totalHealth += result.health;

    // 按健康度統計
    if (result.health >= 80) byHealth.excellent++;
    else if (result.health >= 60) byHealth.good++;
    else if (result.health >= 40) byHealth.fair++;
    else byHealth.poor++;
  }

  // 計算平均值
  for (const cat of Object.values(byCategory)) {
    cat.avgHealth = Math.round(cat.totalHealth / cat.count);
  }

  // 顯示總體統計
  console.log("📈 總體健康度\n");
  console.log(`   平均評分: ${totalScore.toFixed(1)}/100`);
  console.log(`   優秀 (≥80): ${byHealth.excellent} 個`);
  console.log(`   良好 (60-79): ${byHealth.good} 個`);
  console.log(`   一般 (40-59): ${byHealth.fair} 個`);
  console.log(`   差 (<40): ${byHealth.poor} 個`);
  console.log();

  // 按類別顯示
  console.log("📊 按類別統計\n");
  const sortedCategories = Object.entries(byCategory).sort(
    (a, b) => b[1].avgHealth - a[1].avgHealth,
  );
  for (const [cat, stats] of sortedCategories) {
    console.log(
      `   ${cat.padEnd(15)} ${stats.count} 個 | 平均 ${stats.avgHealth}/100`,
    );
  }
  console.log();

  // 優先處理清單（健康度<60 且影響力高）
  const priorityList = results
    .filter((r) => r.health < 60)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 20);

  console.log(`🔥 優先處理清單 (Top 20)\n`);
  for (const [index, item] of priorityList.entries()) {
    console.log(
      `${(index + 1).toString().padStart(2)}. ${item.concept} (${item.health}/100)`,
    );
    console.log(
      `    分類: ${item.category} | 影響力: ${item.impact} | 優先級: ${Math.round(item.priority)}`,
    );
    console.log(`    問題: ${item.issues.slice(0, 3).join(", ")}`);
    console.log();
  }

  // 生成報告文件
  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total_files: results.length,
      average_health: Math.round(totalScore * 10) / 10,
      by_health: byHealth,
      by_category: byCategory,
    },
    priority_list: priorityList.slice(0, 50).map((item) => ({
      concept: item.concept,
      file: item.filePath,
      category: item.category,
      health: item.health,
      impact: item.impact,
      priority: Math.round(item.priority),
      issues: item.issues,
      suggestions: item.suggestions,
    })),
    all_files: results.map((r) => ({
      concept: r.concept,
      file: r.filePath,
      category: r.category,
      health: r.health,
      status: r.status,
    })),
  };

  const metaDir = path.join(DOCS_DIR, "meta");
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(
    path.join(metaDir, "health-report.json"),
    JSON.stringify(report, null, 2),
  );

  console.log("=".repeat(60));
  console.log();
  console.log("✅ 報告已生成: docs/meta/health-report.json\n");
  console.log("建議行動:");
  console.log("  1. 優先處理 Top 20 高影響力文件");
  console.log("  2. 按類別逐步改善 (reference → explanation → guide)");
  console.log("  3. 使用建議清單批次處理\n");
}

main().catch((err) => {
  console.error("❌ 錯誤:", err);
  process.exit(1);
});
