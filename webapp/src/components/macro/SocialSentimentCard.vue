<template>
  <ContentCard variant="outlined" padding="md" radius="lg">
    <section
      v-if="sentiment"
      class="sentiment-section"
      data-testid="social-sentiment-card"
    >
    <h3 class="section-title"><Icon name="default" size="sm" color="var(--iln-hint)" /> 社群情緒觀察</h3>

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
      <span
        >樣本：{{ sampleCount }} 筆（PTT {{ pttItems }}、Bluesky
        {{ bskyItems }}）</span
      >
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
      <span class="sentiment-divergence" :class="divergenceClass">{{
        divergenceText
      }}</span>
      <div v-if="sentiment.signals?.length" class="sentiment-signals">
        <span v-for="(s, i) in sentiment.signals" :key="i" class="signal-tag">{{
          signalLabel(s)
        }}</span>
      </div>
    </div>

    <!-- Hot topics -->
    <div v-if="sentiment.hotTopics?.length" class="hot-topics">
      <div v-for="(topic, i) in sentiment.hotTopics" :key="i" class="hot-topic">
        <span class="hot-topic-source">{{ topic.source }}</span>
        <a
          v-if="topic.url"
          :href="topic.url"
          class="hot-topic-link"
          target="_blank"
          rel="noopener noreferrer"
          >{{ topic.title }}</a
        >
        <span v-else class="hot-topic-text">{{ topic.title }}</span>
        <span
          class="hot-topic-bias"
          :class="`bias-${(topic.sentiment || 'NEUTRAL').toLowerCase()}`"
          ><Icon
              v-if="topic.sentiment === 'BULL'"
              name="ok"
              size="sm"
              color="var(--iln-ok)"
            />
            <Icon
              v-else-if="topic.sentiment === 'BEAR'"
              name="danger"
              size="sm"
              color="var(--iln-danger)"
            />
            <Icon
              v-else
              name="neutral"
              size="sm"
              color="var(--iln-hint)"
            /></span
        >
      </div>
    </div>

    <div
      v-if="isEvidenceOpen"
      class="evidence-sheet"
      data-testid="sentiment-evidence-sheet"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="evidence-sheet__backdrop"
        @click="isEvidenceOpen = false"
      ></div>
      <div
        class="evidence-sheet__content evidence-sheet__content--nav-safe"
        data-nav-safe-area="true"
      >
        <div class="evidence-sheet__header">
          <h4>本次判斷依據</h4>
          <button
            type="button"
            class="evidence-close"
            @click="isEvidenceOpen = false"
          >
            關閉
          </button>
        </div>
        <dl class="evidence-list">
          <div>
            <dt>情緒判定</dt>
            <dd>{{ sentiment.score }} 分・{{ scoreLabel }}</dd>
          </div>
          <div>
            <dt>均線趨勢</dt>
            <dd>
              3D {{ sentiment.ma3 }} / 7D {{ sentiment.ma7 }}・{{
                trendText
              }}（Δ {{ deltaText }}）
            </dd>
          </div>
          <div>
            <dt>資料樣本</dt>
            <dd>
              {{ sampleCount }} 筆・PTT {{ pttItems }}・Bluesky {{ bskyItems }}
            </dd>
          </div>
          <div>
            <dt>背離檢查</dt>
            <dd>{{ sentiment.divergenceDetail || divergenceText }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>

  <!-- Fallback -->
  <div v-else class="sentiment-fallback">
    <span class="hint"><Icon name="default" size="sm" color="var(--iln-hint)" /> 社群情緒資料準備中，請稍後</span>
  </div>
  </ContentCard>
</template>

<script setup>
import { computed, ref } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

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
}

.section-title {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--iln-hint);
}

.sentiment-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sentiment-score-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
}

.score-value {
  font-size: var(--iln-font-lg);
  font-weight: 700;
  color: var(--iln-text);
}

.score-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.sentiment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.evidence-trigger {
  border: 0;
  padding: 0;
  margin: 0 0 8px;
  background: transparent;
  color: var(--iln-link);
  font-size: var(--iln-font-xs);
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
  font-size: var(--iln-font-sm);
}

.ma-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.ma-value {
  font-weight: 600;
  color: var(--iln-text);
}

.sentiment-divergence {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  padding: 5px 12px;
  border-radius: var(--iln-radius-md);
  white-space: nowrap;
}

.divergence-normal {
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
}

.divergence-bearish {
  background: var(--iln-warn-bg);
  color: var(--iln-warn-text);
}

.divergence-bullish {
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
}

.sentiment-signals {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
}

.signal-tag {
  font-size: var(--iln-font-xs);
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface);
  color: var(--iln-hint);
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
  font-size: var(--iln-font-sm);
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
}

.hot-topic-source {
  font-weight: 600;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-transform: uppercase;
  white-space: nowrap;
}

.hot-topic-link,
.hot-topic-text {
  flex: 1;
  color: var(--iln-text);
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
  border-radius: var(--iln-radius-lg) var(--iln-radius-lg) 0 0;
  background: var(--iln-bg);
  color: var(--iln-text);
}

.evidence-sheet__content--nav-safe {
  padding-bottom: calc(24px + 88px + env(safe-area-inset-bottom, 0px));
  scroll-padding-bottom: calc(24px + 88px + env(safe-area-inset-bottom, 0px));
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
  color: var(--iln-link);
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
  color: var(--iln-hint);
  font-size: var(--iln-font-xs);
}

.evidence-list dd {
  margin: 0;
  font-size: var(--iln-font-sm);
  line-height: 1.45;
}

.hot-topic-bias {
  font-size: var(--iln-font-base);
}

.sentiment-fallback {
  text-align: center;
}
</style>
