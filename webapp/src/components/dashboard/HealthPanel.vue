<template>
  <ContentCard variant="outlined" size="lg">
    <div class="section-header">
      <h3 class="section-title">帳戶健康監控</h3>
    </div>

    <Transition name="sk-fade" mode="out-in">
      <LoadingSkeleton
        v-if="loading"
        key="skeleton"
        variant="card"
        :rows="4"
      />
      <ErrorAlert
        v-else-if="error"
        key="error"
        title="健康度資料載入失敗"
        description="請稍後再試，或點擊重試"
        show-retry
        retry-text="重新整理"
        @retry="emit('retry')"
      />
      <EmptyState
        v-else-if="!data"
        key="empty"
        title="尚無健康度資料"
        message="帳戶健康度評估尚未產生，請稍後再試"
        action-text="重新整理"
        @action="emit('retry')"
      />
      <div v-else key="content" class="health-dashboard-v2">
        <!-- Health Hero -->
        <div class="health-hero-v2">
          <div class="health-hero-content">
            <div class="health-hero-top">
              <div class="health-hero-status">
                <span class="health-hero-emoji">{{
                  data.lightStatus?.emoji || "📊"
                }}</span>
                <div class="health-hero-labels">
                  <span class="health-hero-title">帳戶健康評級</span>
                  <span class="health-hero-label">{{
                    data.lightStatus?.label || "分析中"
                  }}</span>
                </div>
              </div>
              <div class="health-hero-score-wrapper tabular">
                <StatCard
                  label="帳戶健康分數"
                  :value="data.score"
                  :status="statusClass"
                  unit="/100"
                />
              </div>
            </div>
            <p class="health-hero-summary">{{ data.summary }}</p>
          </div>
        </div>

        <!-- Health Components Grid -->
        <div class="health-grid-v2">
          <div
            v-for="(comp, key) in data.components"
            :key="key"
            class="health-glass-card"
            :class="comp.status?.toLowerCase()"
          >
            <div class="comp-header">
              <span class="comp-icon"><Icon :name="getCompIcon(key)" size="sm" /></span>
              <span class="comp-name">{{ getCompName(key) }}</span>
              <span class="comp-status-dot" aria-hidden="true"></span>
            </div>
            <div class="comp-body">
              <div
                class="comp-value dual-vix-row tabular"
                v-if="key === 'regime' && comp.details?.vixTW != null"
              >
                <span class="dual-vix-us">VIX {{ comp.details.vix }}</span>
                <span class="dual-vix-sep">/</span>
                <span class="dual-vix-tw">台股 {{ comp.details.vixTW }}</span>
              </div>
              <div class="comp-value tabular" v-else>{{ getCompDisplayValue(comp) }}</div>
              <div class="comp-sub">
                {{ comp.details?.message || comp.details?.stage || "正常" }}
              </div>
            </div>
          </div>
        </div>

        <!-- Detail Link：改為 emit，由父層決定開啟 drawer 或導航 -->
        <div
          class="health-detail-link"
          role="button"
          tabindex="0"
          @click="emit('open-strategy-status')"
          @keydown.enter="emit('open-strategy-status')"
        >
          <Icon name="chart" size="sm" color="var(--iln-brand)" />
          <span>查看完整策略狀態 →</span>
        </div>
      </div>
    </Transition>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";
import LoadingSkeleton from "@/components/common/LoadingSkeleton.vue";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import StatCard from "@/components/common/StatCard.vue";

const emit = defineEmits(["open-strategy-status", "retry"]);

const props = defineProps({
  data: Object,
  loading: Boolean,
  error: Boolean,
});

const statusMap = {
  ok: "ok",
  warn: "warn",
  danger: "danger",
  neutral: "neutral",
  healthy: "ok",
  warning: "warn",
  critical: "danger",
  unknown: "neutral",
};

const statusClass = computed(() => {
  const raw = props.data?.status;
  return statusMap[raw] || "neutral";
});

const getCompIcon = (key) => {
  const icons = {
    margin: "shield",
    survival: "chart",
    decoupling: "neutral",
    leverage: "chart",
    lifecycle: "neutral",
    regime: "neutral",
  };
  return icons[key] || "neutral";
};

