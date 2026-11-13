<template>
  <ContentCard variant="outlined" padding="lg" radius="lg">
    <div v-if="loading" class="hero-card skeleton-card">
      <div class="sk sk-title"></div>
      <div class="sk sk-label" style="margin-top: 12px"></div>
      <div class="sk sk-value" style="width: 60%"></div>
    </div>
    <div v-else-if="error" class="inline-error"><Icon name="danger" size="sm" color="var(--iln-danger)" /> 報告載入失敗</div>
    <div v-else-if="!report" class="inline-hint"><Icon name="default" size="sm" color="var(--iln-hint)" /> 尚無報告資料</div>
    <div v-else class="hero-card">
      <div class="hero-top">
        <span class="hero-date">{{ report.date }}</span>
        <span class="priority-tag" v-if="activePriority">{{
          activePriority
        }}</span>
      </div>
      <div class="hero-main">
        <div class="hero-target" :class="targetClass">
          {{ report.signals?.target ?? "—" }}
        </div>
        <div class="hero-suggestion">
          {{ report.signals?.suggestion || "分析中..." }}
        </div>
        <div class="hero-badges">
          <span class="badge" :class="pctClass">{{ pctText }}</span>
          <span class="badge badge-score"
            >評分 {{ report.signals?.score ?? "—" }}</span
          >
        </div>
      </div>
      <div class="hero-route border-top">
        <div class="hero-route-main">
          <span class="route-label">核心路由：</span>
          <span class="route-path">{{ routingPath || "—" }}</span>
        </div>
        <router-link v-if="showTrendLink" to="/chart" class="hero-trend-link">
          <Icon name="chart" size="sm" color="var(--iln-text)" /> 資產趨勢 →
        </router-link>
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  report: Object,
  loading: Boolean,
  error: Boolean,
  activePriority: String,
  targetClass: String,
  pctClass: String,
  pctText: String,
  routingPath: String,
  showTrendLink: {
    type: Boolean,
    default: true,
  },
});
</script>

<style scoped>
.hero-card {
  /* 佈局由 ContentCard 提供，此處僅保留必要的自定義樣式 */
}
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 20px;
}
.hero-date {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}
.hero-target {
  font-size: var(--iln-font-base);
  color: var(--iln-text);
  margin-bottom: 20px;
  line-height: 1.5;
}
.target-buy {
  color: var(--iln-ok-text);
}
.target-sell {
  color: var(--iln-danger-text);
}
.target-wait {
  color: var(--iln-warn-text);
}
.hero-suggestion {
  font-size: var(--iln-font-xl);
  color: var(--iln-text);
  margin-bottom: 20px;
  line-height: 1.5;
}
.hero-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.hero-route {
  border-top: 1px solid var(--iln-surface);
  padding-top: 16px;
  gap: 8px;
}
.hero-route-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hero-trend-link {
  font-size: var(--iln-font-xs);
  color: var(--iln-brand);
}
.hero-trend-link:active {
  opacity: 0.8;
}
.route-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.route-path {
  font-size: var(--iln-font-sm);
  color: var(--iln-text);
}
.badge {
  font-size: var(--iln-font-xs);
  color: var(--iln-brand);
  padding: 4px 8px;
  border-radius: var(--iln-radius-sm);
  transition: background 0.15s ease;
  background: var(--iln-surface);
}
.badge-danger {
  background: var(--iln-danger-bg);
  color: var(--iln-danger-text);
}
.badge-warn {
  background: var(--iln-warn-bg);
  color: var(--iln-warn-text);
}
.badge-ok {
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
}
.badge-score {
  font-size: var(--iln-font-xs);
  color: var(--iln-text);
  padding: 4px 10px;
  border-radius: var(--iln-radius-md);
  background: var(--iln-surface);
}
</style>