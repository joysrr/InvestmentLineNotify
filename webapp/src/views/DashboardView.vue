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
        <div class="snapshot-card" :class="vixLevel.cardClass">
          <span class="snap-label">VIX 恐慌指數</span>
          <span class="snap-value">{{ status?.data?.rawUsMarket?.vix ?? "—" }}</span>
          <span class="snap-sub" :class="vixLevel.textClass">{{ vixLevel.label }}</span>
        </div>
        <div class="snapshot-card" :class="cnnLevel.cardClass">
          <span class="snap-label">CNN 情緒</span>
          <span class="snap-value">{{ status?.data?.rawCnn?.score ?? "—" }}</span>
          <span class="snap-sub" :class="cnnLevel.textClass">{{ status?.data?.rawCnn?.rating ?? "—" }}</span>
        </div>
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
        <div class="sk sk-label" style="margin-top:12px"></div>
        <div class="sk sk-value" style="width:60%"></div>
      </div>
      <div v-else-if="reportError" class="inline-error">⚠️ 報告載入失敗</div>
      <div v-else-if="!latestReport" class="inline-hint">📭 尚無報告資料</div>
      <div v-else class="decision-card">
        <div class="decision-top">
          <span class="decision-date">{{ latestReport.date }}</span>
          <span class="decision-status">{{ latestReport.signals?.marketStatus }}</span>
        </div>
        <p class="decision-suggestion">{{ latestReport.signals?.targetSuggestion }}</p>
        <div class="decision-badges">
          <span class="badge" :class="pctClass">{{ pctText }}</span>
          <span class="badge badge-score">評分 {{ latestReport.signals?.weightScore }}</span>
          <span class="badge badge-target">{{ latestReport.signals?.target }}</span>
        </div>
      </div>
    </section>

    <!-- 進場評分 -->
    <section class="section" v-if="latestReport">
      <h3 class="section-title">📊 進場評分</h3>
      <div class="score-list">
        <div class="score-row" v-for="row in scoreRows" :key="row.label" :class="row.active ? 'score-row--active' : ''">
          <span class="score-icon">{{ row.active ? '⭐' : '➖' }}</span>
          <span class="score-label">{{ row.label }}</span>
          <span class="score-pt" :class="row.active ? 'score-pt--active' : ''">{{ row.pt }}</span>
          <span class="score-info">{{ row.info }}</span>
        </div>
      </div>
      <div class="score-verdict" :class="scoreOk ? 'verdict-ok' : 'verdict-wait'">
        {{ scoreOk ? '🟢 條件達標，可評估入場' : '⏸️ 條件未滿，請維持觀望' }}
        <span class="verdict-num">{{ scoreVal }} pt（門檻 {{ scoreMin }} pt）</span>
      </div>
    </section>

    <!-- 技術指標 -->
    <section class="section">
      <h3 class="section-title">技術指標</h3>
      <div v-if="reportLoading" class="indicators-grid">
        <div v-for="i in 5" :key="i" class="indicator-card skeleton-card">
          <div class="sk sk-label"></div>
          <div class="sk sk-value" style="margin-top:8px"></div>
          <div class="sk sk-sub" style="margin-top:6px"></div>
        </div>
      </div>
      <div v-else-if="!latestReport" class="inline-hint">📭 尚無指標資料</div>
      <div v-else class="indicators-grid">
        <div class="indicator-card" :class="rsiInfo.cardClass">
          <span class="ind-label">RSI</span>
          <span class="ind-value">{{ rsiInfo.display }}</span>
          <span class="ind-sub" :class="rsiInfo.textClass">{{ rsiInfo.label }}</span>
        </div>
        <div class="indicator-card" :class="kdKInfo.cardClass">
          <span class="ind-label">KD (K)</span>
          <span class="ind-value">{{ kdKInfo.display }}</span>
          <span class="ind-sub" :class="kdKInfo.textClass">{{ kdKInfo.label }}</span>
        </div>
        <div class="indicator-card" :class="kdDInfo.cardClass">
          <span class="ind-label">KD (D)</span>
          <span class="ind-value">{{ kdDInfo.display }}</span>
          <span class="ind-sub" :class="kdDInfo.textClass">{{ kdDInfo.label }}</span>
        </div>
        <div class="indicator-card" :class="biasInfo.cardClass">
          <span class="ind-label">乖離率 MA240</span>
          <span class="ind-value">{{ biasInfo.display }}</span>
          <span class="ind-sub" :class="biasInfo.textClass">{{ biasInfo.label }}</span>
        </div>
        <div class="indicator-card" :class="macdInfo.cardClass">
          <span class="ind-label">MACD</span>
          <span class="ind-value ind-value--sm">{{ macdInfo.display }}</span>
          <span class="ind-sub" :class="macdInfo.textClass">{{ macdInfo.label }}</span>
        </div>
      </div>
    </section>

    <!-- 風險雷達 -->
    <section class="section" v-if="latestReport">
      <h3 class="section-title">📡 風險雷達</h3>
      <div class="risk-summary">
        <div class="risk-bar" :class="reversalRiskClass">
          <span class="risk-bar-label">轉弱訊號</span>
          <span class="risk-bar-count">{{ reversalTriggered }} / {{ reversalTotal }}</span>
          <div class="risk-dots">
            <span v-for="i in reversalTotal" :key="i" class="risk-dot" :class="i <= reversalTriggered ? 'dot-on' : 'dot-off'"></span>
          </div>
        </div>
        <div class="risk-bar" :class="sellRiskClass">
          <span class="risk-bar-label">賣出訊號</span>
          <span class="risk-bar-count">{{ sellTriggered }} / {{ sellTotal }}</span>
          <div class="risk-dots">
            <span v-for="i in sellTotal" :key="i" class="risk-dot" :class="i <= sellTriggered ? 'dot-on' : 'dot-off'"></span>
          </div>
        </div>
      </div>

      <!-- 轉弱監控詳細 -->
      <div class="signal-group">
        <button class="signal-group-header" @click="reversalExpanded = !reversalExpanded">
          <span>🔄 轉弱監控詳細</span>
          <span class="expand-arrow">{{ reversalExpanded ? '▲' : '▼' }}</span>
        </button>
        <div v-if="reversalExpanded" class="signal-rows">
          <div v-for="sig in reversalSignals" :key="sig.name" class="signal-row" :class="sig.triggered ? 'sig-on' : 'sig-off'">
            <span class="sig-icon">{{ sig.triggered ? '⚡' : '▫️' }}</span>
            <span class="sig-name">{{ sig.name }}</span>
            <span class="sig-value">{{ sig.value }}</span>
            <span class="sig-cond">{{ sig.condition }}</span>
          </div>
        </div>
      </div>

      <!-- 賣出訊號詳細 -->
      <div class="signal-group">
        <button class="signal-group-header" @click="sellExpanded = !sellExpanded">
          <span>🕔 賣出訊號詳細</span>
          <span class="expand-arrow">{{ sellExpanded ? '▲' : '▼' }}</span>
        </button>
        <div v-if="sellExpanded" class="signal-rows">
          <div v-for="sig in sellSignals" :key="sig.name" class="signal-row" :class="sig.triggered ? 'sig-on' : 'sig-off'">
            <span class="sig-icon">{{ sig.triggered ? '⚡' : '▫️' }}</span>
            <span class="sig-name">{{ sig.name }}</span>
            <span class="sig-value">{{ sig.value }}</span>
            <span class="sig-cond">{{ sig.condition }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- AI 教練建議 -->
    <section class="section" v-if="latestReport?.ai">
      <h3 class="section-title">🤖 AI 教練建議</h3>

      <!-- 風險提示 -->
      <div class="ai-block" v-if="aiRiskWarnings.length">
        <button class="ai-block-header" @click="aiRiskExpanded = !aiRiskExpanded">
          <span>⚠️ 風險提示</span>
          <span class="ai-count">{{ aiRiskWarnings.length }} 項</span>
          <span class="expand-arrow">{{ aiRiskExpanded ? '▲' : '▼' }}</span>
        </button>
        <ul v-if="aiRiskExpanded" class="ai-list ai-list--risk">
          <li v-for="(item, i) in aiRiskWarnings" :key="i">{{ item }}</li>
        </ul>
      </div>

      <!-- 下一步觀察清單 -->
      <div class="ai-block" v-if="aiActionItems.length">
        <button class="ai-block-header" @click="aiActionExpanded = !aiActionExpanded">
          <span>📌 下一步觀察清單</span>
          <span class="ai-count">{{ aiActionItems.length }} 項</span>
          <span class="expand-arrow">{{ aiActionExpanded ? '▲' : '▼' }}</span>
        </button>
        <ul v-if="aiActionExpanded" class="ai-list ai-list--action">
          <li v-for="(item, i) in aiActionItems" :key="i">{{ item }}</li>
        </ul>
      </div>

      <!-- 行動微調建議 -->
      <div class="ai-block" v-if="aiMindsetAdvice.length">
        <button class="ai-block-header" @click="aiMindsetExpanded = !aiMindsetExpanded">
          <span>💡 行動微調建議</span>
          <span class="ai-count">{{ aiMindsetAdvice.length }} 項</span>
          <span class="expand-arrow">{{ aiMindsetExpanded ? '▲' : '▼' }}</span>
        </button>
        <ul v-if="aiMindsetExpanded" class="ai-list ai-list--mindset">
          <li v-for="(item, i) in aiMindsetAdvice" :key="i">{{ item }}</li>
        </ul>
      </div>

      <!-- 教練內心推演 -->
      <div class="ai-block" v-if="aiInternalThinking">
        <button class="ai-block-header" @click="aiThinkingExpanded = !aiThinkingExpanded">
          <span>🧠 教練內心推演</span>
          <span class="expand-arrow">{{ aiThinkingExpanded ? '▲' : '▼' }}</span>
        </button>
        <p v-if="aiThinkingExpanded" class="ai-thinking">{{ aiInternalThinking }}</p>
      </div>

      <!-- fallback: 舊格式 summary/reasoning -->
      <div v-if="!aiRiskWarnings.length && !aiActionItems.length && latestReport.ai?.summary" class="ai-fallback">
        <p class="ai-summary">{{ latestReport.ai.summary }}</p>
        <p v-if="latestReport.ai?.reasoning" class="ai-reasoning">{{ latestReport.ai.reasoning }}</p>
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
          <div class="sk sk-label" style="width:40%"></div>
          <div class="sk sk-title" style="margin-top:6px"></div>
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

// ── expand states ──
const reversalExpanded  = ref(false);
const sellExpanded      = ref(false);
const aiRiskExpanded    = ref(true);
const aiActionExpanded  = ref(true);
const aiMindsetExpanded = ref(false);
const aiThinkingExpanded = ref(false);

// ── today label ──
const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long", day: "numeric", weekday: "short",
  })
);