const getCompName = (key) => {
  const names = {
    margin: "維持率",
    survival: "生存空間",
    decoupling: "資產解耦",
    leverage: "槓桿比例",
    lifecycle: "生命週期",
    regime: "市場環境",
  };
  return names[key] || key;
};

const getCompDisplayValue = (comp) => {
  const d = comp.details || {};
  if (d.margin != null)
    return Number.isFinite(d.margin) ? `${d.margin}%` : "—%";
  if (d.dropPercent != null)
    return typeof d.dropPercent === "number"
      ? Number.isFinite(d.dropPercent)
        ? `${d.dropPercent.toFixed(1)}%`
        : "—"
      : d.dropPercent;
  if (d.z2Ratio != null)
    return Number.isFinite(d.z2Ratio) ? `${d.z2Ratio.toFixed(1)}%` : "—";
  if (d.current != null)
    return Number.isFinite(d.current) ? `${d.current.toFixed(2)}x` : "—";
  if (d.stage) return d.stage;
  if (d.vix != null && d.vixTW != null) return `VIX ${d.vix} / 台股 VIX ${d.vixTW}`;
  if (d.vix != null) return `VIX ${d.vix}`;
  if (d.vixTW != null) return `台股 VIX ${d.vixTW}`;
  return comp.value || "—";
};
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-4);
}

.section-title {
  margin: 0;
  font-size: var(--iln-font-md);
  font-weight: 700;
  color: var(--iln-text);
}

.health-dashboard-v2 {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-5);
}

.health-hero-v2 {
  position: relative;
  border-radius: var(--iln-radius-lg);
  overflow: hidden;
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  box-shadow: var(--iln-shadow-1);
}

.health-hero-content {
  position: relative;
  padding: var(--iln-space-5);
}

.health-hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-4);
  margin-bottom: var(--iln-space-3);
}

.health-hero-status {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
}

.health-hero-emoji {
  font-size: var(--iln-font-xl);
}

.health-hero-labels {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-hero-title {
  font-size: var(--iln-font-base);
  font-weight: var(--iln-weight-semibold);
  color: var(--iln-text);
}

.health-hero-label {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.health-hero-score-wrapper {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
}

.health-hero-summary {
  margin: 0;
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  line-height: 1.5;
}

.health-grid-v2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--iln-space-4);
}

.health-glass-card {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-lg);
  padding: var(--iln-space-4);
  box-shadow: var(--iln-shadow-1);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}

.comp-header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-1);
}

.comp-icon {
  display: inline-flex;
  align-items: center;
  color: var(--iln-hint);
}

.comp-name {
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-medium);
  color: var(--iln-text);
}

.comp-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--iln-viz-bull);
  margin-left: auto;
  flex-shrink: 0;
}

.health-glass-card.warn .comp-status-dot {
  background: var(--iln-viz-alert);
}

.health-glass-card.danger .comp-status-dot,
.health-glass-card.critical .comp-status-dot {
  background: var(--iln-viz-bear);
}

.comp-body {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1);
}

.comp-value {
  font-size: var(--iln-font-base);
  font-weight: var(--iln-weight-semibold);
  color: var(--iln-text);
}

.dual-vix-row {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--iln-space-1);
}

.dual-vix-us,
.dual-vix-tw {
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-semibold);
  color: var(--iln-text);
}

.dual-vix-sep {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.comp-sub {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.health-detail-link {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  align-self: flex-start;
  padding: var(--iln-space-2) var(--iln-space-4);
  background: var(--iln-surface-alt);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  color: var(--iln-brand);
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-semibold);
  cursor: pointer;
  transition:
    background-color var(--iln-duration-fast) var(--iln-ease-standard),
    border-color var(--iln-duration-fast) var(--iln-ease-standard);
}

.health-detail-link:hover {
  background: var(--iln-surface-sunken);
  border-color: var(--iln-border-default);
}

.health-detail-link:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .health-detail-link {
    transition: none;
  }
}
</style>
