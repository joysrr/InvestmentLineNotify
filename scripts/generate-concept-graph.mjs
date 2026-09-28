#!/usr/bin/env node
/**
 * Concept Dependency Graph Generator
 *
 * 建立概念依賴圖譜，識別核心概念和孤立節點
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

async function main() {
  console.log("🕸️  概念依賴圖譜生成器\n");
  console.log("=".repeat(60));
  console.log();

  // 載入索引
  const wikiIndex = JSON.parse(
    await fs.readFile(path.join(DOCS_DIR, "wiki-index.json"), "utf-8"),
  );
  const wikiGraph = JSON.parse(
    await fs.readFile(path.join(DOCS_DIR, "wiki-graph.json"), "utf-8"),
  );

  // 計算每個概念的連結數
  const conceptStats = {};
  for (const concept of Object.keys(wikiIndex.concepts)) {
    conceptStats[concept] = {
      outbound: (wikiGraph.graph[concept] || []).length,
      inbound: 0,
      codeLinks: (wikiIndex.concepts[concept].related_code || []).length,
    };
  }

  // 計算 inbound links
  for (const [_source, targets] of Object.entries(wikiGraph.graph)) {
    for (const target of targets) {
      if (conceptStats[target]) {
        conceptStats[target].inbound++;
      }
    }
  }

  // 計算總連結數和重要性
  for (const [_concept, stats] of Object.entries(conceptStats)) {
    stats.total = stats.inbound + stats.outbound + stats.codeLinks;
    stats.importance = stats.inbound * 3 + stats.outbound + stats.codeLinks * 2;
  }

  // 分類
  const isolated = Object.entries(conceptStats)
    .filter(([_c, s]) => s.total === 0)
    .map(([c]) => c);

  const weaklyConnected = Object.entries(conceptStats)
    .filter(([_c, s]) => s.total > 0 && s.total <= 2)
    .map(([c]) => c);

  const coreConcepts = Object.entries(conceptStats)
    .sort((a, b) => b[1].importance - a[1].importance)
    .slice(0, 20)
    .map(([c, s]) => ({ concept: c, ...s }));

  // 統計
  console.log("📊 圖譜統計\n");
  console.log(`   總節點: ${Object.keys(conceptStats).length} 個`);
  console.log(`   總邊: ${wikiIndex.stats.total_edges} 條`);
  console.log(
    `   孤立節點: ${isolated.length} 個 (${((isolated.length / Object.keys(conceptStats).length) * 100).toFixed(1)}%)`,
  );
  console.log(`   弱連結節點: ${weaklyConnected.length} 個`);
  console.log();

  // 核心概念
  console.log("⭐ 核心概念 (Top 20)\n");
  for (const [index, item] of coreConcepts.entries()) {
    const fileData = wikiIndex.concepts[item.concept];
    console.log(`${(index + 1).toString().padStart(2)}. ${item.concept}`);
    console.log(`    文件: ${fileData.primary_doc}`);
    console.log(
      `    連結: ${item.inbound} 入 | ${item.outbound} 出 | ${item.codeLinks} 代碼`,
    );
    console.log(`    重要性: ${item.importance}`);
    console.log();
  }

  // 生成 Mermaid 圖譜（只顯示核心概念的關係）
  const topConcepts = coreConcepts.slice(0, 15).map((c) => c.concept);
  let mermaid = "graph TB\n";

  for (const concept of topConcepts) {
    const links = wikiGraph.graph[concept] || [];
    for (const target of links) {
      if (topConcepts.includes(target)) {
        const sourceLabel = concept.replace(/-/g, "_");
        const targetLabel = target.replace(/-/g, "_");
        mermaid += `  ${sourceLabel}[${concept}] --> ${targetLabel}[${target}]\n`;
      }
    }
  }

  // 添加樣式
  mermaid +=
    "\n  classDef coreNode fill:#e1f5ff,stroke:#0288d1,stroke-width:2px\n";
  for (const concept of topConcepts) {
    mermaid += `  class ${concept.replace(/-/g, "_")} coreNode\n`;
  }

  // 保存圖譜
  const metaDir = path.join(DOCS_DIR, "meta");
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(path.join(metaDir, "concept-graph.mmd"), mermaid);

  // 保存分析結果
  const graphAnalysis = {
    generated_at: new Date().toISOString(),
    stats: {
      total_nodes: Object.keys(conceptStats).length,
      total_edges: wikiIndex.stats.total_edges,
      isolated_nodes: isolated.length,
      weakly_connected: weaklyConnected.length,
      connectivity: (
        (1 - isolated.length / Object.keys(conceptStats).length) *
        100
      ).toFixed(1),
    },
    core_concepts: coreConcepts,
    isolated_nodes: isolated,
    weakly_connected: weaklyConnected,
  };

  await fs.writeFile(
    path.join(metaDir, "graph-analysis.json"),
    JSON.stringify(graphAnalysis, null, 2),
  );

  console.log("=".repeat(60));
  console.log();
  console.log("✅ 圖譜已生成:\n");
  console.log("   - docs/meta/concept-graph.mmd (Mermaid 格式)");
  console.log("   - docs/meta/graph-analysis.json (分析結果)");
  console.log();
  console.log("💡 建議行動:");
  console.log(`   - 優先建立核心概念的 wiki-links`);
  console.log(`   - 連結 ${isolated.length} 個孤立節點`);
  console.log(`   - 強化 ${weaklyConnected.length} 個弱連結節點`);
  console.log();
}

main().catch((err) => {
  console.error("❌ 錯誤:", err);
  process.exit(1);
});
