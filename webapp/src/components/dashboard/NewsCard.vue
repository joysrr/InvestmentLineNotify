<template>
  <div
    class="news-card"
    role="button"
    tabindex="0"
    @click="$emit('article-click', article)"
    @keydown.enter="$emit('article-click', article)"
  >
    <div class="news-header">
      <span v-if="showAgeBand" class="news-age" :class="ageBandClass(article.age_band)">
        <Icon :name="ageBandIcon(article.age_band)" size="sm" />
        <span>{{ ageBandLabel(article.age_band) }}</span>
      </span>
      <span class="news-region">
        <Icon :name="regionFlag(article._region || 'tw')" size="sm" />
      </span>
      <span class="news-source">{{ article.source }}</span>
      <span class="news-time tabular">{{ formatDate(article.pubDate) }}</span>
      <span v-if="isFeatured" class="news-badge featured">精選</span>
    </div>
    <p class="news-title">{{ article.title }}</p>
    <span v-if="isPicked" class="news-tag picked">已入選精選</span>
    <p v-if="article.summary" class="news-summary">{{ article.summary }}</p>
  </div>
</template>

<script setup>
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  article: {
    type: Object,
    required: true,
  },
  showAgeBand: {
    type: Boolean,
    default: false,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isPicked: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["article-click"]);

const TW_SOURCE_KEYWORDS = ["鉅亨網", "ETtoday", "自由財經", "蘋果日報", "商業週刊", "今周刊"];

function isTaiwanMarket(source) {
  if (!source) return false;
  return TW_SOURCE_KEYWORDS.some((kw) => String(source).includes(kw));
}

function formatDate(pubDate) {
  return formatDateTimeInTaipei(pubDate);
}

function ageBandClass(band) {
  if (band === "fresh") return "age-fresh";
  if (band === "recent") return "age-recent";
  return "age-old";
}

function ageBandIcon(band) {
  if (band === "fresh") return "danger";
  if (band === "recent") return "warn";
  return "neutral";
}

function ageBandLabel(band) {
  if (band === "fresh") return "最新";
  if (band === "recent") return "近期";
  return "舊聞";
}

function regionFlag(region) {
  return isTaiwanMarket(region) ? "news" : "neutral";
}
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.news-card {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
  padding: var(--iln-space-3) var(--iln-space-4);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  background: var(--iln-surface);
  cursor: pointer;
  transition:
    border-color var(--iln-duration-fast) var(--iln-ease-standard),
    background-color var(--iln-duration-fast) var(--iln-ease-standard);
}

.news-card:hover {
  border-color: var(--iln-brand);
}

.news-card:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.news-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--iln-space-2);
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.news-age {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
}

.news-title {
  font-size: var(--iln-font-md);
  font-weight: 600;
  color: var(--iln-text);
  line-height: 1.4;
  margin: 0;
}

.news-summary {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: var(--iln-space-1) 0 0;
}

.age-fresh {
  color: var(--iln-viz-bear-text);
}

.age-recent {
  color: var(--iln-viz-alert-text);
}

.age-old {
  color: var(--iln-hint);
}

.news-region {
  display: inline-flex;
  align-items: center;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-right: var(--iln-space-1);
}

.news-source {
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-medium);
  color: var(--iln-text);
}

.news-time {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.news-badge {
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-medium);
  padding: 2px var(--iln-space-2);
  border-radius: var(--iln-radius-sm);
  background: var(--iln-brand-soft);
  color: var(--iln-brand);
}

.featured {
  background: var(--iln-viz-alert-bg);
  color: var(--iln-viz-alert-text);
}

.news-tag {
  align-self: flex-start;
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-medium);
  padding: 2px var(--iln-space-2);
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface-alt);
  color: var(--iln-text);
}

.picked {
  background: var(--iln-viz-bull-bg);
  color: var(--iln-viz-bull-text);
}

@media (prefers-reduced-motion: reduce) {
  .news-card {
    transition: none;
  }
}
</style>
