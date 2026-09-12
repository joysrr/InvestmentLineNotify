// src/modules/sentiment/crawlers/bskyCrawler.mjs
//
// 職責：原生 Bluesky ATProto 搜尋與貼文解析。
// 支援選用身分驗證，無配置則優雅降級跳過。

import logger from "../../../utils/logger.mjs";

const BSKY_SEARCH_API = "https://bsky.social/xrpc/app.bsky.feed.searchPosts";
const BSKY_AUTH_API =
  "https://bsky.social/xrpc/com.atproto.server.createSession";

/**
 * 解析 Bluesky 貼文 JSON 回應
 * @param {Object} data API 回應資料
 * @returns {Array<Object>} 標準貼文清單
 */
export function parseBskyPosts(data) {
  if (!data || !Array.isArray(data.posts)) {
    return [];
  }

  return data.posts.map((p) => {
    const text = p.record?.text || "";
    const handle = p.author?.handle || "";
    const uri = p.uri || "";
    // 將 at:// URI 轉換為網頁網址
    let postUrl = "";
    if (uri.startsWith("at://")) {
      const parts = uri.replace("at://", "").split("/");
      if (parts.length >= 3) {
        postUrl = `https://bsky.app/profile/${handle}/post/${parts[2]}`;
      }
    }

    return {
      platform: "Bluesky",
      title: text,
      author: handle,
      url: postUrl || uri,
      published_at: p.record?.createdAt || new Date().toISOString(),
    };
  });
}

/**
 * 建立 Bluesky 認證 Session 取得 JWT
 */
export async function createBskySession(handle, appPassword) {
  if (!handle || !appPassword) return null;

  try {
    const res = await fetch(BSKY_AUTH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Bluesky 登入失敗");
      return null;
    }

    const json = await res.json();
    return json.accessJwt || null;
  } catch (err) {
    logger.warn({ err: err.message }, "Bluesky 建立 Session 發生錯誤");
    return null;
  }
}

/**
 * 抓取 Bluesky 台股相關貼文
 */
export async function fetchBskyStockPosts(
  keywords = ["台股", "0050", "台積電"],
) {
  const handle = process.env.BSKY_HANDLE;
  const password = process.env.BSKY_APP_PASSWORD;

  if (!handle || !password) {
    logger.info("Bluesky 帳號未設定，略過 Bluesky 抓取");
    return [];
  }

  try {
    const token = await createBskySession(handle, password);
    if (!token) return [];

    const q = keywords.join(" OR ");
    const searchUrl = `${BSKY_SEARCH_API}?q=${encodeURIComponent(q)}&limit=30`;

    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Bluesky 搜尋失敗");
      return [];
    }

    const data = await res.json();
    return parseBskyPosts(data);
  } catch (err) {
    logger.error(err, "Bluesky 貼文抓取失敗");
    return [];
  }
}
