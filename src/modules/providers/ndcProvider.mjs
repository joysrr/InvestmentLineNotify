import fetch from "node-fetch";
import { isoDateToROC } from "../../utils/coreUtils.mjs";

/**
 * 取得國發會最新「景氣對策信號」(景氣燈號與綜合判斷分數)
 * 來源：主計總處/國發會 總體統計資料庫 JSON API
 */
export async function fetchBusinessIndicator() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  // 防呆預設值
  const fallbackData = {
    date: "2024-01",
    score: 25,
    light: "綠燈 (穩定)",
    lightColor: "green",
  };

  const getLightStatus = (score) => {
    if (score >= 38) return { light: "紅燈 (過熱)", lightColor: "red" };
    if (score >= 32)
      return { light: "黃紅燈 (轉熱)", lightColor: "yellow-red" };
    if (score >= 23) return { light: "綠燈 (穩定)", lightColor: "green" };
    if (score >= 17)
      return { light: "黃藍燈 (轉弱)", lightColor: "yellow-blue" };
    return { light: "藍燈 (低迷)", lightColor: "blue" };
  };

  try {
    // 💡 動態產生查詢時間區間 (西元轉民國)
    const now = new Date();

    // ymt (結束年月): 當前時間 (例如 "2026-03")
    const currentIsoMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const ymt = isoDateToROC(currentIsoMonth, false); // "11503"

    // ymf (起始年月): 當前時間往前推 2 年 (例如 "2024-03")
    const pastIsoMonth = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const ymf = isoDateToROC(pastIsoMonth, false); // "11303"

    const url = `https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=220&funid=A120101010&outmode=8&ym=${ymf}&ymt=${ymt}&cycle=1&outkind=11&fldlst=11111`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`Gov API HTTP ${res.status}`);

    const data = await res.json();

    if (!data.row || !data.outdata) {
      throw new Error("JSON 結構缺少 row 或 outdata");
    }

    let latestIndex = -1;
    let latestYearMonthStr = "";
    let score = null;

    let scoreColumnIndex = 4;
    if (data.col) {
      const foundIdx = data.col.findIndex(
        (c) => c[0] && c[0].includes("景氣對策信號"),
      );
      if (foundIdx !== -1) scoreColumnIndex = foundIdx;
    }

    const scoreArray = data.outdata[scoreColumnIndex];

    for (let i = data.row.length - 1; i >= 0; i--) {
      const rawScoreStr = scoreArray[i];
      const parsedScore = Number(String(rawScoreStr).trim());

      if (!isNaN(parsedScore) && parsedScore > 0) {
        latestIndex = i;
        latestYearMonthStr = data.row[i][0]; // "115年1月"
        score = parsedScore;
        break;
      }
    }

    if (latestIndex === -1 || score === null) {
      throw new Error("找不到最新月份的分數資料");
    }

    const { light, lightColor } = getLightStatus(score);

    // 把 "115年1月" 轉換回 "2026-01"
    let date = fallbackData.date;
    const match = latestYearMonthStr.match(/(\d+)年(\d+)月/);
    if (match) {
      const adY = Number(match[1]) + 1911;
      const m = String(match[2]).padStart(2, "0");
      date = `${adY}-${m}`;
    }

    return { date, score, light, lightColor };
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("⚠️ 獲取景氣燈號超時");
    } else {
      console.warn("⚠️ 獲取景氣燈號失敗:", err.message);
    }
    return fallbackData;
  } finally {
    clearTimeout(timeoutId);
  }
}
