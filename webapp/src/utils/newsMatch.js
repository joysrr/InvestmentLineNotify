/**
 * 新聞資料源釐清工具（CARD-02）
 *
 * 提供新聞去重與地區分類，供 NewsView / NewsCard 使用。
 * 僅純函數，無外部依賴，易於單元測試。
 */

/** 已知台灣財經來源關鍵字（來源欄位包含任一即判為台灣市場） */
const TW_SOURCE_KEYWORDS = [
  "鉅亨網",
  "ETtoday",
  "自由財經",
  "蘋果日報",
  "商業週刊",
  "今周刊",
];

/**
 * 依文章 URL 去重，保留第一次出現的文章。
 * 支援 `url` 與 `link` 兩種欄位（NewsView 回退欄位）。
 * @param {Array} articles 文章陣列
 * @returns {Array} 去重後的文章陣列
 */
export function dedupeByUrl(articles) {
  if (!Array.isArray(articles)) return [];
  const seen = new Set();
  return articles.filter((a) => {
    const url = a && (a.url || a.link || a.id);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/**
 * 判斷文章是否屬於台灣市場（依來源欄位關鍵字）。
 * @param {Object} article 文章物件
 * @returns {boolean}
 */
export function isTaiwanMarket(article) {
  if (!article || !article.source) return false;
  const source = String(article.source);
  return TW_SOURCE_KEYWORDS.some((kw) => source.includes(kw));
}

/**
 * 分類文章地區：台灣市場回傳 "tw"，否則回傳 "us"。
 * @param {Object} article 文章物件
 * @returns {"tw" | "us"}
 */
export function categorizeRegion(article) {
  return isTaiwanMarket(article) ? "tw" : "us";
}

/**
 * 判斷 pool 文章是否已在精選列表中。
 * 比對順序：link 優先、title 次之。
 * @param {Object} poolArticle 池中文章
 * @param {Array} featuredList 精選文章陣列
 * @returns {boolean}
 */
export function matchFeatured(poolArticle, featuredList) {
  if (!poolArticle || !Array.isArray(featuredList)) return false;

  const poolLink = poolArticle.link || poolArticle.url;
  const poolTitle = poolArticle.title;

  return featuredList.some((f) => {
    if (!f) return false;
    const fLink = f.link || f.url;
    const fTitle = f.title;

    if (poolLink && fLink && poolLink === fLink) return true;
    if (poolTitle && fTitle && poolTitle === fTitle) return true;
    return false;
  });
}
