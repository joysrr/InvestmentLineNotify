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
        {{ ageBandLabel(article.age_band) }}
      </span>
      <span class="news-region">
        <Icon :name="regionFlag(article._region || 'tw')" size="sm" />
      </span>
      <span class="news-source">{{ article.source }}</span>
      <span class="news-time">{{ formatDate(article.pubDate) }}</span>
      <span v-if="isFeatured" class="news-badge featured">精選</span>
    </div>
    <p class="news-title">{{ article.title }}</p>
    <span v-if="isPicked" class="news-tag picked">已入選精選</span>
    <p v-if="article.summary" class="news-summary">{{ article.summary }}</p>
  </div>
</template>

<script setup>
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

const emit = defineEmits(["article-click"]);

const TW_SOURCE_KEYWORDS = ["鉅亨網", "ETtoday", "自由財經", "蘋果日報", "商業週刊", "今周刊"];

function isTaiwanMarket(source) {
  if (!source) return false;
  return TW_SOURCE_KEYWORDS.some((kw) => String(source).includes(kw));
}

function formatDate(pubDate) {
  if (!pubDate) return "—";
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return pubDate;
  }
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
.news-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--iln-neutral-fill-border-faint);
  border-radius: 12px;
  background: var(--iln-neutral-fill-faint);
  cursor: pointer;
  transition: background 0.2s;
}

.news-card:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.news-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--iln-hint);
}

.news-age {
  display: flex;
  align-items: center;
  gap: 4px;
}

.news-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--iln-text);
  line-height: 1.4;
  margin: 0;
}

.news-summary {
  font-size: 13px;
  color: var(--iln-hint);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 4px 0 0 0;
}

.age-fresh {
  color: var(--iln-danger-text);
}

.age-recent {
  color: var(--iln-warn-text);
}

.age-old {
  color: var(--iln-hint);
}
</style>
