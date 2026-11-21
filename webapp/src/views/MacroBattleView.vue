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

      <!-- 社群情緒（永遠保留區塊，無資料時提供明確回饋） -->
      <section class="card" aria-label="社群情緒">
        <div class="card-label">社群情緒</div>
        <template v-if="macro.socialSentiment">
          <pre class="json-pre">{{ formatSentiment(macro.socialSentiment) }}</pre>
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

function formatSentiment(val) {
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}
</script>

<style scoped>
.macro-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.card {
  background: var(--iln-surface, #ffffff);
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
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

.dir-bull {
  background: #dcfce7;
  color: #166534;
}

.dir-bear {
  background: #fee2e2;
  color: #991b1b;
}

.dir-neutral {
  background: var(--iln-surface-alt, #f3f4f6);
  color: var(--iln-text, #374151);
}

.date-tag {
  font-size: 12px;
  color: var(--iln-hint, #6b7280);
}

.summary-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.card-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-hint, #4b5563);
}

.bull-text {
  color: #15803d;
}

.bear-text {
  color: #b91c1c;
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
}

.bar-track {
  height: 8px;
  border-radius: 999px;
  background: var(--iln-surface-alt, #e5e7eb);
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
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
}

.ev-item--bull {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.ev-item--bear {
  background: #fef2f2;
  border-color: #fecaca;
}

.ev-item--neutral {
  background: var(--iln-surface-alt, #f9fafb);
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
  background: var(--iln-surface, #ffffff);
  flex-shrink: 0;
}

.ev-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.ev-desc {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--iln-hint, #4b5563);
}

.json-pre {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  background: var(--iln-surface-alt, #f3f4f6);
  font-size: 11px;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--iln-hint, #6b7280);
}
</style>
