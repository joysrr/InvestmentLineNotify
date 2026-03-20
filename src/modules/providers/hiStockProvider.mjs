import fetch from "node-fetch";
import * as cheerio from "cheerio";
import https from "https";

const agent = new https.Agent({ keepAlive: true, family: 4, timeout: 5000 });

// 偽裝 Headers (用來應付 HiStock)
const stealthHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "text/html",
  "Accept-Language": "zh-TW,zh;q=0.9",
  Referer: "https://www.google.com/",
};

export async function fetchTwseMarginData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const result = {
    marginBalance100M: 3000,
    marginBalanceChange100M: 0,
    maintenanceRatio: 165, // Yahoo 沒這資料，如果 HiStock 抓不到就用這個預設值
  };

  try {
    const hiUrl = "https://histock.tw/stock/three.aspx?m=mg";
    const hiRes = await fetch(hiUrl, {
      agent,
      headers: stealthHeaders,
      signal: controller.signal,
    });

    if (!hiRes.ok) throw new Error(`HiStock HTTP ${hiRes.status}`);

    const hiHtml = await hiRes.text();
    const $ = cheerio.load(hiHtml);
    const allText = $("body")
      .text()
      .replace(/[\s,]+/g, "");

    // 抓維持率
    const ratioMatch = allText.match(/維持率.*?(\d{3}\.\d{2})%/);
    if (ratioMatch && ratioMatch[1])
      result.maintenanceRatio = Number(ratioMatch[1]);

    // 抓餘額 (通常在表格第一行)
    let foundHiBalance = false;
    $("tr").each((i, el) => {
      if (foundHiBalance) return;
      const rowText = $(el)
        .text()
        .replace(/[\s,]+/g, "");
      if (rowText.includes("融資餘額") && !rowText.includes("日期")) {
        const rowBalanceMatch = rowText.match(/(\d{4}\.\d{2})/);
        if (rowBalanceMatch && Number(rowBalanceMatch[1]) > 1000) {
          result.marginBalance100M = Number(rowBalanceMatch[1]);
          foundHiBalance = true;
        }
      }
    });

    if (!foundHiBalance) throw new Error("HiStock 餘額提取失敗");
    return result;
  } catch (hiErr) {
    console.warn(`⚠️ HiStock 抓取失敗 (${hiErr.message})`);
  } finally {
    clearTimeout(timeoutId);
  }
}
