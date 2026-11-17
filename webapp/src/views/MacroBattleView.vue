<template>
    <GlobalErrorBoundary>
    <div class="view-container iln-page">
    <div class="page-header">
      <h2 class="page-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 總經多空對決</h2>
      <span class="page-date">{{ reportDate }}</span>
    </div>

    <!-- 市場戰情子分頁切換列 -->
    <RadarSubtabs />

    <!-- 載入中 -->
    <EmptyState v-if="loading" title="載入中..." />

    <!-- 錯誤 -->
    <ErrorAlert v-else-if="error" :visible="true" description="資料載入失敗，請稍後重試" />

    <!-- 無資料 -->
    <EmptyState v-else-if="!macro" title="尚無多空對決資料" message="資料將於每日分析完成後更新" />

    <!-- 內容 -->
    <template v-else>
      <!-- 市場方向 Badge -->
      <div class="direction-row">
        <span class="direction-badge" :class="directionClass">
          {{ directionIcon }} {{ directionText }}
        </span>
        <span class="direction-hint">{{
          macro.conclusion?.short_summary ?? ""
        }}</span>
      </div>

      <!-- 多空積分長條 -->
      <section class="section">
        <h3 class="section-title">多空積分</h3>
        <div class="score-wrap">
          <!-- 多方 -->
          <div class="score-bar-row">
            <span class="score-side score-side--bull">多 <Icon name="ok" size="sm" color="var(--iln-ok)" /></span>
            <div class="score-track">
              <div
                class="score-fill score-fill--bull"
                :style="{ width: bullWidth + '%' }"
              ></div>
            </div>
            <span class="score-num">{{ bullScore }}</span>
          </div>
          <!-- 空方 -->
          <div class="score-bar-row">
            <span class="score-side score-side--bear">空 <Icon name="danger" size="sm" color="var(--iln-danger)" /></span>
            <div class="score-track">
              <div
                class="score-fill score-fill--bear"
                :style="{ width: bearWidth + '%' }"
              ></div>
            </div>
            <span class="score-num">{{ bearScore }}</span>
          </div>
        </div>
      </section>

      <!-- 社群情緒 -->
      <SocialSentimentCard :sentiment="socialSentiment" />

      <!-- Key Takeaways -->
      <section v-if="takeaways.length" class="section">
        <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 核心驅動邏輯</h3>
        <ul class="takeaway-list">
          <li v-for="(item, i) in takeaways" :key="i" class="takeaway-item">
            <span class="takeaway-dot"></span>
            <span>{{ item }}</span>
          </li>
        </ul>
      </section>

      <!-- 多方事件 -->
      <section v-if="bullEvents.length" class="section">
        <h3 class="section-title"><Icon name="ok" size="sm" color="var(--iln-ok)" /> 多方事件（{{ bullEvents.length }}）</h3>
        <div class="event-list">
          <div
            v-for="(e, i) in bullEvents"
            :key="i"
            class="event-card event-card--bull"
          >
            <div class="event-top">
              <span class="event-score">+{{ e.score }}</span>
              <span class="event-title">{{ e.event }}</span>
            </div>
            <p v-if="e.analysis" class="event-analysis">{{ e.analysis }}</p>
          </div>
        </div>
      </section>

      <!-- 空方事件 -->
      <section v-if="bearEvents.length" class="section">
        <h3 class="section-title"><Icon name="danger" size="sm" color="var(--iln-danger)" /> 空方事件（{{ bearEvents.length }}）</h3>
        <div class="event-list">
          <div
            v-for="(e, i) in bearEvents"
            :key="i"
            class="event-card event-card--bear"
          >
            <div class="event-top">
              <span class="event-score">-{{ e.score }}</span>
              <span class="event-title">{{ e.event }}</span>
            </div>
            <p v-if="e.analysis" class="event-analysis">{{ e.analysis }}</p>
          </div>
        </div>
      </section>

      <!-- 中性事件 -->
      <section v-if="neutralEvents.length" class="section">
        <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 觀望事件（{{ neutralEvents.length }}）</h3>
        <div class="event-list">
          <div
            v-for="(e, i) in neutralEvents"
            :key="i"
            class="event-card event-card--neutral"
          >
            <div class="event-top">
              <span class="event-score neutral">0</span>
              <span class="event-title">{{ e.event }}</span>
            </div>
            <p v-if="e.analysis" class="event-analysis">{{ e.analysis }}</p>
          </div>
        </div>
      </section>
    </template>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import Icon from "@/components/common/Icon.vue";
import { fetchReports } from "../api/index.js";
import { fetchSocialSentiment } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import SocialSentimentCard from "@/components/macro/SocialSentimentCard.vue";
import RadarSubtabs from "@/components/radar/RadarSubtabs.vue";
import { waitReady } from "../composables/useTelegram.js";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";

const loading = ref(true);
const error = ref(false);
const macro = ref(null); // macroAnalysis 物件
const socialSentiment = ref(null);
const reportDate = ref("");

