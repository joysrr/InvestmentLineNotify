<template>
  <div class="soh-root">
    <!-- Loading skeleton -->
    <div v-if="loading" class="overview-skeleton" aria-busy="true">
      <div class="sk sk-banner"></div>
      <div class="soh-grid">
        <div class="sk sk-card"></div>
        <div class="sk sk-card"></div>
      </div>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Summary Banner -->
      <ContentCard
        variant="outlined"
        padding="lg"
        radius="lg"
        :status="bannerStatus"
        statusStyle="left-border"
        data-testid="summary-banner"
      >
        <div class="summary-banner-inner">
          <div class="banner-left">
            <span class="banner-emoji"><Icon :name="bannerStatus || 'chart'" size="sm" /></span>
            <div class="banner-labels">
              <span class="banner-label">{{ health?.lightStatus?.label || "分析中" }}</span>
              <span class="banner-title">策略健康分數</span>
            </div>
          </div>
          <div class="banner-right tabular">
            <span class="banner-score">{{ health?.score ?? "—" }}</span>
            <span class="banner-unit">/100</span>
          </div>
          <p class="banner-summary">{{ health?.summary || "資料收集中" }}</p>
        </div>
      </ContentCard>

      <!-- Grid: left health/risk, right market/tactics -->
      <div class="soh-grid">
        <!-- Left: Health & Risk -->
        <ContentCard
          variant="elevated"
          padding="md"
          radius="lg"
          data-testid="health-risk-card"
        >
          <h4 class="card-title"><Icon name="shield" size="sm" color="var(--iln-brand)" /> <span>健康度與風險剖析</span></h4>
          <ul class="card-list">
            <li class="card-item" v-for="c in healthComponents" :key="c.title">
              <span class="item-label">{{ c.title }}</span>
              <span class="item-value tabular" :class="c.status">{{ c.value }}</span>
            </li>
          </ul>
          <p class="card-hint" v-if="!healthComponents.length">— 尚無健康度資料 —</p>
        </ContentCard>

        <!-- Right: Market & Tactics -->
        <ContentCard
          variant="elevated"
          padding="md"
          radius="lg"
          data-testid="market-tactics-card"
        >
          <h4 class="card-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> <span>市場多空與策略戰術</span></h4>
          <ul class="card-list">
            <li class="card-item">
              <span class="item-label">建議動作</span>
              <span class="item-value" :class="targetClass">{{ report?.signals?.target || "—" }}</span>
            </li>
            <li class="card-item">
              <span class="item-label">PR 區間</span>
              <span class="item-value tabular">{{ prText }}</span>
            </li>
            <li class="card-item">
              <span class="item-label">槓桿水位</span>
              <span class="item-value tabular">{{ leverageText }}</span>
            </li>
          </ul>
          <p class="card-hint" v-if="!report">— 尚無市場資料 —</p>
        </ContentCard>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  health: { type: Object, default: null },
  report: { type: Object, default: null },
  loading: { type: Boolean, default: true },
});

const healthComponents = computed(() => {
  const comps = props.health?.components || [];
  return Array.isArray(comps) ? comps : [];
});

const bannerStatus = computed(() => {
  const s = props.health?.status?.toLowerCase?.();
  if (s === "green") return "ok";
  if (s === "yellow" || s === "amber") return "warn";
  if (s === "red") return "danger";
  return "";
});

const targetClass = computed(() => {
  const t = props.report?.signals?.target || "";
  if (t.includes("加碼") || t.includes("買")) return "badge-buy";
  if (t.includes("減碼") || t.includes("賣")) return "badge-sell";
  return "";
});

const prText = computed(() => {
  const pr = props.report?.signals?.valuationGuardResult?.currentPR;
  return pr != null ? `PR${Math.round(pr)}` : "—";
});

const leverageText = computed(() => {
  const v = props.report?.signals?.grossLeverage;
  return v != null ? `${Number(v).toFixed(1)}x` : "—";
});
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.soh-root {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-4);
}

.overview-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
  padding: var(--iln-space-4);
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
}

.overview-skeleton .sk {
  background: linear-gradient(90deg, var(--iln-secondary-bg) 25%, var(--iln-surface) 50%, var(--iln-secondary-bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--iln-radius-lg);
}

.sk-banner {
  height: 140px;
}

.sk-card {
  height: 180px;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

.summary-banner-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--iln-space-3);
}

.banner-left {
  display: flex;
  align-items: center;
  gap: var(--iln-space-3);
  min-width: 0;
}

.banner-emoji {
  display: inline-flex;
  align-items: center;
  font-size: var(--iln-font-xl);
}

.banner-labels {
  display: flex;
  flex-direction: column;
}

.banner-label {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}

.banner-title {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.banner-right {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: var(--iln-space-1);
}

.banner-score {
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
  color: var(--iln-text);
}

.banner-unit {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.banner-summary {
  flex-basis: 100%;
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin: 0;
  line-height: 1.5;
}

.soh-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--iln-space-4);
}

@media (min-width: 520px) {
  .soh-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  font-size: var(--iln-font-base);
  font-weight: 700;
  margin: 0 0 var(--iln-space-3);
  color: var(--iln-text);
}

.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2-5, 10px);
}

.card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--iln-space-2);
}

.item-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.item-value {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}

.item-value.green {
  color: var(--iln-viz-bull-text);
}

.item-value.yellow,
.item-value.amber {
  color: var(--iln-viz-alert-text);
}

.item-value.red {
  color: var(--iln-viz-bear-text);
}

.item-value.badge-buy {
  color: var(--iln-viz-bull-text);
}

.item-value.badge-sell {
  color: var(--iln-viz-bear-text);
}

.card-hint {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-align: center;
  margin: var(--iln-space-3) 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .overview-skeleton .sk {
    animation: none;
  }
}
</style>
