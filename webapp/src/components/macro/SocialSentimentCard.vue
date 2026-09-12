<template>
  <section
    v-if="sentiment"
    class="sentiment-section"
    data-testid="social-sentiment-card"
  >
    <h3 class="section-title">🗣️ 社群多空情緒</h3>

    <!-- Sentiment Score + MA -->
    <div class="sentiment-row">
      <div class="sentiment-score-badge">
        <span class="score-value">{{ sentiment.score }}</span>
        <span class="score-label">情緒分</span>
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
          :href="topic.url"
          class="hot-topic-link"
          target="_blank"
          rel="noopener noreferrer"
        >{{ topic.title }}</a>
        <span
          class="hot-topic-bias"
          :class="`bias-${(topic.sentiment || 'NEUTRAL').toLowerCase()}`"
        >{{ topic.sentiment === 'BULL' ? '🟢' : topic.sentiment === 'BEAR' ? '🔴' : '⚪' }}</span>
      </div>
    </div>
  </section>

  <!-- Fallback -->
  <div v-else class="sentiment-fallback">
    <span class="hint">📭 社群情緒資料準備中，請稍後</span>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  sentiment: {
    type: Object,
    default: null,
  },
});

defineOptions({
  name: "SocialSentimentCard",
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

.hot-topic-link {
  flex: 1;
  color: var(--tg-theme-text-color, #333);
  text-decoration: none;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
