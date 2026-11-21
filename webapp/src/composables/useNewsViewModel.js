import { ref, computed } from "vue";
import { dedupeByUrl, isTaiwanMarket, matchFeatured } from "@/utils/newsMatch.js";
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import { fetchNews, fetchReportNews } from "../api/index.js";

export const POOL_FILTERS = [
  { id: "all", label: "全部" },
  { id: "featured", label: "精選" },
  { id: "taiwan", label: "台灣市場" },
  { id: "international", label: "國際市場" },
  { id: "unclassified", label: "未分類" },
];

export function classifyNewsPoolArticle(article, featuredList = []) {
  const isFeatured = matchFeatured(article, featuredList);
  const isTw = isTaiwanMarket(article);
  const isIntl = !isTw && Boolean(article?._knownInternational);
  const isUnclassified = !article?.source || (!isTw && !isIntl);

  return {
    isFeatured,
    isTw,
    isIntl,
    isUnclassified,
  };
}

export function buildNewsViewModel({
  reportNews,
  articles,
  activePoolFilter,
  featuredNews,
}) {
  const twItems = reportNews?.tw ?? [];
  const usItems = reportNews?.us ?? [];
  const totalFeaturedCount = twItems.length + usItems.length;

  const rawGeneratedAt = reportNews?.generatedAt ?? "";
  let generatedAtDisplay = "—";
  if (rawGeneratedAt) {
    generatedAtDisplay = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(rawGeneratedAt)
      ? rawGeneratedAt
      : formatDateTimeInTaipei(rawGeneratedAt);
  }

  const enrichedArticles = (articles ?? []).map((article) => {
    const flags = classifyNewsPoolArticle(article, featuredNews);
    return {
      article,
      ...flags,
    };
  });

  const filterCounts = {
    all: enrichedArticles.length,
    featured: enrichedArticles.filter((x) => x.isFeatured).length,
    taiwan: enrichedArticles.filter((x) => x.isTw).length,
    international: enrichedArticles.filter((x) => x.isIntl).length,
    unclassified: enrichedArticles.filter((x) => x.isUnclassified).length,
  };

  const filteredItems = enrichedArticles.filter((entry) => {
    if (activePoolFilter === "all") return true;
    if (activePoolFilter === "featured") return entry.isFeatured;
    if (activePoolFilter === "taiwan") return entry.isTw;
    if (activePoolFilter === "international") return entry.isIntl;
    return entry.isUnclassified;
  });

  return {
    twItems,
    usItems,
    totalFeaturedCount,
    hasReportNews: totalFeaturedCount > 0,
    generatedAtDisplay,
    totalPoolCount: enrichedArticles.length,
    filterCounts,
    filteredItems,
  };
}

export function useNewsViewModel() {
  const activeTab = ref("report");

  // 精選報告狀態
  const reportNews = ref({ tw: [], us: [], generatedAt: "" });
  const reportLoading = ref(false);
  const reportError = ref(null);
  const reportLoaded = ref(false);
  const featuredNews = ref([]);

  // 新聞池狀態
  const articles = ref([]);
  const activePoolFilter = ref("all");
  const searchQuery = ref("");
  const poolLoading = ref(false);
  const poolError = ref(null);
  const poolLoaded = ref(false);

  const vm = computed(() => {
    const base = buildNewsViewModel({
      reportNews: reportNews.value,
      articles: articles.value,
      activePoolFilter: activePoolFilter.value,
      featuredNews: featuredNews.value,
    });

    const kw = searchQuery.value.trim().toLowerCase();
    const searchedItems = kw
      ? base.filteredItems.filter(({ article }) => {
          const title = String(article?.title || "").toLowerCase();
          const source = String(article?.source || "").toLowerCase();
          const summary = String(article?.summary || article?.description || "").toLowerCase();
          return title.includes(kw) || source.includes(kw) || summary.includes(kw);
        })
      : base.filteredItems;

    return {
      ...base,
      filteredItems: searchedItems,
      hasActiveSearchOrFilter: activePoolFilter.value !== "all" || Boolean(kw),
    };
  });

  async function loadReport(force = false) {
    if (reportLoading.value) return;
    if (reportLoaded.value && !force) return;
    reportLoading.value = true;
    reportError.value = null;
    try {
      const data = await fetchReportNews();
      const tw = Array.isArray(data?.tw) ? data.tw : [];
      const us = Array.isArray(data?.us) ? data.us : [];
      reportNews.value = {
        tw,
        us,
        generatedAt: data?.generatedAt ?? "",
      };
      featuredNews.value = [...tw, ...us];
    } catch (e) {
      reportError.value = e?.message || "載入精選報告失敗";
    } finally {
      reportLoaded.value = true;
      reportLoading.value = false;
    }
  }

  async function loadPool(force = false) {
    if (poolLoading.value) return;
    if (poolLoaded.value && !force) return;
    poolLoading.value = true;
    poolError.value = null;
    try {
      const data = await fetchNews();
      const rawList = Array.isArray(data) ? data : (data?.articles ?? []);
      articles.value = dedupeByUrl(rawList);
    } catch (e) {
      poolError.value = e?.message || "載入新聞池失敗";
    } finally {
      poolLoaded.value = true;
      poolLoading.value = false;
    }
  }

  async function refreshCurrentTab() {
    if (activeTab.value === "report") {
      await loadReport(true);
    } else {
      await loadPool(true);
    }
  }

  function switchTab(tab) {
    if (tab !== "report" && tab !== "pool") return;
    activeTab.value = tab;
    if (tab === "report" && !reportLoaded.value) loadReport();
    if (tab === "pool" && !poolLoaded.value) loadPool();
  }

  function setPoolFilter(filterId) {
    activePoolFilter.value = filterId;
  }

  function resetPoolFilters() {
    activePoolFilter.value = "all";
    searchQuery.value = "";
  }

  return {
    activeTab,
    reportNews,
    reportLoading,
    reportError,
    reportLoaded,
    featuredNews,
    articles,
    activePoolFilter,
    searchQuery,
    poolLoading,
    poolError,
    poolLoaded,
    vm,
    loadReport,
    loadPool,
    refreshCurrentTab,
    switchTab,
    setPoolFilter,
    resetPoolFilters,
  };
}
