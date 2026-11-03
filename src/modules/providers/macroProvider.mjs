import { fetchWithTimeout, parseNumber } from "../../utils/coreUtils.mjs";

const PROVIDER_ID = "macroProvider";

// ============================================================================
// 🏦 台灣央行貼放利率 (CBC HTML Scraping)
// ============================================================================
export async function fetchCentralBankRate() {
  const url = "https://www.cbc.gov.tw/tw/lp-370-1-1-20.html";
  const fallbackVal = 2.0;

  try {
    const res = await fetchWithTimeout(
      url,
      {},
      10000,
      2,
      1000,
      PROVIDER_ID,
      "fetchCentralBankRate",
    );
    if (!res.ok) throw new Error(`CBC API HTTP ${res.status}`);
    const html = await res.text();

    const match = html.match(
      /<td data-th="重貼現率"><span>([\d.]+)<\/span><\/td>/,
    );
    const value = match ? parseNumber(match[1]) : null;

    if (value === null) throw new Error("解析央行利率 HTML 失敗");

    const normalized = {
      value,
      date: new Date().toISOString().split("T")[0],
      source: "CBC",
    };
    return { raw: html, normalized, ...normalized };
  } catch (err) {
    console.warn(
      `[${PROVIDER_ID}] fetchCentralBankRate 失敗，使用回退值:`,
      err.message,
    );
    return { value: fallbackVal, date: null, source: "fallback" };
  }
}

// ============================================================================
// 📈 台灣 CPI 年增率 (DGBAS API)
// ============================================================================
export async function fetchCpiYoY() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rocYear = lastMonth.getFullYear() - 1911;
  const rocMonth = String(lastMonth.getMonth() + 1).padStart(2, "0");
  const rocYM = `${rocYear}${rocMonth}`;

  const url = `https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=220&funid=A030101015&outmode=8&jsonplus=1&ym=${rocYM}&ymt=${rocYM}&cycle=1&outkind=11&compmode=2&ratenm=%u5E74%u589E%u7387&fldlst=110000000000000000000000000010000001000000000000000100000000010001000000001000000&compmode=2`;

  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": "Mozilla/5.0" } },
      10000,
      2,
      1000,
      PROVIDER_ID,
      "fetchCpiYoY",
    );
    if (!res.ok) throw new Error(`DGBAS API HTTP ${res.status}`);

    const json = await res.json();
    const value = parseNumber(json.orgdata?.[0]?.[0]);

    if (value === null) throw new Error("解析 DGBAS CPI 數據失敗");

    let dataDate = `${lastMonth.getFullYear()}-${rocMonth}`;
    if (typeof json.ymt === "string") {
      const match = json.ymt.trim().match(/^(\d{2,3})(\d{2})$/);
      if (match) {
        const year = parseInt(match[1], 10) + 1911;
        const month = match[2];
        dataDate = `${year}-${month}`;
      }
    }

    const normalized = {
      value,
      date: dataDate,
      source: "DGBAS",
    };
    return { raw: json, normalized, ...normalized };
  } catch (err) {
    console.warn(`[${PROVIDER_ID}] fetchCpiYoY 失敗，使用回退值:`, err.message);
    return { value: 2.0, date: null, source: "fallback" };
  }
}
