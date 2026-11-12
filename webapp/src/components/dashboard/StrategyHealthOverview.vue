<template>
  <div class="soh-root">
    <!-- Loading skeleton -->
    <div v-if="loading" class="overview-skeleton">
      <div class="sk sk-banner"></div>
      <div class="soh-grid">
        <div class="sk sk-card"></div>
        <div class="sk sk-card"></div>
      </div>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Summary Banner -->
      <div class="summary-banner" :class="signalClass" data-testid="summary-banner">
        <div class="banner-left">
          <span class="banner-emoji">{{ health?.lightStatus?.emoji || "📊" }}</span>
          <div class="banner-labels">
            <span class="banner-label">{{ health?.lightStatus?.label || "分析中" }}</span>
            <span class="banner-title">策略健康分數</span>
          </div>
        </div>
        <div class="banner-right">
          <span class="banner-score">{{ health?.score ?? "—" }}</span>
          <span class="banner-unit">/100</span>
        </div>
        <p class="banner-summary">{{ health?.summary || "資料收集中" }}</p>
      </div>

      <!-- Grid: left health/risk, right market/tactics -->
      <div class="soh-grid">
        <!-- Left: Health & Risk -->
        <div class="soh-card" data-testid="health-risk-card">
          <h4 class="card-title">🛡️ 健康度與風險剖析</h4>
          <ul class="card-list">
            <li class="card-item" v-for="c in healthComponents" :key="c.title">
              <span class="item-label">{{ c.title }}</span>
              <span class="item-value" :class="c.status">{{ c.value }}</span>
            </li>
          </ul>
          <p class="card-hint" v-if="!healthComponents.length">— 尚無健康度資料 —</p>
        </div>

        <!-- Right: Market & Tactics -->
        <div class="soh-card" data-testid="market-tactics-card">
          <h4 class="card-title">📈 市場多空與策略戰術</h4>
          <ul class="card-list">
            <li class="card-item">
              <span class="item-label">建議動作</span>
              <span class="item-value" :class="targetClass">{{ report?.signals?.target || "—" }}</span>
            </li>
            <li class="card-item">
              <span class="item-label">PR 區間</span>
              <span class="item-value">{{ prText }}</span>
            </li>
            <li class="card-item">
              <span class="item-label">槓桿水位</span>
              <span class="item-value">{{ leverageText }}</span>
            </li>
          </ul>
          <p class="card-hint" v-if="!report">— 尚無市場資料 —</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  health: { type: Object, default: null },
  report: { type: Object, default: null },
  loading: { type: Boolean, default: true },
});

const healthComponents = computed(() => {
  const comps = props.health?.components || [];
  return Array.isArray(comps) ? comps : [];
});

const signalClass = computed(() => {
  const s = props.health?.status?.toLowerCase?.();
  if (s === "green") return "sig-green";
  if (s === "yellow" || s === "amber") return "sig-yellow";
  if (s === "red") return "sig-red";
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
.soh-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Skeleton */
.overview-skeleton .sk {
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 20px;
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

/* Summary Banner */
.summary-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  background: var(--tg-theme-secondary-bg-color, #f5f8fa);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  border-left: 5px solid var(--iln-border-default);
}
.summary-banner.sig-green {
  border-left-color: var(--iln-ok);
}
.summary-banner.sig-yellow {
  border-left-color: var(--iln-warn);
}
.summary-banner.sig-red {
  border-left-color: var(--iln-danger);
}
.banner-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.banner-emoji {
  font-size: 36px;
}
.banner-labels {
  display: flex;
  flex-direction: column;
}
.banner-label {
  font-size: 16px;
  font-weight: 700;
}
.banner-title {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
}
.banner-right {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.banner-score {
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
}
.banner-unit {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}
.banner-summary {
  flex-basis: 100%;
  font-size: 13px;
  color: var(--tg-theme-hint-color, #666);
  margin: 0;
  line-height: 1.5;
}

/* Grid */
.soh-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 520px) {
  .soh-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.soh-card {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
.card-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--tg-theme-text-color, #333);
}
.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.item-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #888);
}
.item-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}
.item-value.green {
  color: var(--iln-ok-text);
}
.item-value.yellow,
.item-value.amber {
  color: var(--iln-warn-text);
}
.item-value.red {
  color: var(--iln-danger-text);
}
.item-value.badge-buy {
  color: var(--iln-ok-text);
}
.item-value.badge-sell {
  color: var(--iln-danger-text);
}
.card-hint {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #bbb);
  text-align: center;
  margin: 12px 0 0;
}
</style>