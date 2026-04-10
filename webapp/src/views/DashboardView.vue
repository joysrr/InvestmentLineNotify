<template>
  <div class="view-container">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-title-row">
        <h2 class="dash-title">市場總覽</h2>
        <span class="dash-date">{{ todayLabel }}</span>
      </div>
    </div>

    <!-- Market Snapshot -->
    <section class="section">
      <h3 class="section-title">市場快照</h3>
      <div v-if="statusLoading" class="snapshot-grid">
        <div v-for="i in 3" :key="i" class="snapshot-card skeleton-card">
          <div class="sk sk-label"></div>
          <div class="sk sk-value"></div>
          <div class="sk sk-sub"></div>
        </div>
      </div>
      <div v-else-if="statusError" class="inline-error">⚠️ 快照載入失敗</div>
      <div v-else class="snapshot-grid">
        <!-- VIX -->
        <div class="snapshot-card" :class="vixLevel.cardClass">
          <span class="snap-label">VIX 恐慌指數</span>
          <span class="snap-value">{{ status?.data?.rawUsMarket?.vix ?? "—" }}</span>
          <span class="snap-sub" :class="vixLevel.textClass">{{ vixLevel.label }}</span>
        </div>
        <!-- CNN Fear & Greed -->
        <div class="snapshot-card" :class="cnnLevel.cardClass">
          <span class="snap-label">CNN 情緒</span>
          <span class="snap-value">{{ status?.data?.rawCnn?.score ?? "—" }}</span>
          <span class="snap-sub" :class="cnnLevel.textClass">{{ status?.data?.rawCnn?.rating ?? "—" }}</span>
        </div>
        <!-- Business Cycle Light -->
        <div class="snapshot-card">
          <span class="snap-label">景氣燈號</span>
          <span class="snap-value snap-light">{{ lightEmoji }}</span>
          <span class="snap-sub snap-sub--neutral">{{ status?.data?.rawNdc?.light ?? "—" }}</span>
        </div>
      </div>
    </section>

    <!-- Latest Decision -->
    <section class="section">
      <h3 class="section-title">最新決策</h3>
      <div v-if="reportLoading" class="decision-card skeleton-card">
        <div class="sk sk-title"></div>
        <div class="sk sk-label" style="margin-top: 12px"></div>
        <div class="sk sk-value" style="width: 60%"></div>
      </div>
      <div v-else-if="reportError" class="inline-error">⚠️ 報告載入失敗</div>
      <div v-else-if="!latestReport" class="inline-hint">📭 尚無報告資料</div>
      <div v-else class="decision-card">
        <div class="decision-top">
          <span class="decision-date">{{ latestReport.date }}</span>
          <span class="decision-status">{{ latestReport.signals?.marketStatus }}</span>
        </div>
        <p class="decision-suggestion">
          {{ latestReport.signals?.targetSuggestion }}
        </p>
        <div class="decision-badges">
          <span class="badge" :class="pctClass">{{ pctText }}</span>
          <span class="badge badge-score">評分 {{ latestReport.signals?.weightScore }}</span>
          <span class="badge badge-target">{{ latestReport.signals?.target }}</span>
        </div>
        <!-- AI action items -->
        <div v-if="latestReport.ai?.action_items?.length">
          <ul class="action-list">
            <li v-for="(item, i) in displayedActionItems" :key="i">
              <span class="action-dot"></span>{{ item }}
            </li>
          </ul>
          <!-- Expanded AI detail -->
          <div v-if="aiExpanded" class="ai-detail">
            <p v-if="latestReport.ai?.summary" class="ai-summary">
              {{ latestReport.ai.summary }}
            </p>
            <p v-if="latestReport.ai?.reasoning" class="ai-reasoning">
              {{ latestReport.ai.reasoning }}
            </p>
          </div>
          <button class="expand-btn" @click="aiExpanded = !aiExpanded">
            {{ aiExpanded ? "▲ 收起" : "▼ 展開完整 AI 建議" }}
          </button>
        </div>
      </div>
    </section>

    <!-- Technical Indicators -->
    <section class="section">
      <h3 class="section-title">技術指標</h3>
      <div v-if="reportLoading" class="indicators-grid">
        <div v-for="i in 5" :key="i" class="indicator-card skeleton-card">
          <div class="sk sk-label"></div>
          <div class="sk sk-value" style="margin-top: 8px"></div>
          <div class="sk sk-sub" style="margin-top: 6px"></div>
        </div>
      </div>
      <div v-else-if="reportError" class="inline-error">⚠️ 指標載入失敗</div>
      <div v-else-if="!latestReport" class="inline-hint">📭 尚無指標資料</div>
      <div v-else class="indicators-grid">
        <!-- RSI -->
        <div class="indicator-card" :class="rsiInfo.cardClass">
          <span class="ind-label">RSI</span>
          <span class="ind-value">{{ rsiInfo.display }}</span>
          <span class="ind-sub" :class="rsiInfo.textClass">{{ rsiInfo.label }}</span>
        </div>
        <!-- KD_K -->
        <div class="indicator-card" :class="kdKInfo.cardClass">
          <span class="ind-label">KD (K)</span>
          <span class="ind-value">{{ kdKInfo.display }}</span>
          <span class="ind-sub" :class="kdKInfo.textClass">{{ kdKInfo.label }}</span>
        </div>
        <!-- KD_D -->
        <div class="indicator-card" :class="kdDInfo.cardClass">
          <span class="ind-label">KD (D)</span>
          <span class="ind-value">{{ kdDInfo.display }}</span>
          <span class="ind-sub" :class="kdDInfo.textClass">{{ kdDInfo.label }}</span>
        </div>
        <!-- Bias240 -->
        <div class="indicator-card" :class="biasInfo.cardClass">
          <span class="ind-label">乖離率 MA240</span>
          <span class="ind-value">{{ biasInfo.display }}</span>
          <span class="ind-sub" :class="biasInfo.textClass">{{ biasInfo.label }}</span>
        </div>
        <!-- MACD Signal -->
        <div class="indicator-card" :class="macdInfo.cardClass">
          <span class="ind-label">MACD</span>
          <span class="ind-value ind-value--sm">{{ macdInfo.display }}</span>
          <span class="ind-sub" :class="macdInfo.textClass">{{ macdInfo.label }}</span>
        </div>
      </div>
    </section>

    <!-- News Preview -->
    <section class="section">
      <div class="section-header">
        <h3 class="section-title">最新消息</h3>
        <router-link to="/news" class="section-more">查看全部 →</router-link>
      </div>
      <div v-if="newsLoading" class="news-preview-list">
        <div v-for="i in 3" :key="i" class="news-preview-card skeleton-card">
          <div class="sk sk-label" style="width: 40%"></div>
          <div class="sk sk-title" style="margin-top: 6px"></div>
        </div>
      </div>
      <div v-else-if="newsError" class="inline-error">⚠️ 新聞載入失敗</div>
      <div v-else-if="topNews.length === 0" class="inline-hint">📭 目前無新聞</div>
      <div v-else class="news-preview-list">
        <div
          v-for="article in topNews"
          :key="article.id"
          class="news-preview-card"
          @click="openLink(article.url)"
        >
          <div class="news-preview-meta">
            <span class="news-age-dot" :class="ageDotClass(article.age_band)"></span>
            <span class="news-preview-source">{{ article.source }}</span>
            <span class="news-preview-region">{{ regionFlag(article._region) }}</span>
          </div>
          <p class="news-preview-title">{{ article.title }}</p>
        </div>
      </div>
    </section>

    <!-- Update time -->
    <p v-if="status?.updatedAt" class="update-time">
      資料更新：{{ formatUpdatedAt(status.updatedAt) }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus, fetchReports, fetchNews } from "../api/index.js";
