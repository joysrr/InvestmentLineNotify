import {
  fetchWithTimeout,
  parseNumber,
  TwDate,
} from "../../utils/coreUtils.mjs";

const FINMIND_BASE_URL = "https://api.finmindtrade.com/api/v4/data";

/**
 * 建立 FinMind API 共用 Header。
 * 若 .env 有維護 FINMIND_API_TOKEN，則自動加上 Authorization。
 */
function buildFinMindHeaders() {
  const token = process.env.FINMIND_API_TOKEN || "";

  const headers = {
    "User-Agent":
      "InvestmentLineNotify/finmindProvider (+https://github.com/joysrr/InvestmentLineNotify)",
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * 小工具：呼叫 FinMind /data，並處理基本錯誤與結構驗證。
 */
async function fetchFinMindData(dataset, params = {}, timeoutMs = 10000) {
  const url = new URL(FINMIND_BASE_URL);
  url.searchParams.set("dataset", dataset);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetchWithTimeout(
    url.toString(),
    {
      headers: buildFinMindHeaders(),
    },
    timeoutMs,
  );

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new Error(`FinMind ${dataset} 回傳非 JSON：${err.message}`);
  }

  // HTTP 402: API 用量超出上限
  if (res.status === 402 || body?.status === 402) {
    throw new Error(`FinMind API 配額已用完 (status=402)：${body?.msg || ""}`);
  }

  if (res.status !== 200 || body?.status !== 200 || body?.msg !== "success") {
    throw new Error(
      `FinMind ${dataset} 回傳異常：HTTP ${res.status}, status=${body?.status}, msg=${body?.msg}`,
    );
  }

  const data = Array.isArray(body.data) ? body.data : [];
  return data;
}

/**
 * 取得最近一段期間的「整體市場融資融券表」。
 * dataset: TaiwanStockTotalMarginPurchaseShortSale
 * Columns: TodayBalance, YesBalance, buy, date, name, Return, sell
 */
async function fetchTotalMarginSummary(startDate, endDate) {
  const rows = await fetchFinMindData(
    "TaiwanStockTotalMarginPurchaseShortSale",
    {
      start_date: startDate,
      end_date: endDate,
    },
  );

  if (!rows.length) return null;

  // FinMind 一般會照日期遞增，保險起見還是 sort 一下
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const latest = rows[rows.length - 1];

  const todayBalanceRaw = parseNumber(latest.TodayBalance);
  const yesBalanceRaw = parseNumber(latest.YesBalance);

  if (todayBalanceRaw === null) return null;

  const marginBalance100M = todayBalanceRaw / 100000000; // 元 → 億元
  let marginChange100M = 0;
  if (yesBalanceRaw !== null) {
    marginChange100M = (todayBalanceRaw - yesBalanceRaw) / 100000000;
  }

  return {
    date: latest.date,
    marginBalance100M: Number(marginBalance100M.toFixed(2)),
    marginBalanceChange100M: Number(marginChange100M.toFixed(2)),
  };
}

/**
 * 取得最近一段期間的「台灣大盤融資維持率」。
 * dataset: TaiwanTotalExchangeMarginMaintenance
 * Columns: date, TotalExchangeMarginMaintenance
 */
async function fetchTotalExchangeMarginMaintenance(startDate, endDate) {
  const rows = await fetchFinMindData("TaiwanTotalExchangeMarginMaintenance", {
    start_date: startDate,
    end_date: endDate,
  });

  if (!rows.length) return null;

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const latest = rows[rows.length - 1];

  const ratio = parseNumber(latest.TotalExchangeMarginMaintenance);
  if (ratio === null) return null;

  return {
    date: latest.date,
    maintenanceRatio: Number(ratio.toFixed(2)),
  };
}

/**
 * 取得「當前最新」的大盤融資資訊（餘額、增減、維持率），
 * 回傳格式與 kgiProvider.fetchTwseMarginData 一致，可互相替換：
 * {
 *   date: "YYYY-MM-DD" | null,
 *   marginBalance100M: number,       // 融資餘額（億元）
 *   marginBalanceChange100M: number,  // 融資增減（億元，可為負）
 *   maintenanceRatio: number,         // 大盤融資維持率（%）
 * }
 *
 * 若 FinMind 或某個 dataset 失敗，會回傳防呆預設值，並交由上層 _meta.sources 判斷健康狀態。
 */
export async function fetchFinMindMarginData() {
  const fallback = {
    date: null,
    marginBalance100M: 3000,
    marginBalanceChange100M: 0,
    maintenanceRatio: 165,
  };

  try {
    // 取最近 60 天視窗，避免因節假日導致無資料
    const tw = TwDate();
    const end = tw.formatDateKey();
    const d = new Date(tw.dateObj);
    d.setDate(d.getDate() - 60);
    const start = TwDate(d).formatDateKey();

    const [summaryResult, ratioResult] = await Promise.allSettled([
      fetchTotalMarginSummary(start, end),
      fetchTotalExchangeMarginMaintenance(start, end),
    ]);

    const summary =
      summaryResult.status === "fulfilled" ? summaryResult.value : null;
    const ratio = ratioResult.status === "fulfilled" ? ratioResult.value : null;

    if (summaryResult.status === "rejected") {
      console.warn(
        `⚠️ FinMind 融資餘額 API 失敗: ${summaryResult.reason?.message}`,
      );
    }
    if (ratioResult.status === "rejected") {
      console.warn(
        `⚠️ FinMind 維持率 API 失敗: ${ratioResult.reason?.message}`,
      );
    }

    if (!summary && !ratio) {
      throw new Error("FinMind 融資與維持率皆無資料");
    }

    return {
      date: summary?.date || ratio?.date || null,
      marginBalance100M:
        summary?.marginBalance100M ?? fallback.marginBalance100M,
      marginBalanceChange100M:
        summary?.marginBalanceChange100M ?? fallback.marginBalanceChange100M,
      maintenanceRatio: ratio?.maintenanceRatio ?? fallback.maintenanceRatio,
    };
  } catch (err) {
    if (err.message.includes("402")) {
      console.warn("⚠️ FinMind API 用量已達上限，使用防呆預設值");
    } else {
      console.warn("⚠️ 獲取 FinMind 融資資料失敗:", err.message);
    }
    return fallback;
  }
}
