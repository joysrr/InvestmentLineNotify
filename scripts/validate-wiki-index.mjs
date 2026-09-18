#!/usr/bin/env node
/**
 * Wiki Index Validator
 *
 * 驗證生成的 wiki-index.json 是否可用，並模擬 Agent 使用場景
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

/**
 * 載入索引
 */
async function loadIndex() {
  const indexPath = path.join(DOCS_DIR, "wiki-index.json");
  const graphPath = path.join(DOCS_DIR, "wiki-graph.json");

  const indexContent = await fs.readFile(indexPath, "utf-8");
  const graphContent = await fs.readFile(graphPath, "utf-8");

  return {
    index: JSON.parse(indexContent),
    graph: JSON.parse(graphContent),
  };
}

/**
 * 測試場景 1: Agent 想了解 "Langfuse"
 */
async function testScenario1(wikiIndex, wikiGraph) {
  console.log('🧪 測試場景 1: Agent 查詢 "Langfuse"\n');

  const query = "langfuse";

  // 1. 查找相關概念
  const matchedConcepts = Object.keys(wikiIndex.concepts).filter(
    (concept) =>
      concept.includes(query) ||
      wikiIndex.concepts[concept].tags?.includes(query),
  );

  console.log(`   找到 ${matchedConcepts.length} 個相關概念:\n`);

  for (const concept of matchedConcepts) {
    const data = wikiIndex.concepts[concept];
    console.log(`   📌 ${concept}`);
    console.log(`      標題: ${data.title || "N/A"}`);
    console.log(`      摘要: ${data.summary || "N/A"}`);
    console.log(`      文件: ${data.primary_doc}`);
    console.log(`      代碼: ${data.related_code.join(", ") || "N/A"}`);
    console.log(`      狀態: ${data.status}`);
    console.log(`      標籤: ${data.tags.join(", ") || "N/A"}`);

    // 查找相關連結
    const links = wikiGraph.graph[concept] || [];
    if (links.length > 0) {
      console.log(`      連結到: ${links.join(", ")}`);
    }
    console.log();
  }

  // 2. 計算需要載入的文件數量
  const docsToLoad = new Set();
  for (const concept of matchedConcepts) {
    docsToLoad.add(wikiIndex.concepts[concept].primary_doc);
    wikiIndex.concepts[concept].related_docs.forEach((doc) =>
      docsToLoad.add(doc),
    );
  }

  console.log(`   📊 Agent 需載入 ${docsToLoad.size} 個文件獲得完整上下文`);
  console.log(`   文件列表:`);
  for (const doc of docsToLoad) {
    console.log(`      - ${doc}`);
  }
  console.log();

  return matchedConcepts.length > 0;
}

/**
 * 測試場景 2: Agent 修改代碼後查找相關文件
 */
async function testScenario2(wikiIndex) {
  console.log("🧪 測試場景 2: Agent 修改代碼，查找需更新的文件\n");

  const modifiedCode = "src/modules/ai/langfuseClient.mjs";

  console.log(`   修改的代碼: ${modifiedCode}\n`);

  // 1. 從 code_map 查找相關概念
  const relatedConcepts = wikiIndex.code_map[modifiedCode] || [];

  if (relatedConcepts.length === 0) {
    console.log(`   ⚠️  未找到相關文件（代碼可能未在文件中引用）\n`);
    return false;
  }

  console.log(`   找到 ${relatedConcepts.length} 個相關概念:\n`);

  for (const item of relatedConcepts) {
    console.log(`   📌 ${item.concept}`);
    console.log(`      文件: ${item.doc}`);
    console.log(`      狀態: ${wikiIndex.concepts[item.concept].status}`);
    console.log();
  }

  console.log(`   💡 建議: Agent 應更新這些文件並設定 status: needs-review\n`);

  return true;
}

/**
 * 測試場景 3: Agent 探索知識圖譜
 */
