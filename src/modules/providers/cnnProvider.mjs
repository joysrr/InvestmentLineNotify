import { fetchWithTimeout, parseNumberOrNull } from "../../utils/coreUtils.mjs";

/**
 * 安全的數字處理工具 (內部使用)：若為空值則回傳 fallback，若為數字則取到小數點後兩位
 */
function safeFormatNumber(val, fallback = 50) {
  const num = parseNumberOrNull(val);
  return num !== null ? Number(num.toFixed(2)) : fallback;
}

/**
 * 取得 CNN 恐懼與貪婪指數 (Fear & Greed Index)
 * @returns {Promise<Object>} 包含目前與歷史分數的物件
 */
export async function fetchFearAndGreedIndex() {
  const url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

  // 定義失敗時的預設值 (Fallback)
  const defaultFallback = {
    score: 50,
    rating: "neutral",
    previousClose: 50,
    previous1Week: 50,
    previous1Month: 50,
    previous1Year: 50,
    timestamp: new Date(),
  };

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          // 偽裝成 Chrome 瀏覽器，繞過防爬蟲阻擋
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
          Origin: "https://edition.cnn.com",
          Referer: "https://edition.cnn.com/",
        },
      },
      8000, // 8 秒 Timeout
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const fgData = data?.fear_and_greed;

    // 若 API 回傳的格式意外變更，丟出錯誤並進入 catch 區塊使用預設值
    if (!fgData || typeof fgData.score !== "number") {
      throw new Error("CNN API 回傳的 JSON 結構不符合預期");
    }

    // 將 CNN 的 snake_case 轉為 JS 慣用的 camelCase，並使用安全轉換工具
    return {
      score: safeFormatNumber(fgData.score),
      rating: fgData.rating || "neutral",
      previousClose: safeFormatNumber(fgData.previous_close),
      previous1Week: safeFormatNumber(fgData.previous_1_week),
      previous1Month: safeFormatNumber(fgData.previous_1_month),
      previous1Year: safeFormatNumber(fgData.previous_1_year),
      timestamp: fgData.timestamp ? new Date(fgData.timestamp) : new Date(),
    };
  } catch (error) {
    // 捕捉所有錯誤：包括網路斷線、Timeout 或 API 格式改變
    if (error.message.includes("Timeout")) {
      console.warn(
        "⚠️ 獲取 CNN 恐懼與貪婪指數超時 (Timeout)，使用預設中性數值",
      );
    } else {
      console.error("❌ 獲取 CNN 恐懼與貪婪指數失敗:", error.message);
    }
    return defaultFallback;
  }
}
