import { fetchWithTimeout, parseNumberOrNull } from "../../utils/coreUtils.mjs";

/**
 * 取得台股大盤「上市融資餘額」、「融資增減」與「融資維持率」
 * 資料來源：WantGoo 玩股網
 * URL: https://www.wantgoo.com/stock/margin-trading/market-price/taiex
 *
 * 回傳格式與 kgiProvider.mjs 完全相同，可直接替換：
 * {
 *   date: "YYYY-MM-DD" | null,
 *   marginBalance100M: number,       // 融資餘額（億元）
 *   marginBalanceChange100M: number,  // 融資增減（億元，可為負）
 *   maintenanceRatio: number,         // 大盤融資維持率（%）
 * }
 */
export async function fetchWantgooMarginData() {
  const url =
    "https://www.wantgoo.com/stock/margin-trading/market-price/taiex";

  // 防呆預設值（與 kgiProvider 一致）
  const fallback = {
    date: null,
    marginBalance100M: 3000,
    marginBalanceChange100M: 0,
    maintenanceRatio: 165,
  };

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
          Referer: "https://www.wantgoo.com/",
        },
      },
      10000, // wantgoo 有時較慢，給 10 秒
    );

    if (!response.ok) {
      throw new Error(`WantGoo HTTP ${response.status}`);
    }

    const html = await response.text();

    // ── 解析 HTML ───────────────────────────────────────────────────────────
    // 策略：用 regex 擷取 <tbody> 第一個 <tr> 內所有 <td> 的文字
    // 欄位順序（對應網頁表格）：
    //   [0] 日期        e.g. "2026/04/14"
    //   [1] 融資餘額    e.g. "3,521"
    //   [2] 融資增減    e.g. "-123"
    //   [3] 大盤維持率  e.g. "182.4"
    // ─────────────────────────────────────────────────────────────────────────

    // 1. 取出第一個 <tbody> 區塊
    const tbodyMatch = html.match(/<tbody[^>]*>([\\/\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      throw new Error("WantGoo HTML 找不到 <tbody> 區塊，網頁結構可能已變更");
    }

    // 2. 取出第一個 <tr>
    const trMatch = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    if (!trMatch) {
      throw new Error("WantGoo HTML 找不到第一個 <tr>，網頁結構可能已變更");
    }

    // 3. 擷取所有 <td> 文字內容（去除 HTML tags 與多餘空白）
    const tdValues = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      // 去掉 HTML tag（含子元素），再 trim
      const text = tdMatch[1].replace(/<[^>]+>/g, "").trim();
      tdValues.push(text);
    }

    if (tdValues.length < 4) {
      throw new Error(
        `WantGoo 解析到的 <td> 欄位不足（得到 ${tdValues.length} 欄），網頁結構可能已變更`,
      );
    }

    // ── 欄位解析 ────────────────────────────────────────────────────────────
    // 日期："2026/04/14" -> "2026-04-14"
    const rawDate = tdValues[0].replace(/\//g, "-");
    const dateISO = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

    // 融資餘額（億元）："3,521" -> 3521
    const marginBalance = parseNumberOrNull(tdValues[1]);

    // 融資增減（億元）："-123" -> -123（已是億元單位，不需換算）
    const marginChange = parseNumberOrNull(tdValues[2]);

    // 大盤融資維持率："182.4" -> 182.4（去掉 % 號）
    const maintenanceRatio = parseNumberOrNull(
      tdValues[3].replace(/%/g, ""),
    );

    // ── 驗證 ────────────────────────────────────────────────────────────────
    if (
      marginBalance === null ||
      marginBalance < 1000 ||
      maintenanceRatio === null ||
      maintenanceRatio < 100
    ) {
      console.warn(
        "⚠️ WantGoo 解析出的融資數字不合理，使用防呆預設值",
        { marginBalance, maintenanceRatio },
      );
      return fallback;
    }

    return {
      date: dateISO,
      marginBalance100M: Number(marginBalance.toFixed(2)),
      marginBalanceChange100M:
        marginChange !== null ? Number(marginChange.toFixed(2)) : 0,
      maintenanceRatio: Number(maintenanceRatio.toFixed(2)),
    };
  } catch (err) {
    if (err.message.includes("Timeout")) {
      console.warn("⚠️ 獲取 WantGoo 融資資料超時 (Timeout)");
    } else {
      console.warn("⚠️ 獲取 WantGoo 融資資料失敗:", err.message);
    }
    return fallback;
  }
}