async function testScenario3(wikiIndex, wikiGraph) {
  console.log("🧪 測試場景 3: Agent 探索概念關係\n");

  const startConcept = Object.keys(wikiGraph.graph)[0];

  if (!startConcept) {
    console.log("   ⚠️  沒有知識圖譜連結（文件可能未使用 [[wiki-links]]）\n");
    return false;
  }

  console.log(`   起點: ${startConcept}\n`);

  // 1. 直接連結
  const directLinks = wikiGraph.graph[startConcept] || [];
  console.log(`   直接連結 (${directLinks.length}):`);
  for (const link of directLinks) {
    console.log(`      → ${link}`);
  }
  console.log();

  // 2. 二度連結
  const secondDegreeLinks = new Set();
  for (const link of directLinks) {
    const nextLinks = wikiGraph.graph[link] || [];
    nextLinks.forEach((l) => {
      if (l !== startConcept && !directLinks.includes(l)) {
        secondDegreeLinks.add(l);
      }
    });
  }

  if (secondDegreeLinks.size > 0) {
    console.log(`   二度連結 (${secondDegreeLinks.size}):`);
    for (const link of secondDegreeLinks) {
      console.log(`      ⇒ ${link}`);
    }
    console.log();
  }

  return true;
}

/**
 * 驗證索引完整性
 */
async function validateIntegrity(wikiIndex, wikiGraph) {
  console.log("🔍 驗證索引完整性\n");

  const issues = [];

  // 1. 檢查文件是否存在
  console.log("   檢查文件路徑...");
  let missingFiles = 0;
  for (const [concept, data] of Object.entries(wikiIndex.concepts)) {
    const filePath = path.join(DOCS_DIR, data.primary_doc);
    try {
      await fs.access(filePath);
    } catch {
      missingFiles++;
      issues.push(`文件不存在: ${data.primary_doc} (概念: ${concept})`);
    }
  }
  console.log(
    `      ${missingFiles === 0 ? "✓" : "✗"} ${missingFiles} 個文件缺失\n`,
  );

  // 2. 檢查代碼路徑
  console.log("   檢查代碼路徑...");
  let missingCode = 0;
  const checkedPaths = new Set();

  for (const [concept, data] of Object.entries(wikiIndex.concepts)) {
    for (const codePath of data.related_code) {
      if (checkedPaths.has(codePath)) continue;
      checkedPaths.add(codePath);

      const fullPath = path.join(PROJECT_ROOT, codePath);
      try {
        await fs.access(fullPath);
      } catch {
        missingCode++;
        issues.push(`代碼不存在: ${codePath} (概念: ${concept})`);
      }
    }
  }
  console.log(
    `      ${missingCode === 0 ? "✓" : "✗"} ${missingCode} 個代碼路徑無效\n`,
  );

  // 3. 檢查圖譜連結
  console.log("   檢查圖譜連結...");
  let brokenLinks = 0;
  for (const [source, targets] of Object.entries(wikiGraph.graph)) {
    for (const target of targets) {
      if (!wikiIndex.concepts[target]) {
        brokenLinks++;
        issues.push(`斷裂連結: ${source} → ${target}`);
      }
    }
  }
  console.log(
    `      ${brokenLinks === 0 ? "✓" : "✗"} ${brokenLinks} 個斷裂連結\n`,
  );

  // 4. 顯示問題
  if (issues.length > 0) {
    console.log("   ⚠️  發現問題:\n");
    issues.slice(0, 5).forEach((issue) => console.log(`      - ${issue}`));
    if (issues.length > 5) {
      console.log(`      ... 還有 ${issues.length - 5} 個問題\n`);
    }
  } else {
    console.log("   ✅ 索引完整性驗證通過\n");
  }

  return issues.length === 0;
}

/**
 * 效能對比測試
 */
