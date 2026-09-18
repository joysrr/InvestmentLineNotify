<template>
  <section
    v-if="sentiment"
    class="sentiment-section"
    data-testid="social-sentiment-card"
  >
    <h3 class="section-title">🗣️ 社群情緒觀察</h3>

    <!-- Sentiment Score + MA -->
    <div class="sentiment-row">
      <div class="sentiment-score-badge">
        <span class="score-value">{{ sentiment.score }}</span>
        <span class="score-label">{{ scoreLabel }}</span>
      </div>
      <div class="ma-indicators">
        <span class="ma-item">
          <span class="ma-label">3D</span>
          <span class="ma-value">{{ sentiment.ma3 }}</span>
        </span>
        <span class="ma-item">
          <span class="ma-label">7D</span>
          <span class="ma-value">{{ sentiment.ma7 }}</span>
        </span>
        <span class="ma-item">
          <span class="ma-label">Δ</span>
          <span class="ma-value">{{ deltaText }}</span>
        </span>
      </div>
    </div>

    <div class="sentiment-meta" data-testid="sentiment-metadata">
      <span>更新時間：{{ updatedAtText }}</span>
      <span>樣本：{{ sampleCount }} 筆（PTT {{ pttItems }}、Bluesky {{ bskyItems }}）</span>
      <span>趨勢：{{ trendText }}</span>
    </div>

    <button
      type="button"
      class="evidence-trigger"
      data-testid="sentiment-evidence-trigger"
      @click="isEvidenceOpen = true"
    >
      查看判斷依據
    </button>

    <!-- Divergence + signals -->
    <div class="sentiment-row">
      <span
        class="sentiment-divergence"
        :class="divergenceClass"
      >{{ divergenceText }}</span>
      <div v-if="sentiment.signals?.length" class="sentiment-signals">
        <span
          v-for="(s, i) in sentiment.signals"
          :key="i"
          class="signal-tag"
        >{{ signalLabel(s) }}</span>
      </div>
    </div>

    <!-- Hot topics -->
    <div v-if="sentiment.hotTopics?.length" class="hot-topics">
      <div
        v-for="(topic, i) in sentiment.hotTopics"
        :key="i"
        class="hot-topic"
      >
        <span class="hot-topic-source">{{ topic.source }}</span>
        <a
          v-if="topic.url"
          :href="topic.url"
          class="hot-topic-link"
          target="_blank"
          rel="noopener noreferrer"
        >{{ topic.title }}</a>
        <span v-else class="hot-topic-text">{{ topic.title }}</span>
        <span
          class="hot-topic-bias"
          :class="`bias-${(topic.sentiment || 'NEUTRAL').toLowerCase()}`"
        >{{ topic.sentiment === 'BULL' ? '🟢' : topic.sentiment === 'BEAR' ? '🔴' : '⚪' }}</span>
      </div>
    </div>

    <div
      v-if="isEvidenceOpen"
      class="evidence-sheet"
      data-testid="sentiment-evidence-sheet"
      role="dialog"
      aria-modal="true"
    >
      <div class="evidence-sheet__backdrop" @click="isEvidenceOpen = false"></div>
      <div class="evidence-sheet__content">
        <div class="evidence-sheet__header">
          <h4>本次判斷依據</h4>
          <button type="button" class="evidence-close" @click="isEvidenceOpen = false">關閉</button>
        </div>
        <dl class="evidence-list">
          <div><dt>情緒判定</dt><dd>{{ sentiment.score }} 分・{{ scoreLabel }}</dd></div>
          <div><dt>均線趨勢</dt><dd>3D {{ sentiment.ma3 }} / 7D {{ sentiment.ma7 }}・{{ trendText }}（Δ {{ deltaText }}）</dd></div>
          <div><dt>資料樣本</dt><dd>{{ sampleCount }} 筆・PTT {{ pttItems }}・Bluesky {{ bskyItems }}</dd></div>
          <div><dt>背離檢查</dt><dd>{{ sentiment.divergenceDetail || divergenceText }}</dd></div>
        </dl>
      </div>
    </div>
  </section>

  <!-- Fallback -->
  <div v-else class="sentiment-fallback">
    <span class="hint">📭 社群情緒資料準備中，請稍後</span>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  sentiment: {
    type: Object,
    default: null,
  },
});

defineOptions({
  name: "SocialSentimentCard",
});

