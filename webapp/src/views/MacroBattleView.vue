<template>
  <GlobalErrorBoundary>
    <div class="view-container iln-page">
      <div class="subview-meta">
        <span class="subview-heading">
          <Icon name="candlestick" size="sm" color="var(--iln-hint)" />
          <span>總經多空對決</span>
        </span>
        <span v-if="reportDate" class="page-date tabular">
          {{ formatDateTimeInTaipei(reportDate) }}
        </span>
      </div>

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
            <Icon :name="directionIcon" size="sm" :color="directionIconColor" />
            <span>{{ directionText }}</span>
          </span>
          <span v-if="macro.conclusion?.short_summary" class="direction-hint">
            {{ macro.conclusion.short_summary }}
          </span>
        </div>

        <!-- 多空積分長條 -->
        <section class="section" aria-label="多空積分">
          <h3 class="section-title">多空積分</h3>
          <div class="score-wrap">
            <!-- 多方 -->
            <div class="score-bar-row">
              <span class="score-side score-side--bull">
                <span>多</span>
                <Icon name="ok" size="sm" color="var(--iln-viz-bull)" />
              </span>
              <div class="score-track">
                <div
                  class="score-fill score-fill--bull"
                  :style="{ width: bullWidth + '%' }"
                ></div>
              </div>
              <span class="score-num tabular">{{ bullScore }}</span>
            </div>
            <!-- 空方 -->
            <div class="score-bar-row">
              <span class="score-side score-side--bear">
                <span>空</span>
                <Icon name="danger" size="sm" color="var(--iln-viz-bear)" />
              </span>
              <div class="score-track">
                <div
                  class="score-fill score-fill--bear"
                  :style="{ width: bearWidth + '%' }"
                ></div>
              </div>
              <span class="score-num tabular">{{ bearScore }}</span>
            </div>
          </div>
        </section>

        <!-- 社群情緒 -->
        <section class="section" aria-label="社群情緒">
          <SocialSentimentCard :sentiment="socialSentiment" />
        </section>

        <!-- Key Takeaways -->
        <section v-if="takeaways.length" class="section" aria-label="核心驅動邏輯">
          <h3 class="section-title">
            <Icon name="trending-up" size="sm" color="var(--iln-hint)" />
            <span>核心驅動邏輯</span>
          </h3>
          <ul class="takeaway-list">
            <li v-for="(item, i) in takeaways" :key="i" class="takeaway-item">
              <span class="takeaway-dot" aria-hidden="true"></span>
              <span>{{ item }}</span>
            </li>
          </ul>
        </section>

        <div class="iln-grid macro-events-grid">
          <!-- 多方事件 -->
          <section v-if="bullEvents.length" class="section" aria-label="多方事件">
            <h3 class="section-title">
              <Icon name="ok" size="sm" color="var(--iln-viz-bull)" />
              <span>多方事件（{{ bullEvents.length }}）</span>
            </h3>
            <div class="event-list">
              <div
                v-for="(e, i) in bullEvents"
                :key="i"
                class="event-card event-card--bull"
              >
                <div class="event-top">
                  <span class="event-score tabular">+{{ e.score }}</span>
                  <span class="event-title">{{ e.title ?? e.event ?? "(未命名)" }}</span>
                </div>
                <p v-if="e.analysis" class="event-analysis">{{ e.analysis }}</p>
              </div>
            </div>
          </section>

          <!-- 空方事件 -->
          <section v-if="bearEvents.length" class="section" aria-label="空方事件">
            <h3 class="section-title">
              <Icon name="danger" size="sm" color="var(--iln-viz-bear)" />
              <span>空方事件（{{ bearEvents.length }}）</span>
            </h3>
            <div class="event-list">
              <div
                v-for="(e, i) in bearEvents"
                :key="i"
                class="event-card event-card--bear"
              >
                <div class="event-top">
                  <span class="event-score tabular">-{{ e.score }}</span>
                  <span class="event-title">{{ e.title ?? e.event ?? "(未命名)" }}</span>
                </div>
                <p v-if="e.analysis" class="event-analysis">{{ e.analysis }}</p>
              </div>
            </div>
          </section>
        </div>

        <!-- 中性事件 -->
        <section v-if="neutralEvents.length" class="section" aria-label="觀望事件">
          <h3 class="section-title">
            <Icon name="minus" size="sm" color="var(--iln-hint)" />
            <span>觀望事件（{{ neutralEvents.length }}）</span>
          </h3>
          <div class="event-list">
            <div
              v-for="(e, i) in neutralEvents"
              :key="i"
              class="event-card event-card--neutral"
            >
              <div class="event-top">
                <span class="event-score neutral tabular">0</span>
                <span class="event-title">{{ e.title ?? e.event ?? "(未命名)" }}</span>
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
import { fetchReports, fetchSocialSentiment } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import SocialSentimentCard from "@/components/macro/SocialSentimentCard.vue";
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import { waitReady } from "../composables/useTelegram.js";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";

