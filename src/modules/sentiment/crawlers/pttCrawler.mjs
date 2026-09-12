// src/modules/sentiment/crawlers/pttCrawler.mjs
//
// 職責：原生 PTT 股版文章列表抓取與 HTML 解析。
// 純 ESM + 原生 fetch，無重度依賴。

import logger from "../../../utils/logger.mjs";

/**
 * 解析 PTT HTML 文章列表與分頁資訊
 * @param {string} html
 * @param {string} baseUrl
 * @returns {{items: Array<Object>, prevUrl: string}}
 */
export function parsePttStockHtml(html, baseUrl = "https://www.ptt.cc") {
  const items = [];
  let prevUrl = "";

  // 取得上一頁連結
  const prevMatch = html.match(
    /<a\s+class="btn\s+wide"\s+href="([^"]+)">‹\s*上頁<\/a>/i,
  );
  if (prevMatch && prevMatch[1]) {
    prevUrl = new URL(prevMatch[1], baseUrl).toString();
  }

  // 匹配每個 r-ent 區塊
  const rEntRegex =
    /<div class="r-ent">([\s\S]*?)<\/div>\s*(?=(?:<div class="r-ent">|<\/div>\s*<\/div>\s*<div id="action-bar-container">|$))/gi;
  let match;

  while ((match = rEntRegex.exec(html)) !== null) {
    const block = match[1];

    // 排除本文已被刪除的條目
    if (block.includes("本文已被刪除") || block.includes("已被刪除")) {
      continue;
    }

    // 提取 title 與 href
    const titleMatch = block.match(
      /<div class="title">\s*<a\s+href="([^"]+)">([\s\S]*?)<\/a>\s*<\/div>/i,
    );
    if (!titleMatch) continue;

    const href = titleMatch[1].trim();
    const title = titleMatch[2]
      .trim()
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");

    // 提取 author
    const authorMatch = block.match(/<div class="author">([\s\S]*?)<\/div>/i);
    const author = authorMatch ? authorMatch[1].trim() : "";

    // 提取 date
    const dateMatch = block.match(/<div class="date">([\s\S]*?)<\/div>/i);
    const dateStr = dateMatch ? dateMatch[1].trim() : "";

    items.push({
      platform: "PTT",
      board: "Stock",
      title,
      author,
      date: dateStr,
      url: new URL(href, baseUrl).toString(),
      published_at: new Date().toISOString(),
    });
  }

  return { items, prevUrl };
}

/**
 * 原生 Fetch PTT 股版最新文章
 * 附帶 over18=1 cookie
 */
export async function fetchPttStockPosts(maxPages = 2) {
  const results = [];
  let currentUrl = "https://www.ptt.cc/bbs/Stock/index.html";

  try {
    for (let page = 0; page < maxPages; page++) {
      if (!currentUrl) break;

      const res = await fetch(currentUrl, {
        headers: {
          Cookie: "over18=1",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) {
        logger.warn(
          { status: res.status, url: currentUrl },
          "PTT 抓取回應非 200",
        );
        break;
      }

      const html = await res.text();
      const { items, prevUrl } = parsePttStockHtml(html, "https://www.ptt.cc");
      results.push(...items);
      currentUrl = prevUrl;
    }
  } catch (err) {
    logger.error(err, "PTT 抓取過程發生錯誤");
  }

  return results;
}
