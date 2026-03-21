import Parser from "rss-parser";
import { escapeHTML } from "../utils/coreUtils.mjs";
import {
  filterAndCategorizeAllNewsWithAI,
  generateDailySearchQueries,
} from "./ai/aiCoach.mjs";

const parser = new Parser();

function getNewsEmoji(sentiment) {
  const s = String(sentiment).toLowerCase();
  if (s === "bullish" || s === "positive") return "📈";
  if (s === "bearish" || s === "negative") return "📉";
  if (s === "warning") return "⚠️";
  return "📰"; // Neutral
}

/**
 * 抓取單一 RSS 連結的輔助函式
 */
async function fetchRssFeed(url, maxItems = 10, sourceTag = "") {
  try {
    const feed = await parser.parseURL(url);
    // 我們在抓取時，偷偷在每則新聞的物件上加上我們自己定義的標籤
    return feed.items.slice(0, maxItems).map((item) => ({
      ...item,
      _region: sourceTag, // 用來標記這是從台灣還是國際的 RSS 抓來的
    }));
  } catch (error) {
    console.error(`抓取 RSS 失敗 (${url}):`, error.message);
    return [];
  }
}

export async function getNewsTelegramMessages(marketData) {
  console.log("開始抓取並透過 AI 一次性過濾所有財經新聞...");

  // 1. 取得 AI 生成的動態擴充關鍵字
  const aiQueries = await generateDailySearchQueries(marketData);

  // 2. 定義你的「基礎必搜清單」(絕對不能漏掉的)
  const baseTwQueries = [
    // 核心標的 (強制出現在標題，確保新聞主角是它們)
    { keyword: "台股", searchType: "intitle" },
    { keyword: "大盤", searchType: "intitle" },
    { keyword: "0050", searchType: "intitle" },
    { keyword: "台積電", searchType: "intitle" },

    // 資金與籌碼面 (廣泛搜尋，內文提到即可)
    { keyword: "外資", searchType: "broad" }, // 涵蓋賣超、買超、空單
    { keyword: "央行", searchType: "broad" }, // 涵蓋升息、降息、打房限貸

    // 基本面與經濟環境 (廣泛搜尋)
    { keyword: "通膨", searchType: "broad" }, // 民生與物價
    { keyword: "出口", searchType: "broad" }, // 台灣經濟命脈 (包含外銷訂單)
  ];

  const baseUsQueries = [
    // 核心指數與指標 (強制出現在標題)
    { keyword: "S&P 500", searchType: "intitle" },
    { keyword: "Nasdaq", searchType: "intitle" },
    { keyword: "CPI", searchType: "intitle" }, // 消費者物價指數 (通膨核心)

    // 貨幣政策與重要人物 (廣泛搜尋)
    { keyword: "Federal Reserve", searchType: "broad" }, // 聯準會全名
    { keyword: "Fed", searchType: "broad" }, // 聯準會縮寫
    { keyword: "Powell", searchType: "broad" }, // 鮑爾 (通常講話會引發大波動)

    // 總經指標與風險 (廣泛搜尋)
    { keyword: "inflation", searchType: "broad" }, // 通膨
    { keyword: "payrolls", searchType: "broad" }, // 就業數據 (非農)
    { keyword: "recession", searchType: "broad" }, // 經濟衰退擔憂
  ];

  // 3. 輔助函數：合併基礎清單與 AI 清單，並去重
  const mergeAndFormatQueries = (baseList, aiList) => {
    // 使用 Map 以 keyword 為 key 進行去重 (以 AI 的設定覆蓋基礎設定，或保留基礎)
    const mergedMap = new Map();

    // 先塞基礎
    baseList.forEach((item) => mergedMap.set(item.keyword.toLowerCase(), item));

    // 再塞 AI 產生的 (如果重複了，可以選擇不覆蓋或覆蓋，這裡選擇不覆蓋基礎的 searchType)
    (aiList || []).forEach((item) => {
      const k = item.keyword.toLowerCase();
      if (!mergedMap.has(k)) {
        mergedMap.set(k, item);
      }
    });

    // 將物件轉換成 Google News 查詢字串
    // 例如：{ keyword: "台股", searchType: "intitle" } -> 'intitle:"台股"'
    // 例如：{ keyword: "外資", searchType: "broad" }   -> '"外資"'
    const formattedStrings = Array.from(mergedMap.values()).map((obj) => {
      if (obj.searchType === "intitle") {
        return `intitle:"${obj.keyword}"`;
      }
      return `"${obj.keyword}"`;
    });

    // 把這些字串用 OR 串起來，並加上 when:24h
    // 結果會像: (intitle:"台股" OR intitle:"大盤" OR "外資" OR "降息") when:24h
    return `(${formattedStrings.join(" OR ")}) when:24h`;
  };

  // 4. 產出最終的查詢字串
  const finalTwQuery = mergeAndFormatQueries(
    baseTwQueries,
    aiQueries.twQueries,
  );
  const finalUsQuery = mergeAndFormatQueries(
    baseUsQueries,
    aiQueries.usQueries,
  );

  // 5. 組合 URL 並發出請求
  const buildUrl = (queryStr, gl, hl, ceid) => {
    return `https://news.google.com/rss/search?${new URLSearchParams({
      q: queryStr,
      hl,
      gl,
      ceid,
      scoring: "n",
    }).toString()}`;
  };

  const twUrl = buildUrl(finalTwQuery, "TW", "zh-TW", "TW:zh-Hant");
  const usUrl = buildUrl(finalUsQuery, "US", "en-US", "US:en");

  // 2. 並發抓取，但在抓取時打上 Tag (TW / US)
  const [rawTwNews, rawUsNews] = await Promise.all([
    fetchRssFeed(twUrl, 40, "TW"),
    fetchRssFeed(usUrl, 40, "US"),
  ]);

  // 3. 將兩邊新聞合併成一個大陣列
  const allRawNews = [...rawTwNews, ...rawUsNews];

  // 4. 一次性交給 AI 處理
  const processedNews = await filterAndCategorizeAllNewsWithAI(allRawNews);

  if (processedNews.length === 0) {
    return [{ text: "<i>過去 24 小時內無符合策略之重大市場動態。</i>" }];
  }

  // 5. 在 Node.js 端利用 Reduce 將結果重新分組 (GroupBy Region)
  const groupedNews = processedNews.reduce(
    (acc, current) => {
      // 依據我們在抓取時偷偷塞進去的 _region 來分組
      const region = current._region;
      if (!acc[region]) acc[region] = [];
      acc[region].push(current);
      return acc;
    },
    { TW: [], US: [] },
  ); // 預設給兩個空陣列

  // 6. 排版 Telegram 訊息
  const todayStr = new Date().toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
  });

  const buildSection = (newsList, sectionTitle) => {
    // 如果該區塊沒有新聞，直接回傳空字串
    if (!newsList || newsList.length === 0) return "";

    let sectionText = `<b>${sectionTitle}</b> ｜ <code>${todayStr}</code>\n\n`;

    newsList.forEach((item, index) => {
      // 拆分標題與媒體來源
      const titleParts = item.title.split(/ - | \| /);
      const cleanTitle = titleParts[0];
      const mediaName =
        titleParts.length > 1 ? titleParts[titleParts.length - 1] : "News";

      // 取得情緒的 Emoji
      const emoji = getNewsEmoji(item.sentiment);

      // 處理時間格式 (加入 yyyy/MM/dd)
      const pubDate = new Date(item.pubDate);
      let timeString = "時間未知";

      if (!isNaN(pubDate.getTime())) {
        const yyyy = pubDate.getFullYear();
        const MM = String(pubDate.getMonth() + 1).padStart(2, "0");
        const dd = String(pubDate.getDate()).padStart(2, "0");

        const hhmm = pubDate.toLocaleTimeString("zh-TW", {
          timeZone: "Asia/Taipei",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        // 組合出 yyyy/MM/dd HH:mm 格式
        timeString = `${yyyy}/${MM}/${dd} ${hhmm}`;
      }

      // 處理重要性分數 (如果沒有分數則隱藏，有則醒目標示)
      const scoreText = item.importanceScore
        ? ` | <b>重要性: ${item.importanceScore}/10</b>`
        : "";

      // 組合單筆新聞的字串 (Telegram / LINE 適用的 HTML 格式)
      sectionText += `${index + 1}. ${emoji} <a href="${item.link}">${escapeHTML(cleanTitle)}</a>\n`;
      sectionText += `   <i>↳ ${escapeHTML(item.summary)}</i>\n`;
      // 將時間、媒體、重要性放在同一行作為 Meta 資訊
      sectionText += `   <i>${timeString} ｜ ${escapeHTML(mediaName)}${scoreText}</i>\n\n`;
    });

    return sectionText.trim(); // 移除結尾多餘的換行
  };

  // 分別產生台灣與國際新聞的文字
  const msgTextTW = buildSection(groupedNews["TW"], "🇹🇼 台灣市場動態");
  const msgTextGLOBAL = buildSection(groupedNews["US"], "🌎 國際總經與趨勢");

  // 將有內容的訊息放入陣列
  const messagesToSend = [];

  if (msgTextTW) {
    messagesToSend.push({ text: msgTextTW });
  }

  if (msgTextGLOBAL) {
    messagesToSend.push({ text: msgTextGLOBAL });
  }

  // 萬一 AI 判斷今天全部都是廢文，兩邊都為空
  if (messagesToSend.length === 0) {
    return {
      messages: [
        {
          text: `<b>🗞️ 重大市場情報</b> ｜ <code>${todayStr}</code>\n<i>今日無符合策略之重大市場動態。</i>`,
        },
      ],
      summaryText: "今日無重大市場新聞。",
    };
  }

  // 將 processedNews 陣列轉換成簡潔的文字格式（專為 AI 閱讀優化）
  const newsSummaryText = processedNews
    .map((item, index) => {
      // 假設你已經把 Bullish/Bearish 轉成對應的 Emoji
      const emoji = getNewsEmoji(item.sentiment);

      // 提取乾淨的標題
      const cleanTitle = item.title.split(/ - | \| /)[0];

      // ✅ 新增：把 importanceScore 拿出來
      const scoreText = item.importanceScore
        ? `[重要度: ${item.importanceScore}/10]`
        : "";

      // 組合出資訊密度極高、但 Token 極少的字串
      return `${index + 1}. ${scoreText} ${emoji} [${item._region}] ${cleanTitle}\n   ↳ 摘要：${item.summary}`;
    })
    .join("\n\n");

  // 回傳一個物件，包含 Telegram 訊息與純文字摘要
  return {
    messages: messagesToSend,
    summaryText: newsSummaryText,
  };
}
