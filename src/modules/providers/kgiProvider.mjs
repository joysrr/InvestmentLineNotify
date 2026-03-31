import { fetchWithTimeout, parseNumberOrNull } from "../../utils/coreUtils.mjs";

/**
 * 取得台股大盤「上市融資餘額」與「融資維持率」
 * 資料來源：KGI 凱基證券 (背後由 MoneyDJ 提供)
 */
export async function fetchTwseMarginData() {
  const url =
    "https://kgiweb.moneydj.com/b2brwdCommon/jsondata/32/06/4a/twstockdata.xdjjson?x=afterHours-market0002-1&b=d&c=61&revision=2018_07_31_1";

  // 防呆預設值
  const result = {
    marginBalance100M: 3000,
    marginBalanceChange100M: 0,
    maintenanceRatio: 165,
  };

  try {
    // 必須偽裝 Referer，使用 8 秒 Timeout
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
          Accept: "application/json",
          Referer: "https://www.kgi.com.tw/",
          Origin: "https://www.kgi.com.tw",
        },
      },
      8000,
    );

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
    // V3: 融資餘額 (單位: 仟元，如 "39859112") -> 實務上為萬元，除以 10000 轉為億
    // V6: 大盤融資維持率 (如 "182.4")
    // ==========================================

    result.date = todayData.V1;

    const ratio = parseNumberOrNull(todayData.V6);
    if (ratio !== null) {
      result.maintenanceRatio = ratio;
    }

    const todayBalanceRaw = parseNumberOrNull(todayData.V3);
    if (todayBalanceRaw !== null) {
      const todayBalance100M = todayBalanceRaw / 10000;
      result.marginBalance100M = Number(todayBalance100M.toFixed(2));

      const prevBalanceRaw = parseNumberOrNull(prevData?.V3);
      if (prevBalanceRaw !== null) {
        const prevBalance100M = prevBalanceRaw / 10000;
        result.marginBalanceChange100M = Number(
          (todayBalance100M - prevBalance100M).toFixed(2),
        );
      }
    }

    // 簡單的資料驗證防呆 (避免拿到 0 或異常小數字)
    if (result.marginBalance100M < 1000 || result.maintenanceRatio < 100) {
      console.warn("⚠️ 解析出的數字不合理，使用預設值", result);
      return {
        date: null,
        marginBalance100M: 3000,
        marginBalanceChange100M: 0,
        maintenanceRatio: 165,
      };
    }

    return result;
  } catch (err) {
    if (err.message.includes("Timeout")) {
      console.warn("⚠️ 獲取 KGI/MoneyDJ 融資資料超時 (Timeout)");
    } else {
      console.warn("⚠️ 獲取 KGI/MoneyDJ 融資資料失敗:", err.message);
    }
    return result; // 發生錯誤時回傳防呆預設值
  }
}