const loading = ref(true);
const error = ref(false);
const macro = ref(null);
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

  try {
    socialSentiment.value = await fetchSocialSentiment();
  } catch {
    socialSentiment.value = null;
  } finally {
    loading.value = false;
  }
});

const bullScore = computed(() => {
  const m = macro.value; if (!m) return 0;
  if (Number.isFinite(m.total_bull_score)) return m.total_bull_score;
  if (Number.isFinite(m.bullish)) return m.bullish;
  return (m.bull_events ?? []).reduce((s, e) => s + (Number(e?.score) || 0), 0);
});
const bearScore = computed(() => {
  const m = macro.value; if (!m) return 0;
  if (Number.isFinite(m.total_bear_score)) return m.total_bear_score;
  if (Number.isFinite(m.bearish)) return m.bearish;
  return (m.bear_events ?? []).reduce((s, e) => s + (Number(e?.score) || 0), 0);
});
const totalScore = computed(() => bullScore.value + bearScore.value || 1);
const bullWidth = computed(() =>
  Math.round((bullScore.value / totalScore.value) * 100),
);
const bearWidth = computed(() =>
  Math.round((bearScore.value / totalScore.value) * 100),
);

const bullEvents = computed(() => macro.value?.bull_events ?? []);
const bearEvents = computed(() => macro.value?.bear_events ?? []);
const neutralEvents = computed(() => macro.value?.neutral_events ?? []);
const takeaways = computed(() => macro.value?.conclusion?.key_takeaways ?? []);

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
  if (d === "BULLISH") return "trending-up";
  if (d === "BEARISH") return "trending-down";
  return "neutral";
});
const directionIconColor = computed(() => {
  const d = direction.value?.toUpperCase();
  if (d === "BULLISH") return "var(--iln-viz-bull)";
  if (d === "BEARISH") return "var(--iln-viz-bear)";
  return "var(--iln-hint)";
});
const directionClass = computed(() => {
  const d = direction.value?.toUpperCase();
  if (d === "BULLISH") return "badge-bull";
  if (d === "BEARISH") return "badge-bear";
  return "badge-neutral";
});
</script>

<style scoped>
.view-container {
  padding: 0 0 calc(var(--iln-space-4) + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.subview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-3);
}

.subview-heading {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-text);
}

.page-date {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  white-space: nowrap;
}

.direction-row {
  display: flex;
  align-items: center;
  gap: var(--iln-space-3);
  margin-bottom: var(--iln-space-5);
  flex-wrap: wrap;
}

.direction-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-sm);
  font-weight: 700;
  padding: var(--iln-space-1) var(--iln-space-3);
  border-radius: var(--iln-radius-full, 999px);
  white-space: nowrap;
}

.badge-bull {
  background: var(--iln-viz-bull-bg);
  color: var(--iln-viz-bull-text);
  border: 1px solid var(--iln-viz-bull-border);
}