import { useTelegram } from "../composables/useTelegram.js";

const { openLink } = useTelegram();

// ── state ──
const status = ref(null);
const statusLoading = ref(true);
const statusError = ref(false);

const latestReport = ref(null);
const reportLoading = ref(true);
const reportError = ref(false);

const topNews = ref([]);
const newsLoading = ref(true);
const newsError = ref(false);

const aiExpanded = ref(false);

// ── today label ──
const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

// ── VIX level（讀 rawUsMarket.vix）──
const vixLevel = computed(() => {
  const v = parseFloat(status.value?.data?.rawUsMarket?.vix);
  if (isNaN(v))
    return { label: "—", cardClass: "", textClass: "snap-sub--neutral" };
  if (v >= 30)
    return { label: "極度恐慌", cardClass: "card-danger", textClass: "snap-sub--danger" };
  if (v >= 20)
    return { label: "警戒", cardClass: "card-warn", textClass: "snap-sub--warn" };
  return { label: "平穩", cardClass: "card-ok", textClass: "snap-sub--ok" };
});

// ── CNN level（讀 rawCnn.score）──
const cnnLevel = computed(() => {
  const v = parseFloat(status.value?.data?.rawCnn?.score);
  if (isNaN(v)) return { cardClass: "", textClass: "snap-sub--neutral" };
  if (v <= 25) return { cardClass: "card-danger", textClass: "snap-sub--danger" };
  if (v <= 45) return { cardClass: "card-warn", textClass: "snap-sub--warn" };
  if (v >= 75) return { cardClass: "card-greed", textClass: "snap-sub--greed" };
  return { cardClass: "card-ok", textClass: "snap-sub--ok" };
});