onMounted(async () => {
  await waitReady();
  try {
    const reports = await fetchReports(3);
    const sorted = [...(reports ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    const latest = sorted[0] ?? null;
    reportDate.value = latest?.date ?? "";
    macro.value = latest?.macroAnalysis ?? null;
  } catch {
    error.value = true;
  }

  // Fetch social sentiment (safe-fallback: errors swallowed, null fallback)
  try {
    socialSentiment.value = await fetchSocialSentiment();
  } catch {
    socialSentiment.value = null;
  } finally {
    loading.value = false;
  }
});

// ── 積分 ──
const bullScore = computed(
  () => macro.value?.total_bull_score ?? macro.value?.bullish ?? 0,
);
const bearScore = computed(
  () => macro.value?.total_bear_score ?? macro.value?.bearish ?? 0,
);
const totalScore = computed(() => bullScore.value + bearScore.value || 1);
const bullWidth = computed(() =>
  Math.round((bullScore.value / totalScore.value) * 100),
);
const bearWidth = computed(() =>
  Math.round((bearScore.value / totalScore.value) * 100),
);

// ── 事件 ──
const bullEvents = computed(() => macro.value?.bull_events ?? []);
const bearEvents = computed(() => macro.value?.bear_events ?? []);
const neutralEvents = computed(() => macro.value?.neutral_events ?? []);
const takeaways = computed(() => macro.value?.conclusion?.key_takeaways ?? []);

// ── 市場方向 ──
const direction = computed(
  () => macro.value?.conclusion?.market_direction ?? "",
);
const directionText = computed(() => {
  const d = direction.value?.toUpperCase();
  if (d === "BULLISH") return "多頭偏強";
  if (d === "BEARISH") return "空頭偏弱";
  if (d === "NEUTRAL") return "中性觀望";
  return direction.value || "待分析";
});
const directionIcon = computed(() => {
  const d = direction.value?.toUpperCase();
  if (d === "BULLISH") return "chart";
  if (d === "BEARISH") return "chart";
  return "neutral";
});
const directionClass = computed(() => {
  const d = direction.value?.toUpperCase();
  if (d === "BULLISH") return "badge-bull";
  if (d === "BEARISH") return "badge-bear";
  return "badge-neutral";
});
</script>

<style scoped>
/* MacroBattleView — Phase 3 現代化（2026-11-17）
   只動 CSS：px→token、補 reduced-motion。
   移除死 selector（模板 0 引用）：inline-error / inline-hint / hint-sub /
   skeleton-wrap / sk / sk-title / sk-bar / sk-row / @keyframes shimmer。
   動態 class（directionClass → badge-bull/bear/neutral）保留。 */

.view-container {
  padding: var(--iln-space-4) var(--iln-space-4)
    calc(112px + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--iln-space-4);
}
.page-title {
  font-size: var(--iln-font-lg);
  font-weight: 700;
  color: var(--iln-text);
}
.page-date {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

/* ── Direction badge ── */
.direction-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--iln-space-5);
  flex-wrap: wrap;
}
.direction-badge {
  font-size: 13px;
  font-weight: 700;
  padding: var(--iln-space-1) 14px;
  border-radius: var(--iln-radius-lg);
  white-space: nowrap;
}
.badge-bull {
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
}
.badge-bear {
  background: var(--iln-danger-bg);
  color: var(--iln-danger-text);
}
.badge-neutral {
  background: var(--iln-warn-bg);
  color: var(--iln-warn-text);
}
.direction-hint {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  flex: 1;
  line-height: 1.4;
}

/* ── Section ── */
.section {
  margin-bottom: var(--iln-space-5);
}
.section-title {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--iln-hint);
  margin-bottom: 10px;
}

/* ── Score bars ── */
.score-wrap {
  display: flex;
  flex-direction: row;
  gap: 10px;
}
@media (max-width: 360px) {
  .score-wrap {
    flex-direction: column;
  }
}
.score-bar-row {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
}
.score-side {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  width: 36px;
  flex-shrink: 0;
}
.score-side--bull {
  color: var(--iln-ok-text);
}
.score-side--bear {
  color: var(--iln-danger-text);
}
.score-track {
  flex: 1;
  height: 10px;
  background: var(--iln-surface);
  border-radius: 5px;
  overflow: hidden;
}
.score-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.score-fill--bull {
  background: var(--iln-ok);
}
.score-fill--bear {
  background: var(--iln-danger);
}
.score-num {
  font-size: 13px;
  font-weight: 700;
  width: 24px;
  text-align: right;
  color: var(--iln-text);
  flex-shrink: 0;
}

/* ── Takeaway list ── */
.takeaway-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.takeaway-item {
  display: flex;
  align-items: flex-start;
  gap: var(--iln-space-2);
  font-size: 13px;
  color: var(--iln-text);
  line-height: 1.5;
  background: var(--iln-surface);
  border-radius: 10px;
  padding: 9px var(--iln-space-3);
}
.takeaway-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--iln-brand);
  flex-shrink: 0;
  margin-top: 5px;
}

/* ── Event cards ── */
.event-list {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}
.event-card {
  border-radius: 10px;
  padding: 10px var(--iln-space-3);
}
.event-card--bull {
  background: var(--iln-ok-bg);
}
.event-card--bear {
  background: var(--iln-danger-bg);
}
.event-card--neutral {
  background: var(--iln-surface);
}

.event-top {
  display: flex;
  align-items: flex-start;
  gap: var(--iln-space-2);
}
.event-score {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--iln-radius-md);
  flex-shrink: 0;
  color: var(--iln-ok-text);
  background: var(--iln-ok-bg);
}
.event-card--bear .event-score {
  color: var(--iln-danger-text);
  background: var(--iln-danger-bg);
}
.event-score.neutral {
  color: var(--iln-hint);
  background: transparent;
}
.event-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--iln-text);
  line-height: 1.4;
}
.event-analysis {
  font-size: 11px;
  color: var(--iln-hint);
  margin-top: 5px;
  line-height: 1.45;
  padding-left: 2px;
}

/* ── 尊重 reduced-motion ── */
@media (prefers-reduced-motion: reduce) {
  .score-fill {
    transition: none;
  }
}
</style>
