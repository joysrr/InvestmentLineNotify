/**
 * newsConflictGrouper.mjs
 *
 * 對新聞清單進行「矛盾事件分群」預處理。
 * 使用 Jaccard 相似度演算法，將標題高度相似的文章歸入同一衝突群組，
 * 並在每篇文章上附加 `_conflictGroup` 欄位（如 'G1', 'G2', ... 或 null）。
 *
 * 設計原則：
 * - 純前置處理，不修改新聞內容或過濾邏輯
 * - 分群失敗不拋出例外，降級為所有文章 _conflictGroup = null
 * - 閾值設定為 0.3（可依觀察調整）
 *
 * 使用範例：
 *   import { assignConflictGroups } from '../news/newsConflictGrouper.mjs';
 *   const tagged = assignConflictGroups(selectedNews);
 *
 * 分群測試案例（伊衝突）：
 *   A: "伊朗與美國傳出正在和談中" → tokenize → ['伊朗', '美國', '和談']
 *   B: "伊朗拒絕和談 重申封鎖海峽" → tokenize → ['伊朗', '拒絕', '和談', '海峽']
 *   intersection = ['伊朗', '和談'] = 2
 *   union = ['伊朗', '美國', '和談', '拒絕', '海峽'] = 5
 *   Jaccard = 2/5 = 0.4 ≥ 0.3 → 歸入同一群組 [G1]
 */

import logger from "../../utils/logger.mjs";

/**
 * Jaccard 相似度閾值：≥ 此值視為同一事件的不同報導
 * 中文 bigram 語意密度高，0.3 是合理門檻；
 * 英文 token 分佈較散，閾值提高至 0.45 以避免跨事件誤分群
 */
const JACCARD_THRESHOLD_TW = 0.3;
const JACCARD_THRESHOLD_US = 0.45;

/**
 * 將標題 tokenize 為詞彙 Set
 * - 中文：以每個字元為一個 token（CJK 統一表意文字範圍）
 * - 英文：以空白分詞，轉小寫
 * - 數字：保留，作為事件定位的關鍵特徵（如：32元、5%）
 * @param {string} title
 * @returns {Set<string>}
 */
function tokenize(title) {
  if (!title || typeof title !== "string") return new Set();

  const tokens = new Set();

  // 英文與數字：以空白分詞，轉小寫
  const latin = title.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ");
  for (const word of latin.split(/\s+/)) {
    const clean = word.replace(/[^a-zA-Z0-9%]/g, "").toLowerCase();
    if (clean.length >= 2) tokens.add(clean);
  }

  // 中文：以 bigram（連續兩字）為 token，保留更多語意
  const cjk = title.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
  for (let i = 0; i < cjk.length - 1; i++) {
    tokens.add(cjk[i] + cjk[i + 1]);
  }
  // 也加入單字（確保短標題仍有 token）
  for (const char of cjk) {
    tokens.add(char);
  }

  return tokens;
}

/**
 * 計算兩個 Set 的 Jaccard 相似度
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} 0~1
 */
function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionCount++;
  }
  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize === 0 ? 0 : intersectionCount / unionSize;
}

/**
 * 對新聞清單進行矛盾分群，回傳附加 `_conflictGroup` 欄位的新陣列。
 *
 * 演算法：
 * 1. 對每篇文章的 title 進行 tokenize
 * 2. 兩兩計算 Jaccard 相似度
 * 3. 相似度 ≥ JACCARD_THRESHOLD 的文章歸入同一群組（Union-Find）
 * 4. 群組大小 ≥ 2 才標記群組 ID（G1, G2...），孤立文章設為 null
 *
 * @param {Array<object>} newsList - 原始新聞陣列，每篇需含 `title` 欄位
 * @returns {Array<object>} 附加 `_conflictGroup` 欄位的新陣列（不修改原陣列）
 */
export function assignConflictGroups(newsList) {
  if (!Array.isArray(newsList) || newsList.length === 0) return newsList;

  try {
    const n = newsList.length;

    // ── Union-Find 初始化 ───────────────────────────────────────────────────
    const parent = Array.from({ length: n }, (_, i) => i);

    function find(x) {
      if (parent[x] !== x) parent[x] = find(parent[x]); // path compression
      return parent[x];
    }

    function union(x, y) {
      const px = find(x);
      const py = find(y);
      if (px !== py) parent[px] = py;
    }

    // ── Token 預計算 ────────────────────────────────────────────────────────
    const tokenSets = newsList.map((article) => tokenize(article?.title ?? ""));

    // ── 兩兩比對 ────────────────────────────────────────────────────────────
    for (let i = 0; i < n; i++) {
      const regionI = newsList[i]?._region || "TW";
      for (let j = i + 1; j < n; j++) {
        const regionJ = newsList[j]?._region || "TW";
        const sim = jaccard(tokenSets[i], tokenSets[j]);

        // 若兩者皆為 US，使用較高的閾值
        const threshold =
          regionI === "US" && regionJ === "US"
            ? JACCARD_THRESHOLD_US
            : JACCARD_THRESHOLD_TW;

        if (sim >= threshold) {
          union(i, j);
        }
      }
    }

    // ── 統計每個根節點的成員數 ──────────────────────────────────────────────
    const rootCount = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      rootCount.set(root, (rootCount.get(root) ?? 0) + 1);
    }

    // ── 為大小 ≥ 2 的群組分配群組 ID ────────────────────────────────────────
    const rootToGroupId = new Map();
    let groupCounter = 1;
    for (const [root, count] of rootCount.entries()) {
      if (count >= 2) {
        rootToGroupId.set(root, `G${groupCounter++}`);
      }
    }

    // ── 輸出：附加 _conflictGroup 欄位 ─────────────────────────────────────
    const result = newsList.map((article, i) => {
      const root = find(i);
      const groupId = rootToGroupId.get(root) ?? null;
      return { ...article, _conflictGroup: groupId };
    });

    // ── Debug log ───────────────────────────────────────────────────────────
    const groupedCount = result.filter((a) => a._conflictGroup !== null).length;
    const totalGroups = rootToGroupId.size;
    if (totalGroups > 0) {
      logger.info(
        { totalGroups, groupedCount, total: n },
        `🔀 [ConflictGrouper] 偵測到 ${totalGroups} 個衝突群組，共 ${groupedCount}/${n} 篇文章被分群`,
      );
    } else {
      logger.info({ n }, `🔀 [ConflictGrouper] 無衝突群組（共 ${n} 篇）`);
    }

    return result;
  } catch (err) {
    // 降級安全：分群失敗不阻斷主流程
    logger.warn(
      { err: err.message },
      "⚠️ [ConflictGrouper] 分群失敗，降級為全 null",
    );
    return newsList.map((article) => ({ ...article, _conflictGroup: null }));
  }
}