async function performanceComparison(wikiIndex) {
  console.log("⚡ 效能對比: Wiki Index vs 傳統搜尋\n");

  const query = "langfuse";

  // 方法 1: Wiki Index
  const start1 = Date.now();
  const matchedConcepts = Object.keys(wikiIndex.concepts).filter(
    (concept) =>
      concept.includes(query) ||
      wikiIndex.concepts[concept].tags?.includes(query),
  );
  const docsFromIndex = new Set();
  matchedConcepts.forEach((concept) => {
    docsFromIndex.add(wikiIndex.concepts[concept].primary_doc);
  });
  const time1 = Date.now() - start1;

  console.log(`   Wiki Index:`);
  console.log(`      查詢時間: ${time1}ms`);
  console.log(`      找到文件: ${docsFromIndex.size} 個`);
  console.log(
    `      記憶體: ~${JSON.stringify(wikiIndex).length} bytes (預載)`,
  );
  console.log();

  // 方法 2: 傳統搜尋（模擬）
  console.log(`   傳統搜尋 (search_files + read_file):`);
  console.log(`      查詢時間: ~50-200ms (需實際 I/O)`);
  console.log(`      找到文件: 未知（需逐個檢查內容）`);
  console.log(`      記憶體: 0 (每次都搜尋)`);
  console.log();

  console.log(`   🏆 Wiki Index 優勢:`);
  console.log(`      - 精準度高（概念導向，不是關鍵字）`);
  console.log(`      - 包含關聯資訊（代碼、圖譜）`);
  console.log(`      - 可離線使用`);
  console.log();
}

/**
 * 主函數
 */
async function main() {
  console.log("🔬 Wiki Index 驗證工具\n");
  console.log("=".repeat(60));
  console.log();

  try {
    // 載入索引
    console.log("📥 載入索引...\n");
    const { index: wikiIndex, graph: wikiGraph } = await loadIndex();
    console.log(`   版本: ${wikiIndex.version}`);
    console.log(`   原型模式: ${wikiIndex.prototype ? "是" : "否"}`);
    console.log(`   概念數量: ${wikiIndex.stats.total_concepts}`);
    console.log(`   連結數量: ${wikiIndex.stats.total_edges}`);
    console.log(`   代碼映射: ${wikiIndex.stats.total_code_mappings}`);
    console.log();
    console.log("=".repeat(60));
    console.log();

    // 執行測試場景
    const test1Pass = await testScenario1(wikiIndex, wikiGraph);
    console.log("=".repeat(60));
    console.log();

    const test2Pass = await testScenario2(wikiIndex);
    console.log("=".repeat(60));
    console.log();

    const test3Pass = await testScenario3(wikiIndex, wikiGraph);
    console.log("=".repeat(60));
    console.log();

    // 驗證完整性
    const integrityPass = await validateIntegrity(wikiIndex, wikiGraph);
    console.log("=".repeat(60));
    console.log();

    // 效能對比
    await performanceComparison(wikiIndex);
    console.log("=".repeat(60));
    console.log();

    // 總結
    console.log("📊 驗證總結\n");
    console.log(
      `   場景 1 (查詢概念):       ${test1Pass ? "✅ 通過" : "❌ 失敗"}`,
    );
    console.log(
      `   場景 2 (代碼映射):       ${test2Pass ? "✅ 通過" : "⚠️  需添加 related_code"}`,
    );
    console.log(
      `   場景 3 (知識圖譜):       ${test3Pass ? "✅ 通過" : "⚠️  需添加 [[wiki-links]]"}`,
    );
    console.log(
      `   完整性驗證:             ${integrityPass ? "✅ 通過" : "⚠️  有問題"}`,
    );
    console.log();

    const allPass = test1Pass && integrityPass;

    if (!integrityPass) {
      process.exitCode = 1;
    }

    if (allPass) {
      console.log("🎉 原型驗證成功！\n");
      console.log("建議下一步:");
      console.log("  1. 檢查 docs/wiki-index.json 內容");
      console.log("  2. 手動測試 Agent 使用索引");
      console.log("  3. 如果滿意，擴展到全部文件");
      console.log("  4. 添加 Git hook 自動更新索引");
      console.log();
    } else {
      console.log("⚠️  原型需要改進\n");
      console.log("建議:");
      if (!test2Pass) {
        console.log("  - 在文件 frontmatter 添加 related_code 欄位");
      }
      if (!test3Pass) {
        console.log("  - 在文件中使用 [[wiki-links]] 語法連結概念");
      }
      if (!integrityPass) {
        console.log("  - 修復文件路徑或代碼路徑問題");
      }
      console.log();
    }
  } catch (err) {
    console.error("❌ 錯誤:", err.message);
    console.error();
    console.error("請先執行: node scripts/generate-wiki-index.mjs");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ 未預期的錯誤:", err);
  process.exit(1);
});