.badge-bear {
  background: var(--iln-viz-bear-bg);
  color: var(--iln-viz-bear-text);
  border: 1px solid var(--iln-viz-bear-border);
}

.badge-neutral {
  background: var(--iln-viz-neutral-bg);
  color: var(--iln-viz-neutral-text);
  border: 1px solid var(--iln-border-subtle);
}

.direction-hint {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  flex: 1;
  min-width: 180px;
  line-height: 1.45;
}

.section {
  margin-bottom: var(--iln-space-5);
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-sm);
  font-weight: 700;
  letter-spacing: 0.4px;
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-3);
}

.score-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--iln-space-3);
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-lg);
  padding: var(--iln-space-4);
  box-shadow: var(--iln-shadow-1);
}

@media (min-width: 560px) {
  .score-wrap {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--iln-space-4);
  }
}

.score-bar-row {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  min-width: 0;
}

.score-side {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--iln-font-sm);
  font-weight: 700;
  min-width: 36px;
  flex-shrink: 0;
}

.score-side--bull {
  color: var(--iln-viz-bull-text);
}

.score-side--bear {
  color: var(--iln-viz-bear-text);
}

.score-track {
  flex: 1;
  min-width: 0;
  height: 10px;
  background: var(--iln-surface-alt, var(--iln-bg));
  border-radius: var(--iln-radius-full, 999px);
  overflow: hidden;
}

.score-fill {
  height: 100%;
  border-radius: var(--iln-radius-full, 999px);
  transition: width var(--iln-duration-slow, 300ms) var(--iln-ease-decelerate, ease-out);
}

.score-fill--bull {
  background: linear-gradient(90deg, var(--iln-viz-bull), var(--iln-viz-bull-light, var(--iln-viz-bull)));
}

.score-fill--bear {
  background: linear-gradient(90deg, var(--iln-viz-bear), var(--iln-viz-bear-light, var(--iln-viz-bear)));
}

.score-num {
  font-size: var(--iln-font-sm);
  font-weight: 800;
  min-width: 28px;
  text-align: right;
  color: var(--iln-text);
  flex-shrink: 0;
}

.takeaway-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}

.takeaway-item {
  display: flex;
  align-items: flex-start;
  gap: var(--iln-space-2);
  font-size: var(--iln-font-sm);
  color: var(--iln-text);
  line-height: 1.5;
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
}

.takeaway-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--iln-radius-full, 999px);
  background: var(--iln-brand);
  flex-shrink: 0;
  margin-top: 6px;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}

.event-card {
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
  border: 1px solid transparent;
}

.event-card--bull {
  background: var(--iln-viz-bull-bg);
  border-color: var(--iln-viz-bull-border, transparent);
}

.event-card--bear {
  background: var(--iln-viz-bear-bg);
  border-color: var(--iln-viz-bear-border, transparent);
}

.event-card--neutral {
  background: var(--iln-surface);
  border-color: var(--iln-border-subtle);
}

.event-top {
  display: flex;
  align-items: flex-start;
  gap: var(--iln-space-2);
}

.event-score {
  font-size: var(--iln-font-xs);
  font-weight: 800;
  padding: 2px var(--iln-space-2);
  border-radius: var(--iln-radius-sm);
  flex-shrink: 0;
  color: var(--iln-viz-bull-text);
  background: var(--iln-surface);
}

.event-card--bear .event-score {
  color: var(--iln-viz-bear-text);
  background: var(--iln-surface);
}

.event-score.neutral {
  color: var(--iln-hint);
  background: var(--iln-surface-alt, var(--iln-bg));
}

.event-title {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-text);
  line-height: 1.45;
}

.event-analysis {
  font-size: var(--iln-font-xs);
  color: var(--iln-text-muted, var(--iln-hint));
  margin-top: var(--iln-space-1);
  line-height: 1.5;
  padding-left: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .score-fill {
    transition: none;
  }
}

.macro-events-grid {
  gap: var(--iln-space-3);
}

@media (min-width: 768px) {
  .macro-events-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
