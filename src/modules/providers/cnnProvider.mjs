import fetch from "node-fetch";

/**
 * 取得 CNN 恐懼與貪婪指數 (Fear & Greed Index)
 * @returns {Promise<Object>} 包含目前與歷史分數的物件
 */
export async function fetchFearAndGreedIndex() {
  const url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

  // 建立一個 AbortController，設定 8 秒超時
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

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
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        // 偽裝成 Chrome 瀏覽器，繞過防爬蟲阻擋 [web:536]
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/json",
        Origin: "https://edition.cnn.com",
        Referer: "https://edition.cnn.com/",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const fgData = data?.fear_and_greed;

    // 若 API 回傳的格式意外變更，丟出錯誤並進入 catch 區塊使用預設值
    if (!fgData || typeof fgData.score !== "number") {
      throw new Error("CNN API 回傳的 JSON 結構不符合預期");
    }

    // 將 CNN 的 snake_case 轉為 JS 慣用的 camelCase，並取至小數點後兩位
    return {
      score: Number(fgData.score.toFixed(2)),
      rating: fgData.rating, // 例如: "extreme fear"
      previousClose: Number((fgData.previous_close || 50).toFixed(2)),
      previous1Week: Number((fgData.previous_1_week || 50).toFixed(2)),
      previous1Month: Number((fgData.previous_1_month || 50).toFixed(2)),
      previous1Year: Number((fgData.previous_1_year || 50).toFixed(2)),
      timestamp: new Date(fgData.timestamp),
    };
  } catch (error) {
    // 捕捉所有錯誤：包括網路斷線、Timeout 或 API 格式改變
    if (error.name === "AbortError") {
      console.warn(
        "⚠️ 獲取 CNN 恐懼與貪婪指數超時 (Timeout)，使用預設中性數值",
      );
    } else {
      console.error("❌ 獲取 CNN 恐懼與貪婪指數失敗:", error.message);
    }
    return defaultFallback;
  } finally {
    clearTimeout(timeoutId); // 清理計時器避免 Memory Leak
  }
}