// ── Business cycle emoji（讀 rawNdc.light）──
const lightEmoji = computed(() => {
  const sig = status.value?.data?.rawNdc?.light ?? "";
  if (sig.includes("紅") || sig.includes("熱絡")) return "🔴";
  if (sig.includes("黃紅") || sig.includes("活絡")) return "🟠";
  if (sig.includes("綠") || sig.includes("穩定")) return "🟢";
  if (sig.includes("黃藍") || sig.includes("趨緩")) return "🟡";
  if (sig.includes("藍") || sig.includes("低迷")) return "🔵";
  return "⚪";
});

// ── Report badges ──
const pctClass = computed(() => {
  const p = latestReport.value?.signals?.priceChangePercent;
  return p >= 0 ? "badge-pos" : "badge-neg";
});
const pctText = computed(() => {
  const r = latestReport.value;
  if (!r) return "";
  const p = r.signals?.priceChangePercent;
  return `${p >= 0 ? "+" : ""}${r.signals?.priceChangePercentText}%`;
});

// ── AI action items ──
const displayedActionItems = computed(
  () => latestReport.value?.ai?.action_items ?? [],
);

// ── Technical indicator helpers ──
function indicatorInfo(value, thresholds) {
  const v = Number.isFinite(value) ? value : null;
  const display = v !== null ? v.toFixed(1) : "—";
  if (v === null)
    return { display, label: "—", cardClass: "", textClass: "ind-sub--neutral" };
  if (thresholds.danger_high !== undefined && v >= thresholds.danger_high)
    return { display, label: "過熱", cardClass: "ind-danger", textClass: "ind-sub--danger" };
  if (thresholds.warn_high !== undefined && v >= thresholds.warn_high)
    return { display, label: "偏熱", cardClass: "ind-warn", textClass: "ind-sub--warn" };
  if (thresholds.danger_low !== undefined && v <= thresholds.danger_low)
    return { display, label: "超賣", cardClass: "ind-buy", textClass: "ind-sub--buy" };
  if (thresholds.ok_low !== undefined && v <= thresholds.ok_low)
    return { display, label: "低檔", cardClass: "ind-ok", textClass: "ind-sub--ok" };
  return { display, label: "正常", cardClass: "", textClass: "ind-sub--neutral" };
}

const rsiInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.RSI, {
    danger_high: 80, warn_high: 70, ok_low: 40, danger_low: 30,
  }),
);
const kdKInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.KD_K, {
    danger_high: 85, warn_high: 70, ok_low: 30, danger_low: 20,
  }),
);
const kdDInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.KD_D, {
    danger_high: 85, warn_high: 70, ok_low: 30, danger_low: 20,
  }),
);
const biasInfo = computed(() => {
  const v = latestReport.value?.signals?.bias240;
  const val = Number.isFinite(v) ? v : null;
  const display = val !== null ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}%` : "—";
  if (val === null)
    return { display, label: "—", cardClass: "", textClass: "ind-sub--neutral" };
  if (val >= 25)
    return { display, label: "極高位", cardClass: "ind-danger", textClass: "ind-sub--danger" };
  if (val >= 15)
    return { display, label: "高位偏貴", cardClass: "ind-warn", textClass: "ind-sub--warn" };
  if (val < 0)
    return { display, label: "低位便宜", cardClass: "ind-buy", textClass: "ind-sub--buy" };
  return { display, label: "中位正常", cardClass: "", textClass: "ind-sub--neutral" };
});
const macdInfo = computed(() => {
  const sig = latestReport.value?.signals?.macdSignal;
  if (!sig) return { display: "—", label: "—", cardClass: "", textClass: "ind-sub--neutral" };
  const signal = sig?.signal ?? sig;
  if (signal === "bullish")
    return { display: "多頭", label: sig?.description ?? "MACD 多頭", cardClass: "ind-ok", textClass: "ind-sub--ok" };
  if (signal === "bearish")
    return { display: "空頭", label: sig?.description ?? "MACD 空頭", cardClass: "ind-warn", textClass: "ind-sub--warn" };
  return { display: "中性", label: sig?.description ?? "無明顯訊號", cardClass: "", textClass: "ind-sub--neutral" };
});

// ── Helpers ──
function ageDotClass(band) {
  if (band === "fresh") return "dot-fresh";
  if (band === "recent") return "dot-recent";
  return "dot-old";
}
function regionFlag(region) {
  if (region === "TW") return "🇹🇼";
  if (region === "US") return "🇺🇸";
  return "🌐";
}
function formatUpdatedAt(iso) {
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Load ──
async function loadAll() {
  const [sRes, rRes, nRes] = await Promise.allSettled([
    fetchStatus(),
    fetchReports(5),
    fetchNews(),
  ]);

  statusLoading.value = false;
  if (sRes.status === "fulfilled") status.value = sRes.value;
  else statusError.value = true;

  reportLoading.value = false;
  if (rRes.status === "fulfilled") {
    const sorted = [...(rRes.value ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    latestReport.value = sorted[0] ?? null;
  } else {
    reportError.value = true;
  }

  newsLoading.value = false;
  if (nRes.status === "fulfilled") {
    const list = Array.isArray(nRes.value)
      ? nRes.value
      : (nRes.value?.articles ?? []);
    const order = { fresh: 0, recent: 1, old: 2 };
    topNews.value = [...list]
      .sort((a, b) => (order[a.age_band] ?? 2) - (order[b.age_band] ?? 2))
      .slice(0, 3);
  } else {
    newsError.value = true;
  }
}

onMounted(loadAll);
</script>

<style scoped>
.view-container {
  padding: 16px 16px 24px;
  min-height: 100%;
}

/* ── Header ── */
.dash-header { margin-bottom: 20px; }
.dash-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.dash-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
}
.dash-date {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

/* ── Section ── */
.section { margin-bottom: 20px; }
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 10px;
}
.section-header .section-title { margin-bottom: 0; }
.section-more {
  font-size: 12px;
  color: var(--tg-theme-button-color, #2481cc);
  text-decoration: none;
}

/* ── Snapshot Grid ── */
.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.snapshot-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
  transition: background 0.2s;
}
.card-danger { background: rgba(232, 72, 85, 0.1); }
.card-warn   { background: rgba(212, 172, 13, 0.1); }
.card-ok     { background: rgba(38, 161, 123, 0.1); }
.card-greed  { background: rgba(212, 172, 13, 0.08); }

.snap-label {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #999);
  white-space: nowrap;
}
.snap-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  line-height: 1.2;
}
.snap-light { font-size: 22px; }
.snap-sub { font-size: 11px; font-weight: 500; }
.snap-sub--neutral { color: var(--tg-theme-hint-color, #999); }
.snap-sub--danger  { color: #e84855; }
.snap-sub--warn    { color: #d4ac0d; }
.snap-sub--ok      { color: #26a17b; }
.snap-sub--greed   { color: #d4ac0d; }

/* ── Decision Card ── */
.decision-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 14px;
  padding: 14px;
}
.decision-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.decision-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.decision-status {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}
.decision-suggestion {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.5;
  margin-bottom: 10px;
}
.decision-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.badge {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 20px;
  font-weight: 600;
}
.badge-pos    { background: rgba(38, 161, 123, 0.15); color: #26a17b; }
.badge-neg    { background: rgba(232, 72, 85, 0.12);  color: #e84855; }
.badge-score  { background: var(--tg-theme-secondary-bg-color, #eee); color: var(--tg-theme-hint-color, #666); }
.badge-target { background: rgba(36, 129, 204, 0.12); color: var(--tg-theme-button-color, #2481cc); }

/* ── Action list ── */
.action-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding-top: 10px;
}
.action-list li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--tg-theme-text-color, #555);
  line-height: 1.45;
}
.action-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--tg-theme-button-color, #2481cc);
  flex-shrink: 0;
  margin-top: 5px;
}

/* ── AI expanded detail ── */
.ai-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-summary {
  font-size: 13px;
  color: var(--tg-theme-text-color, #333);
  line-height: 1.55;
  font-weight: 500;
}
.ai-reasoning {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.55;
}
.expand-btn {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 7px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-button-color, #2481cc);
  background: rgba(36, 129, 204, 0.07);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: background 0.15s;
}
.expand-btn:active { background: rgba(36, 129, 204, 0.15); }

/* ── Technical Indicators ── */
.indicators-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.indicators-grid .indicator-card:nth-child(4) { grid-column: 1 / 2; }
.indicators-grid .indicator-card:nth-child(5) { grid-column: 2 / 3; }

.indicator-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 11px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
  transition: background 0.2s;
}
.ind-danger { background: rgba(232, 72, 85, 0.10); }
.ind-warn   { background: rgba(212, 172, 13, 0.10); }
.ind-ok     { background: rgba(38, 161, 123, 0.10); }
.ind-buy    { background: rgba(36, 129, 204, 0.10); }

.ind-label {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #999);
  white-space: nowrap;
}
.ind-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  line-height: 1.2;
}
.ind-value--sm { font-size: 14px; }
.ind-sub { font-size: 10px; font-weight: 500; }
.ind-sub--neutral { color: var(--tg-theme-hint-color, #999); }
.ind-sub--danger  { color: #e84855; }
.ind-sub--warn    { color: #d4ac0d; }
.ind-sub--ok      { color: #26a17b; }
.ind-sub--buy     { color: #2481cc; }

/* ── News Preview ── */
.news-preview-list { display: flex; flex-direction: column; gap: 6px; }
.news-preview-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
}
.news-preview-card:active { opacity: 0.75; }
.news-preview-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}
.news-age-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-fresh  { background: #e84855; }
.dot-recent { background: #d4ac0d; }
.dot-old    { background: #bbb; }
.news-preview-source {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  flex: 1;
}
.news-preview-region { font-size: 12px; }
.news-preview-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--tg-theme-text-color, #222);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Update time ── */
.update-time {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #bbb);
  text-align: center;
  margin-top: 8px;
}

/* ── Inline states ── */
.inline-error {
  font-size: 13px;
  color: #e84855;
  padding: 12px;
}
.inline-hint {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
  padding: 12px;
}

/* ── Skeleton ── */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.sk {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--tg-theme-secondary-bg-color, #e8e8e8) 25%,
    rgba(255, 255, 255, 0.35) 50%,
    var(--tg-theme-secondary-bg-color, #e8e8e8) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.sk-label  { height: 10px; width: 70%; }
.sk-value  { height: 20px; width: 50%; margin-top: 8px; }
.sk-sub    { height: 10px; width: 55%; margin-top: 6px; }
.sk-title  { height: 14px; width: 90%; }
</style>
