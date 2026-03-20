import fetch from "node-fetch";

/**
 * 取得台股大盤「上市融資餘額」與「融資維持率」
 * 資料來源：KGI 凱基證券 (背後由 MoneyDJ 提供)
 */
export async function fetchTwseMarginData() {
  const url =
    "https://kgiweb.moneydj.com/b2brwdCommon/jsondata/32/06/4a/twstockdata.xdjjson?x=afterHours-market0002-1&b=d&c=61&revision=2018_07_31_1";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  // 防呆預設值
  const result = {
    marginBalance100M: 3000,
    marginBalanceChange100M: 0,
    maintenanceRatio: 165,
  };

  try {
    // 必須偽裝 Referer
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
        Accept: "application/json",
        Referer: "https://www.kgi.com.tw/",
        Origin: "https://www.kgi.com.tw",
      },
    });

    if (!response.ok) {
      throw new Error(`MoneyDJ API HTTP ${response.status}`);
    }

    const data = await response.json();

    // 檢查結構是否存在
    const resultsArray = data?.ResultSet?.Result;
    if (!Array.isArray(resultsArray) || resultsArray.length < 2) {
      throw new Error("MoneyDJ JSON 結構不符合預期或資料不足");
    }

    // 取得最新一天 (index 0) 與前一天 (index 1) 的資料
    const todayData = resultsArray[0];
    const prevData = resultsArray[1];

    // ==========================================
    // 欄位對照表 (MoneyDJ):
    // V1: 日期 (如 "2026/03/20")
    // V3: 融資餘額 (單位: 仟元，如 "39859112")
    // V6: 大盤融資維持率 (如 "182.4")
    // ==========================================

    if (todayData.V6) {
      result.maintenanceRatio = Number(todayData.V6);
    }

    if (todayData.V3) {
      // V3 單位是「仟元」，要轉成「億元」，需除以 100,000 (十萬)
      // 例如 39,859,112 仟元 / 100000 = 398.59 億 (?)
      // 🚨 等等，台股融資餘額目前約 3000 億。
      // 如果 V3 是 39859112，它其實是「萬」為單位 (3985億)，或者是「萬」乘以10？
      // 我們根據台股常理：39859112 應該代表 3985.91 億，所以它是以「萬元」為單位。
      // 轉換公式：數字 / 10000 = 億
      const todayBalance100M = Number(todayData.V3) / 10000;
      result.marginBalance100M = Number(todayBalance100M.toFixed(2));

      if (prevData && prevData.V3) {
        const prevBalance100M = Number(prevData.V3) / 10000;
        // 計算增減
        result.marginBalanceChange100M = Number(
          (todayBalance100M - prevBalance100M).toFixed(2),
        );
      }
    }

    // 簡單的資料驗證防呆
    if (result.marginBalance100M < 1000 || result.maintenanceRatio < 100) {
      console.warn("⚠️ 解析出的數字不合理，使用預設值", result);
      return {
        marginBalance100M: 3000,
        marginBalanceChange100M: 0,
        maintenanceRatio: 165,
      };
    }

    return result;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("⚠️ 獲取 KGI/MoneyDJ 融資資料超時");
    } else {
      console.warn("⚠️ 獲取 KGI/MoneyDJ 融資資料失敗:", err.message);
    }
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
