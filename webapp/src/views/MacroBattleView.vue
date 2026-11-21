<template>
  <div class="macro-panel">
    <div v-if="!macro.hasData" class="card empty-box">
      <div class="empty-title">尚無多空對決資料</div>
      <p class="muted">資料將於每日分析完成後更新。</p>
    </div>

    <template v-else>
      <!-- 方向與摘要 -->
      <section class="card" aria-label="市場方向結論">
        <div class="dir-row">
          <span class="dir-badge" :class="`dir-${macro.directionTone}`">
            {{ macro.directionLabel }}
          </span>
          <span v-if="reportDate" class="date-tag tabular">
            {{ formatDateTimeInTaipei(reportDate) }}
          </span>
        </div>
        <p v-if="macro.shortSummary" class="summary-text">
          {{ macro.shortSummary }}
        </p>
      </section>

      <!-- 多空積分 -->
      <section class="card" aria-label="多空積分">
        <div class="card-label">多空積分</div>
        <div class="score-grid tabular">
          <div class="score-box">
            <div class="score-head">
              <span class="bull-text">多方積分</span>
              <strong>{{ macro.bullScore }}</strong>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill bar-fill--bull"
                :style="{ width: `${macro.bullWidth}%` }"
              ></div>
            </div>
          </div>

          <div class="score-box">
            <div class="score-head">
              <span class="bear-text">空方積分</span>
              <strong>{{ macro.bearScore }}</strong>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill bar-fill--bear"
                :style="{ width: `${macro.bearWidth}%` }"
              ></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 核心驅動邏輯 -->
      <section v-if="macro.takeaways.length" class="card" aria-label="核心驅動邏輯">
        <div class="card-label">核心驅動邏輯</div>
        <ul class="takeaway-list">
          <li v-for="(t, i) in macro.takeaways" :key="i">{{ t }}</li>
        </ul>
      </section>

      <!-- 多方 / 空方事件 -->
      <div
        v-if="macro.bullEvents.length || macro.bearEvents.length"
        class="events-2col"
      >
        <section v-if="macro.bullEvents.length" class="card" aria-label="多方事件">
          <div class="card-label bull-text">
            多方事件（{{ macro.bullEvents.length }}）
          </div>
          <div class="event-stack">
            <div
              v-for="ev in macro.bullEvents"
              :key="`bull-${ev.id}`"
              class="ev-item ev-item--bull"
            >
              <div class="ev-top">
                <span class="ev-score tabular">+{{ ev.score }}</span>
                <span class="ev-title">{{ ev.title }}</span>
              </div>
              <p v-if="ev.analysis" class="ev-desc">{{ ev.analysis }}</p>
            </div>
          </div>
        </section>

        <section v-if="macro.bearEvents.length" class="card" aria-label="空方事件">
          <div class="card-label bear-text">
            空方事件（{{ macro.bearEvents.length }}）
          </div>
          <div class="event-stack">
            <div
              v-for="ev in macro.bearEvents"
              :key="`bear-${ev.id}`"
              class="ev-item ev-item--bear"
            >
              <div class="ev-top">
                <span class="ev-score tabular">-{{ ev.score }}</span>
                <span class="ev-title">{{ ev.title }}</span>
              </div>
              <p v-if="ev.analysis" class="ev-desc">{{ ev.analysis }}</p>
            </div>
          </div>
        </section>
      </div>

      <!-- 觀望 / 中性事件 -->
      <section v-if="macro.neutralEvents.length" class="card" aria-label="觀望事件">
        <div class="card-label">觀望事件（{{ macro.neutralEvents.length }}）</div>
        <div class="event-stack">
          <div
            v-for="ev in macro.neutralEvents"
            :key="`neu-${ev.id}`"
            class="ev-item ev-item--neutral"
          >
            <div class="ev-top">
              <span class="ev-score tabular">0</span>
              <span class="ev-title">{{ ev.title }}</span>
            </div>
            <p v-if="ev.analysis" class="ev-desc">{{ ev.analysis }}</p>
          </div>
        </div>
      </section>

      <!-- 社群情緒（結構化卡片與列表呈現，不以 JSON 原始碼輸出） -->
      <section class="card" aria-label="社群情緒">
        <div class="sentiment-header">
          <span class="card-label">社群情緒</span>
          <span
            v-if="macro.socialSentimentModel"
            class="sentiment-chip"
            :class="`chip-${macro.socialSentimentModel.tone}`"
          >
            {{ macro.socialSentimentModel.badgeText }}
          </span>
        </div>

        <template v-if="macro.socialSentimentModel">
          <div v-if="macro.socialSentimentModel.headline" class="sentiment-headline">
            {{ macro.socialSentimentModel.headline }}
          </div>
          <p v-if="macro.socialSentimentModel.summary" class="summary-text">
            {{ macro.socialSentimentModel.summary }}
          </p>

          <div v-if="macro.socialSentimentModel.stats.length" class="sentiment-stats tabular">
            <div
              v-for="(st, idx) in macro.socialSentimentModel.stats"
              :key="`st-${idx}`"
              class="sentiment-stat-cell"
            >
              <span class="stat-k">{{ st.label }}</span>
              <span class="stat-v">{{ st.value }}</span>
            </div>
          </div>

          <ul v-if="macro.socialSentimentModel.highlights.length" class="takeaway-list">
            <li v-for="(h, idx) in macro.socialSentimentModel.highlights" :key="`hl-${idx}`">
              {{ h }}
            </li>
          </ul>

          <div v-if="macro.socialSentimentModel.rows.length" class="sentiment-rows tabular">
            <div
              v-for="row in macro.socialSentimentModel.rows"
              :key="row.key"
              class="sentiment-row"
            >
              <span class="s-row-k">{{ row.label }}</span>
              <span class="s-row-v" :class="`tone-${row.tone}`">{{ row.value }}</span>
            </div>
          </div>
        </template>
        <p v-else class="muted">目前尚無社群情緒資料。</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";