// ── VIX level ──
const vixLevel = computed(() => {
  const v = parseFloat(status.value?.data?.rawUsMarket?.vix);
  if (isNaN(v)) return { label: "—", cardClass: "", textClass: "snap-sub--neutral" };
  if (v >= 30) return { label: "極度恐慌", cardClass: "card-danger", textClass: "snap-sub--danger" };
  if (v >= 20) return { label: "警戒",     cardClass: "card-warn",   textClass: "snap-sub--warn" };
  return { label: "平穩", cardClass: "card-ok", textClass: "snap-sub--ok" };
});

// ── CNN level ──
const cnnLevel = computed(() => {
  const v = parseFloat(status.value?.data?.rawCnn?.score);
  if (isNaN(v)) return { cardClass: "", textClass: "snap-sub--neutral" };
  if (v <= 25)  return { cardClass: "card-danger", textClass: "snap-sub--danger" };
  if (v <= 45)  return { cardClass: "card-warn",   textClass: "snap-sub--warn" };
  if (v >= 75)  return { cardClass: "card-greed",  textClass: "snap-sub--greed" };
  return { cardClass: "card-ok", textClass: "snap-sub--ok" };
});

// ── Business cycle emoji ──
const lightEmoji = computed(() => {
  const sig = status.value?.data?.rawNdc?.light ?? "";
  if (sig.includes("紅") || sig.includes("熱絡"))   return "🔴";
  if (sig.includes("黃紅") || sig.includes("活絡")) return "🟠";
  if (sig.includes("綠") || sig.includes("穩定"))   return "🟢";
  if (sig.includes("黃藍") || sig.includes("趨緩")) return "🟡";
  if (sig.includes("藍") || sig.includes("低迷"))   return "🔵";
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

// ── 進場評分 ──
const w = computed(() => latestReport.value?.weightDetails ?? {});
const scoreVal = computed(() => {
  const v = latestReport.value?.signals?.weightScore;
  return Number.isFinite(Number(v)) ? Number(v) : "--";
});
const scoreMin = computed(() => {
  const v = latestReport.value?.strategy?.buy?.minWeightScoreToBuy;
  return Number.isFinite(Number(v)) ? Number(v) : "--";
});
const scoreOk = computed(() =>
  typeof scoreVal.value === "number" &&
  typeof scoreMin.value === "number" &&
  scoreVal.value >= scoreMin.value
);
const scoreRows = computed(() => [
  { label: "跌幅", pt: fmtPt(w.value.dropScore),  info: w.value.dropInfo  ?? "─", active: Number(w.value.dropScore)  > 0 },
  { label: "RSI",  pt: fmtPt(w.value.rsiScore),   info: w.value.rsiInfo   ?? "─", active: Number(w.value.rsiScore)   > 0 },
  { label: "MACD", pt: fmtPt(w.value.macdScore),  info: w.value.macdInfo  ?? "─", active: Number(w.value.macdScore)  > 0 },
  { label: "KD",   pt: fmtPt(w.value.kdScore),    info: w.value.kdInfo    ?? "─", active: Number(w.value.kdScore)    > 0 },
]);
function fmtPt(v) {
  return Number.isFinite(Number(v)) ? `${Number(v)}pt` : "--";
}

// ── 技術指標 helpers ──
function indicatorInfo(value, thresholds) {
  const v = Number.isFinite(value) ? value : null;
  const display = v !== null ? v.toFixed(1) : "—";
  if (v === null) return { display, label: "—", cardClass: "", textClass: "ind-sub--neutral" };
  if (thresholds.danger_high !== undefined && v >= thresholds.danger_high)
    return { display, label: "過熱",   cardClass: "ind-danger", textClass: "ind-sub--danger" };
  if (thresholds.warn_high  !== undefined && v >= thresholds.warn_high)
    return { display, label: "偏熱",   cardClass: "ind-warn",   textClass: "ind-sub--warn" };
  if (thresholds.danger_low !== undefined && v <= thresholds.danger_low)
    return { display, label: "超賣",   cardClass: "ind-buy",    textClass: "ind-sub--buy" };
  if (thresholds.ok_low     !== undefined && v <= thresholds.ok_low)
    return { display, label: "低檔",   cardClass: "ind-ok",     textClass: "ind-sub--ok" };
  return { display, label: "正常", cardClass: "", textClass: "ind-sub--neutral" };
}
const rsiInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.RSI, { danger_high: 80, warn_high: 70, ok_low: 40, danger_low: 30 })
);
const kdKInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.KD_K, { danger_high: 85, warn_high: 70, ok_low: 30, danger_low: 20 })
);
const kdDInfo = computed(() =>
  indicatorInfo(latestReport.value?.signals?.KD_D, { danger_high: 85, warn_high: 70, ok_low: 30, danger_low: 20 })
);
const biasInfo = computed(() => {
  const v   = latestReport.value?.signals?.bias240;
  const val = Number.isFinite(v) ? v : null;
  const display = val !== null ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}%` : "—";
  if (val === null) return { display, label: "—", cardClass: "", textClass: "ind-sub--neutral" };
  if (val >= 25)   return { display, label: "極高位",   cardClass: "ind-danger", textClass: "ind-sub--danger" };
  if (val >= 15)   return { display, label: "高位偏貴", cardClass: "ind-warn",   textClass: "ind-sub--warn" };
  if (val < 0)     return { display, label: "低位便宜", cardClass: "ind-buy",    textClass: "ind-sub--buy" };
  return { display, label: "中位正常", cardClass: "", textClass: "ind-sub--neutral" };
});
const macdInfo = computed(() => {
  const sig    = latestReport.value?.signals?.macdSignal;
  if (!sig) return { display: "—", label: "—", cardClass: "", textClass: "ind-sub--neutral" };
  const signal = sig?.signal ?? sig;
  if (signal === "bullish") return { display: "多頭", label: sig?.description ?? "MACD 多頭", cardClass: "ind-ok",   textClass: "ind-sub--ok" };
  if (signal === "bearish") return { display: "空頭", label: sig?.description ?? "MACD 空頭", cardClass: "ind-warn", textClass: "ind-sub--warn" };
  return { display: "中性", label: sig?.description ?? "無明顯訊號", cardClass: "", textClass: "ind-sub--neutral" };
});

// ── 風險雷達 ──
const rsi       = computed(() => Number(latestReport.value?.signals?.RSI));
const kd_d      = computed(() => Number(latestReport.value?.signals?.KD_D));
const kd_k      = computed(() => Number(latestReport.value?.signals?.KD_K));
const bias240   = computed(() => Number(latestReport.value?.signals?.bias240));
const r         = computed(() => latestReport.value?.reversal ?? {});
const s         = computed(() => latestReport.value?.sellSignals ?? { flags: {} });
const th        = computed(() => latestReport.value?.strategy?.threshold ?? {});
const sellTh    = computed(() => latestReport.value?.strategy?.sell ?? {});

const reversalTriggered = computed(() => r.value.triggeredCount ?? 0);
const reversalTotal     = computed(() => r.value.totalFactor    ?? 4);
const sellTriggered     = computed(() => s.value.signalCount    ?? 0);
const sellTotal         = computed(() => s.value.total          ?? 3);

const reversalRiskClass = computed(() => {
  const ratio = reversalTriggered.value / reversalTotal.value;
  if (ratio >= 0.75) return "risk-high";
  if (ratio >= 0.5)  return "risk-mid";
  return "risk-low";
});
const sellRiskClass = computed(() => {
  const ratio = sellTriggered.value / sellTotal.value;
  if (ratio >= 0.67) return "risk-high";
  if (ratio >= 0.34) return "risk-mid";
  return "risk-low";
});

const reversalSignals = computed(() => {
  const kdCons = Math.min(kd_k.value, kd_d.value);
  return [
    {
      name: "RSI 轉弱",
      value: Number.isFinite(rsi.value) ? rsi.value.toFixed(1) : "--",
      condition: `> ${th.value.rsiReversalLevel} → <${th.value.rsiReversalLevel}`,
      triggered: Boolean(r.value.rsiDrop),
    },
    {
      name: "KD(保守)轉弱",
      value: Number.isFinite(kdCons) ? kdCons.toFixed(1) : "--",
      condition: `> ${th.value.kReversalLevel} → <${th.value.kReversalLevel}`,
      triggered: Boolean(r.value.kdDrop),
    },
    {
      name: "KD 死叉",
      value: r.value.kdBearCross   ? "死叉" : "未發生",
      condition: "K▽D",
      triggered: Boolean(r.value.kdBearCross),
    },
    {
      name: "MACD 死叉",
      value: r.value.macdBearCross ? "死叉" : "未發生",
      condition: "DIF▽DEA",
      triggered: Boolean(r.value.macdBearCross),
    },
  ];
});

const sellSignals = computed(() => [
  {
    name: "RSI",
    value: s.value.flags?.rsiSell  ? "已觸發" : "未觸發",
    condition: `> ${sellTh.value.rsi?.overbought} → 回落`,
    triggered: Boolean(s.value.flags?.rsiSell),
  },
  {
    name: "KD",
    value: s.value.flags?.kdSell   ? "已觸發" : "未觸發",
    condition: `K↘D & min≥${sellTh.value.kd?.overboughtK}`,
    triggered: Boolean(s.value.flags?.kdSell),
  },
  {
    name: "MACD",
    value: s.value.flags?.macdSell ? "已觸發" : "未觸發",
    condition: "DIF↘DEA & +→−",
    triggered: Boolean(s.value.flags?.macdSell),
  },
]);

// ── AI 建議（4 區塊）──
const aiData            = computed(() => latestReport.value?.ai ?? {});
const aiRiskWarnings    = computed(() => aiData.value.risk_warnings    ?? []);
const aiActionItems     = computed(() => aiData.value.action_items     ?? []);
const aiMindsetAdvice   = computed(() => aiData.value.mindset_advice   ?? []);
const aiInternalThinking = computed(() => aiData.value.coach_internal_thinking ?? "");

// ── News helpers ──
function ageDotClass(band) {
  if (band === "fresh")  return "dot-fresh";
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
      hour:  "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
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
    const sorted = [...(rRes.value ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    latestReport.value = sorted[0] ?? null;
  } else {
    reportError.value = true;
  }

  newsLoading.value = false;
  if (nRes.status === "fulfilled") {
    const list = Array.isArray(nRes.value) ? nRes.value : (nRes.value?.articles ?? []);
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
.snap-label  { font-size: 10px; color: var(--tg-theme-hint-color, #999); white-space: nowrap; }
.snap-value  { font-size: 20px; font-weight: 700; color: var(--tg-theme-text-color, #111); line-height: 1.2; }
.snap-light  { font-size: 22px; }
.snap-sub    { font-size: 11px; font-weight: 500; }
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
.decision-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.decision-date   { font-size: 13px; font-weight: 600; color: var(--tg-theme-text-color, #222); }
.decision-status { font-size: 11px; color: var(--tg-theme-hint-color, #999); }
.decision-suggestion {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.5;
  margin-bottom: 10px;
}
.decision-badges { display: flex; gap: 6px; flex-wrap: wrap; }
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

/* ── 進場評分 ── */
.score-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.score-row {
  display: grid;
  grid-template-columns: 20px 48px 48px 1fr;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
  font-size: 13px;
  opacity: 0.55;
}
.score-row--active { opacity: 1; }
.score-icon  { font-size: 14px; }
.score-label { font-weight: 600; color: var(--tg-theme-text-color, #222); }
.score-pt    { font-size: 12px; font-weight: 700; color: var(--tg-theme-hint-color, #999); }
.score-pt--active { color: var(--tg-theme-button-color, #2481cc); }
.score-info  { font-size: 11px; color: var(--tg-theme-hint-color, #999); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.score-verdict {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}
.verdict-ok   { background: rgba(38, 161, 123, 0.12); color: #26a17b; }
.verdict-wait { background: rgba(212, 172, 13, 0.10); color: #a07a00; }
.verdict-num  { font-size: 11px; font-weight: 400; opacity: 0.8; }

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
}
.ind-danger { background: rgba(232, 72, 85, 0.10); }
.ind-warn   { background: rgba(212, 172, 13, 0.10); }
.ind-ok     { background: rgba(38, 161, 123, 0.10); }
.ind-buy    { background: rgba(36, 129, 204, 0.10); }
.ind-label  { font-size: 10px; color: var(--tg-theme-hint-color, #999); white-space: nowrap; }
.ind-value  { font-size: 18px; font-weight: 700; color: var(--tg-theme-text-color, #111); line-height: 1.2; }
.ind-value--sm { font-size: 14px; }
.ind-sub    { font-size: 10px; font-weight: 500; }
.ind-sub--neutral { color: var(--tg-theme-hint-color, #999); }
.ind-sub--danger  { color: #e84855; }
.ind-sub--warn    { color: #d4ac0d; }
.ind-sub--ok      { color: #26a17b; }
.ind-sub--buy     { color: #2481cc; }

/* ── 風險雷達 ── */
.risk-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.risk-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
}
.risk-low  { border-left: 3px solid #26a17b; }
.risk-mid  { border-left: 3px solid #d4ac0d; }
.risk-high { border-left: 3px solid #e84855; }
.risk-bar-label { font-size: 13px; font-weight: 600; color: var(--tg-theme-text-color, #222); flex: 1; }
.risk-bar-count { font-size: 13px; font-weight: 700; color: var(--tg-theme-hint-color, #666); }
.risk-dots  { display: flex; gap: 5px; }
.risk-dot   { width: 10px; height: 10px; border-radius: 50%; }
.dot-on     { background: #e84855; }
.dot-off    { background: rgba(0,0,0,0.12); }

/* ── Signal Groups ── */
.signal-group {
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.07);
}
.signal-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  border: none;
  cursor: pointer;
  text-align: left;
}
.signal-group-header:active { opacity: 0.7; }
.expand-arrow { font-size: 11px; color: var(--tg-theme-hint-color, #999); }
.signal-rows { padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 5px; }
.signal-row {
  display: grid;
  grid-template-columns: 20px 1fr 52px auto;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 7px;
  font-size: 12px;
}
.sig-on  { background: rgba(232, 72, 85, 0.08); }
.sig-off { background: rgba(0,0,0,0.03); }
.sig-icon  { font-size: 13px; }
.sig-name  { font-weight: 600; color: var(--tg-theme-text-color, #222); }
.sig-value { font-weight: 700; font-size: 11px; color: var(--tg-theme-hint-color, #666); text-align: right; }
.sig-cond  { font-size: 10px; color: var(--tg-theme-hint-color, #aaa); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── AI 建議 ── */
.ai-block {
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.07);
}
.ai-block-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  border: none;
  cursor: pointer;
  text-align: left;
  gap: 6px;
}
.ai-block-header:active { opacity: 0.7; }
.ai-block-header .expand-arrow { margin-left: auto; }
.ai-count {
  font-size: 11px;
  font-weight: 400;
  padding: 1px 7px;
  border-radius: 20px;
  background: rgba(36, 129, 204, 0.12);
  color: var(--tg-theme-button-color, #2481cc);
}
.ai-list {
  list-style: none;
  padding: 8px 12px 10px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.ai-list li {
  font-size: 13px;
  line-height: 1.5;
  padding-left: 14px;
  position: relative;
  color: var(--tg-theme-text-color, #333);
}
.ai-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  font-weight: 700;
}
.ai-list--risk     li::before { color: #e84855; }
.ai-list--action   li::before { color: #2481cc; }
.ai-list--mindset  li::before { color: #26a17b; }
.ai-thinking {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--tg-theme-hint-color, #666);
  font-style: italic;
}
.ai-fallback { padding: 4px 0; }
.ai-summary  { font-size: 13px; font-weight: 500; color: var(--tg-theme-text-color, #333); line-height: 1.55; margin-bottom: 8px; }
.ai-reasoning { font-size: 12px; color: var(--tg-theme-hint-color, #666); line-height: 1.55; }

/* ── News Preview ── */
.news-preview-list { display: flex; flex-direction: column; gap: 6px; }
.news-preview-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
}
.news-preview-card:active { opacity: 0.75; }
.news-preview-meta { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; }
.news-age-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot-fresh  { background: #e84855; }
.dot-recent { background: #d4ac0d; }
.dot-old    { background: #bbb; }
.news-preview-source { font-size: 11px; color: var(--tg-theme-hint-color, #999); flex: 1; }
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
.inline-error { font-size: 13px; color: #e84855; padding: 12px; }
.inline-hint  { font-size: 13px; color: var(--tg-theme-hint-color, #999); padding: 12px; }

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
    rgba(255,255,255,0.35) 50%,
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
