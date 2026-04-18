import { fetchWithTimeout, parseNumberOrNull } from "../../utils/coreUtils.mjs";

/**
 * 宏觀經濟資料 Provider
 * - 台灣指標：改由 cbc.gov.tw (央行) 與 dgbas.gov.tw (主計總處) 官網獲取
 * - 美國指標：維持使用 FRED (Federal Reserve Economic Data)
 */

const FRED_API_KEY = process.env.FRED_API_KEY || "abcdefghijklmnopqrstuvwxyz123456";

// ============================================================================
// 🏦 台灣央行貼放利率 (CBC HTML Scraping)
// ============================================================================
export async function fetchCentralBankRate() {
  const url = "https://www.cbc.gov.tw/tw/lp-370-1-1-20.html";
  const fallbackVal = 2.0;

  try {
    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) throw new Error(`CBC API HTTP ${res.status}`);
    const html = await res.text();

    // 擷取表格中第一筆資料的重貼現率
    // 結構參考: <td data-th="重貼現率"><span>2</span></td>
    const match = html.match(/<td data-th="重貼現率"><span>([\d.]+)<\/span><\/td>/);
    const value = match ? parseNumberOrNull(match[1]) : null;

    if (value === null) throw new Error("解析央行利率 HTML 失敗");

    return {
      value,
      date: new Date().toISOString().split("T")[0], // 標註今天獲取
      source: "CBC",
    };
  } catch (err) {
    console.warn(`[macroProvider] fetchCentralBankRate 失敗: ${err.message}`);
    return { value: fallbackVal, date: null, source: "fallback" };
  }
}

// ============================================================================
// 📈 台灣 CPI 年增率 (DGBAS API)
// ============================================================================
export async function fetchCpiYoY() {
  const now = new Date();
  // CPI 通常於次月發布前一月數據。若現在是 4 月，則找 3 月。
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rocYear = lastMonth.getFullYear() - 1911;
  const rocMonth = String(lastMonth.getMonth() + 1).padStart(2, "0");
  const rocYM = `${rocYear}${rocMonth}`;

  // 使用使用者提供的結構化 URL
  const url = `https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=220&funid=A030101015&outmode=8&jsonplus=1&ym=${rocYM}&ymt=${rocYM}&cycle=1&outkind=11&compmode=2&ratenm=%u5E74%u589E%u7387&fldlst=110000000000000000000000000010000001000000000000000100000000010001000000001000000&compmode=2`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }, 10000);
    if (!res.ok) throw new Error(`DGBAS API HTTP ${res.status}`);
    
    const json = await res.json();
    // 總指數年增率位於 orgdata[0][0]
    const value = parseNumberOrNull(json.orgdata?.[0]?.[0]);

    if (value === null) throw new Error("解析 DGBAS CPI 數據失敗");

    return {
      value,
      date: `${lastMonth.getFullYear()}-${rocMonth}`,
      source: "DGBAS",
    };
  } catch (err) {
    console.warn(`[macroProvider] fetchCpiYoY 失敗: ${err.message}`);
    // 再次嘗試回退抓取前一前個月 (確保跨月發布空窗期)
    return { value: 2.0, date: null, source: "fallback" };
  }
}

// ============================================================================
// 🇺🇸 美度指標抓取 (FRED) - 維持原狀
// ============================================================================
async function fetchLatestFromFred(seriesId) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) throw new Error(`FRED API HTTP ${res.status}`);
    const json = await res.json();
    const latest = json.observations?.[0];
    if (!latest) throw new Error(`FRED 系列 ${seriesId} 無回傳資料`);
    return { date: latest.date, value: parseNumberOrNull(latest.value) };
  } catch (err) {
    console.warn(`[macroProvider] 抓取 FRED ${seriesId} 失敗: ${err.message}`);
    return null;
  }
}