defineProps({
  macro: { type: Object, required: true },
  reportDate: { type: String, default: "" },
});
</script>

<style scoped>
.macro-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--iln-text, #e5e7eb);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.card {
  background: var(--iln-surface, #161b22);
  color: var(--iln-text, #e5e7eb);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-box {
  gap: 4px;
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--iln-text, #f3f4f6);
}

.dir-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dir-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
}

.dir-bull,
.chip-bull {
  background: var(--iln-viz-bull-bg, rgba(22, 163, 74, 0.18));
  color: var(--iln-viz-bull-text, #4ade80);
  border: 1px solid var(--iln-viz-bull-border, rgba(74, 222, 128, 0.35));
}

.dir-bear,
.chip-bear {
  background: var(--iln-viz-bear-bg, rgba(220, 38, 38, 0.18));
  color: var(--iln-viz-bear-text, #f87171);
  border: 1px solid var(--iln-viz-bear-border, rgba(248, 113, 113, 0.35));
}

.dir-neutral,
.chip-neutral {
  background: var(--iln-surface-alt, #1f2937);
  color: var(--iln-text, #e5e7eb);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.14));
}

.date-tag {
  font-size: 12px;
  color: var(--iln-hint, #9ca3af);
}

.summary-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--iln-text, #e5e7eb);
}

.card-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-hint, #9ca3af);
}

.bull-text,
.tone-bull {
  color: var(--iln-viz-bull-text, #4ade80);
}

.bear-text,
.tone-bear {
  color: var(--iln-viz-bear-text, #f87171);
}

.tone-neutral {
  color: var(--iln-text, #e5e7eb);
}

.score-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 560px) {
  .score-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.score-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.score-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--iln-text, #f3f4f6);
}

.bar-track {
  height: 8px;
  border-radius: 999px;
  background: var(--iln-surface-alt, #263040);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
}

.bar-fill--bull {
  background: #16a34a;
}

.bar-fill--bear {
  background: #dc2626;
}

.takeaway-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--iln-text, #e5e7eb);
}

.events-2col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 720px) {
  .events-2col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.event-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ev-item {
  border-radius: 10px;
  padding: 10px 12px;
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
}

.ev-item--bull {
  background: var(--iln-viz-bull-bg, rgba(22, 163, 74, 0.14));
  border-color: var(--iln-viz-bull-border, rgba(74, 222, 128, 0.3));
}

.ev-item--bear {
  background: var(--iln-viz-bear-bg, rgba(220, 38, 38, 0.14));
  border-color: var(--iln-viz-bear-border, rgba(248, 113, 113, 0.3));
}

.ev-item--neutral {
  background: var(--iln-surface-alt, #1c222b);
}

.ev-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ev-score {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--iln-surface, #11161d);
  color: var(--iln-text, #f9fafb);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
  flex-shrink: 0;
}

.ev-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--iln-text, #f3f4f6);
}

.ev-desc {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--iln-hint, #cbd5e1);
}

.sentiment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sentiment-chip {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
}

.sentiment-headline {
  font-size: 15px;
  font-weight: 700;
  color: var(--iln-text, #f9fafb);
}

.sentiment-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

@media (min-width: 560px) {
  .sentiment-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.sentiment-stat-cell {
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--iln-surface-alt, #1c222b);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-k {
  font-size: 11px;
  color: var(--iln-hint, #9ca3af);
}

.stat-v {
  font-size: 14px;
  font-weight: 800;
  color: var(--iln-text, #f9fafb);
}

.sentiment-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.1));
  padding-top: 8px;
}

.sentiment-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.s-row-k {
  color: var(--iln-hint, #9ca3af);
  flex-shrink: 0;
}

.s-row-v {
  font-weight: 600;
  text-align: right;
  word-break: break-word;
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--iln-hint, #9ca3af);
}
</style>
