import { ref, computed } from "vue";
import { fetchStatus, fetchReports } from "../api/index.js";
import { usePortfolioSnapshots } from "./usePortfolioSnapshots.js";
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import { fmtDecimal } from "@/utils/formatters.js";

export const SOURCE_LABELS = {
  ndcBusinessIndicator: "國發會景氣燈號",
  marginKgi: "台股融資餘額 (KGI)",
  cnnFearGreed: "CNN 恐懼貪婪",
  usMarketFred: "美股風險 (FRED)",
  twMarketValuation: "大盤 PB/PE",
  usdTwdYahoo: "USD/TWD 匯率",
  dailyQuote: "每日一句",
};

function readToken(name, fallback) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function formatMoney(val) {
  if (val == null) return "N/A";
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "N/A";
}

export function fmtQty(val) {
  if (val == null) return "—";
  const n = Number(val);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

export function useAccountViewModel() {
  const status = ref(null);
  const reports = ref([]);
  const loading = ref(true);
  const error = ref(null);
  const aboutExpanded = ref(false);
  const showSourcesDetail = ref(false);

  const {
    latestSnapshot,
    hasEncryption: snapshotEncryption,
    load: loadSnapshots,
  } = usePortfolioSnapshots(1);

  async function load(force = false) {
    if (loading.value && !force && status.value) return;
    loading.value = true;
    error.value = null;
    try {
      const [sData, rData] = await Promise.all([fetchStatus(), fetchReports(30)]);
      status.value = sData;
      reports.value = Array.isArray(rData) ? [...rData].reverse() : [];
    } catch (e) {
      console.error("[AccountView] 無法載入運作狀態:", e);
      error.value = "無法載入運作狀態，請稍後再試";
    } finally {
      loading.value = false;
    }
  }

  async function initAccountPage(routeQueryPanel) {
    await Promise.all([load(), loadSnapshots()]);
    if (routeQueryPanel === "about") {
      aboutExpanded.value = true;
    }
  }

  const lastRunLabel = computed(() => {
    const ts = status.value?._meta?.lastRun;
    if (!ts) return "N/A";
    return formatDateTimeInTaipei(ts);
  });

  const prTrendPoints = computed(() =>
    reports.value
      .map((r) => ({
        date: String(r?.date || "").split("-").slice(1).join("/"),
        pr: r?.signals?.valuationGuardResult?.currentPR ?? null,
      }))
      .filter((d) => d.pr !== null),
  );

  const prTrendOption = computed(() => {
    const data = prTrendPoints.value;
    const hintColor = readToken("--iln-hint", "#8e8e93");
    const surfaceColor = readToken("--iln-surface", "#f2f2f7");
    const brandColor = readToken("--iln-brand", "#2481cc");

    return {
      tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
      grid: { left: "10%", right: "5%", top: "15%", bottom: "15%" },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        axisLabel: { fontSize: 10, color: hintColor },
        axisLine: { lineStyle: { color: surfaceColor } },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { fontSize: 10, color: hintColor, formatter: "{value}%" },
        splitLine: { lineStyle: { type: "dashed", color: surfaceColor } },
      },
      series: [
        {
          data: data.map((d) => d.pr),
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { color: brandColor, width: 2 },
          itemStyle: { color: brandColor },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                {
                  offset: 0,
                  color: readToken("--iln-brand-fill-strong", "rgba(36, 129, 204, 0.2)"),
                },
                {
                  offset: 1,
                  color: readToken("--iln-brand-fill-fade", "rgba(36, 129, 204, 0)"),
                },
              ],
            },
          },
        },
      ],
    };
  });

  const sourcesDisplay = computed(() => {
    const raw = status.value?._meta?.sources || {};
    const now = Date.now();
    const list = [];
    for (const [key, src] of Object.entries(raw)) {
      const label = SOURCE_LABELS[key] || key;
      const statusText = src?.status || "UNKNOWN";
      const lastFetchIso = src?.lastFetch || null;
      let lastFetchLabel = "尚無資料";
      let ageLabel = "";
      let stale = false;
      if (lastFetchIso) {
        const ts = new Date(lastFetchIso);
        lastFetchLabel = formatDateTimeInTaipei(lastFetchIso);
        const diffHours = (now - ts.getTime()) / (1000 * 60 * 60);
        if (diffHours >= 1) ageLabel = `${diffHours.toFixed(1)} 小時前更新`;
        else ageLabel = `${Math.max(1, Math.round(diffHours * 60))} 分鐘前更新`;

        const staleThreshold = key === "ndcBusinessIndicator" ? 35 * 24 : 72;
        if (diffHours > staleThreshold) stale = true;
      }
      let state = "UNKNOWN";
      if (statusText === "SUCCESS") state = stale ? "STALE" : "OK";
      else if (statusText === "FAILED") state = "FAIL";
      list.push({
        key,
        label,
        status: statusText,
        state,
        lastFetch: lastFetchLabel,
        ageLabel,
        error: src?.error || null,
      });
    }
    const order = { FAIL: 0, STALE: 1, OK: 2, UNKNOWN: 3 };
    list.sort(
      (a, b) =>
        (order[a.state] ?? 3) - (order[b.state] ?? 3) ||
        a.label.localeCompare(b.label, "zh-Hant"),
    );
    return list;
  });

  const sourceCount = computed(() => sourcesDisplay.value.length);
  const healthyCount = computed(
    () => sourcesDisplay.value.filter((s) => s.state === "OK").length,
  );
  const alertSourceCount = computed(
    () => sourcesDisplay.value.filter((s) => s.state === "FAIL" || s.state === "STALE").length,
  );
  const allHealthy = computed(
    () => sourceCount.value > 0 && healthyCount.value === sourceCount.value,
  );

  const snapshotCards = computed(() => {
    const snap = latestSnapshot.value;
    if (!snap) return [];
    const cards = [
      {
        key: "qty0050",
        label: "0050 股數",
        value: fmtQty(snap.qty0050),
        sub: "股",
      },
      {
        key: "qtyZ2",
        label: "00675L 股數",
        value: fmtQty(snap.qtyZ2),
        sub: "股",
      },
      {
        key: "totalLoan",
        label: "融資餘額",
        value: formatMoney(snap.totalLoan),
        sub: "元",
      },
      {
        key: "cash",
        label: "現金儲備",
        value: formatMoney(snap.cash),
        sub: "元",
      },
    ];
    if (snap.avgCost0050 != null) {
      cards.push({
        key: "avgCost0050",
        label: "0050 均價",
        value: fmtDecimal(snap.avgCost0050, 2),
        sub: "元/股",
      });
    }
    if (snap.avgCostZ2 != null) {
      cards.push({
        key: "avgCostZ2",
        label: "00675L 均價",
        value: fmtDecimal(snap.avgCostZ2, 2),
        sub: "元/股",
      });
    }
    return cards;
  });

  return {
    status,
    reports,
    loading,
    error,
    aboutExpanded,
    showSourcesDetail,
    latestSnapshot,
    snapshotEncryption,
    lastRunLabel,
    prTrendPoints,
    prTrendOption,
    sourcesDisplay,
    sourceCount,
    healthyCount,
    alertSourceCount,
    allHealthy,
    snapshotCards,
    load,
    initAccountPage,
    formatMoney,
    fmtQty,
  };
}