const isEvidenceOpen = ref(false);
const scoreLabel = computed(() => props.sentiment?.scoreLabel || "中性");
const trendText = computed(() => props.sentiment?.trend || "穩定");
const sampleCount = computed(() => props.sentiment?.sampleCount ?? 0);
const pttItems = computed(() => props.sentiment?.pttItems ?? 0);
const bskyItems = computed(() => props.sentiment?.bskyItems ?? 0);
const updatedAtText = computed(() => {
  if (!props.sentiment?.updatedAt) return "尚無更新時間";
  return new Date(props.sentiment.updatedAt).toLocaleString("zh-TW", {
    hour12: false,
  });
});

const deltaText = computed(() => {
  if (!props.sentiment) return "—";
  const delta = props.sentiment.ma3 - props.sentiment.ma7;
  return delta >= 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`;
});

const divergenceClass = computed(() => {
  if (!props.sentiment) return "";
  switch (props.sentiment.divergenceStatus) {
    case "BEARISH_DIVERGENCE":
      return "divergence-bearish";
    case "BULLISH_DIVERGENCE":
      return "divergence-bullish";
    case "NONE":
    default:
      return "divergence-normal";
  }
});

const divergenceText = computed(() => {
  if (!props.sentiment) return "";
  switch (props.sentiment.divergenceStatus) {
    case "BEARISH_DIVERGENCE":
      return "散戶過熱背離";
    case "BULLISH_DIVERGENCE":
      return "逆行買入背離";
    case "NONE":
    default:
      return "正常";
  }
});

function signalLabel(s) {
  const labels = {
    GOLDEN_CROSS: "黃金交叉",
    DEATH_CROSS: "死亡交叉",
    HIGH_TO_COLD: "情緒轉冰",
    HIGH_VOLATILITY: "情緒振荡",
  };
  return labels[s] ?? s;
}
</script>

<style scoped>
.sentiment-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 10px;
}

.sentiment-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.sentiment-score-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
  border-radius: 10px;
  padding: 6px 12px;
}

.score-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}

.score-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}

.sentiment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin: 2px 0 8px;
  font-size: 10px;
  color: var(--tg-theme-hint-color, #999);
}

.evidence-trigger {
  border: 0;
  padding: 0;
  margin: 0 0 8px;
  background: transparent;
  color: var(--tg-theme-link-color, #2481cc);
  font-size: 11px;
  cursor: pointer;
}

.ma-indicators {
  display: flex;
  gap: 10px;
  flex: 1;
}

.ma-item {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 12px;
}

.ma-label {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #999);
}

.ma-value {
  font-weight: 600;
  color: var(--tg-theme-text-color, #333);
}

.sentiment-divergence {
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 12px;
  white-space: nowrap;
}

.divergence-normal {
  background: rgba(38, 161, 123, 0.15);
  color: #26a17b;
}

.divergence-bearish {
  background: rgba(245, 152, 32, 0.15);
  color: #b8860b;
}

.divergence-bullish {
  background: rgba(38, 161, 123, 0.15);
  color: #26a17b;
}

.sentiment-signals {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
}

.signal-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--tg-theme-secondary-bg-color, #eee);
  color: var(--tg-theme-hint-color, #999);
}

.hot-topics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.hot-topic {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  padding: 9px 12px;
}

.hot-topic-source {
  font-weight: 600;
  font-size: 10px;
  color: var(--tg-theme-hint-color, #999);
  text-transform: uppercase;
  white-space: nowrap;
}

.hot-topic-link,
.hot-topic-text {
  flex: 1;
  color: var(--tg-theme-text-color, #333);
  text-decoration: none;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-sheet {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.evidence-sheet__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.evidence-sheet__content {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  max-height: 78vh;
  overflow-y: auto;
  padding: 18px 16px 24px;
  border-radius: 18px 18px 0 0;
  background: var(--tg-theme-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
}

.evidence-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.evidence-sheet__header h4 {
  margin: 0;
  font-size: 16px;
}

.evidence-close {
  border: 0;
  background: transparent;
  color: var(--tg-theme-link-color, #2481cc);
  cursor: pointer;
}

.evidence-list {
  display: grid;
  gap: 12px;
  margin: 0;
}

.evidence-list > div {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 10px;
}

.evidence-list dt {
  color: var(--tg-theme-hint-color, #999);
  font-size: 11px;
}

.evidence-list dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
}

.hot-topic-bias {
  font-size: 14px;
}

.sentiment-fallback {
  padding: 12px;
  text-align: center;
}

.hint {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}
</style>
