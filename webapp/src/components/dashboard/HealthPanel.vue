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
        <div class="glass-overlay"></div>
        <div class="health-hero-content">
          <div class="health-hero-top">
            <div class="health-hero-status">
              <span class="health-hero-emoji">{{
                data.lightStatus?.emoji || "chart"
              }}</span>
              <div class="health-hero-labels">
                <span class="health-hero-title">帳戶健康評級</span>
                <span class="health-hero-label">{{
                  data.lightStatus?.label || "分析中"
                }}</span>
              </div>
            </div>
            <div class="health-hero-score-wrapper">
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
          </div>
          <div class="comp-body">
            <div
              class="comp-value"
              v-if="key === 'regime' && comp.details?.vixTW != null"
            >
              <span class="dual-vix-us">VIX {{ comp.details.vix }}</span>
              <span class="dual-vix-sep">/</span>
              <span class="dual-vix-tw">台股 {{ comp.details.vixTW }}</span>
            </div>
            <div class="comp-value" v-else>{{ getCompDisplayValue(comp) }}</div>
            <div class="comp-sub">
              {{ comp.details?.message || comp.details?.stage || "正常" }}
            </div>
          </div>
          <div class="comp-status-dot"></div>
        </div>
      </div>

      <!-- Detail Link (Phase 3)：改為 emit，由父層決定開啟 drawer 或導航 -->
      <div
        class="health-detail-link"
        role="button"
        tabindex="0"
        @click="emit('open-strategy-status')"
        @keydown.enter="emit('open-strategy-status')"
      >
        <Icon name="chart" size="sm" color="var(--iln-text)" /> 查看完整策略狀態 →
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

// status 映射對照 docs/design/status-semantics.md 四態：ok / warn / danger / neutral
const statusMap = {
  ok: "ok",
  warn: "warn",
  danger: "danger",
  neutral: "neutral",
  // 後端可能回傳的其他值
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
.section {
  /* 佈局由 ContentCard 提供 */
}
.health-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.health-card {
  background: var(--iln-bg);
  border-radius: var(--iln-radius-lg);
  padding: 16px;
  border: 1px solid var(--iln-border-subtle);
  box-shadow: var(--iln-shadow-1);
}
.health-card--primary {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, var(--iln-brand) 0%, var(--iln-health-brand-end) 100%);
  box-shadow: var(--iln-shadow-2);
}
.health-card--warn {
  background: linear-gradient(135deg, var(--iln-viz-alert) 0%, var(--iln-health-warn-end) 100%);
  box-shadow: var(--iln-shadow-2);
}
.health-card--danger {
  background: linear-gradient(135deg, var(--iln-viz-bear) 0%, var(--iln-health-danger-end) 100%);
  box-shadow: var(--iln-shadow-2);
}
.health-card h2 {
  font-size: var(--iln-font-lg);
  margin: 0 0 16px;
  color: var(--iln-text);
}
.health-value {
  font-size: var(--iln-font-xl);
  font-weight: 700;
}
.health-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.health-meta {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin-top: 4px;
}
.health-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
}
.health-stat-value {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}
.health-stat-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.health-trend {
  font-size: var(--iln-font-sm);
  padding: 10px;
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
}
.health-badge {
  font-size: var(--iln-font-xs);
  padding: 4px 8px;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface);
}
.health-badge--ok { background: var(--iln-viz-bull-bg); color: var(--iln-viz-bull-text); }
.health-badge--warn { background: var(--iln-viz-alert-bg); color: var(--iln-viz-alert-text); }
.health-badge--danger { background: var(--iln-viz-bear-bg); color: var(--iln-viz-bear-text); }
.health-badge-score {
  font-size: var(--iln-font-xs);
  padding: 4px 10px;
  border-radius: var(--iln-radius-md);
  background: var(--iln-surface);
  color: var(--iln-text);
}
.health-link {
  font-size: var(--iln-font-xs);
  color: var(--iln-brand);
}
.health-link:active { opacity: 0.8; }
.health-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.health-body {
  margin-top: 12px;
}
.health-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--iln-border-subtle);
}
.health-skeleton {
  background: linear-gradient(135deg, var(--iln-brand) 0%, var(--iln-health-brand-end) 100%);
  border-radius: var(--iln-radius-lg);
  box-shadow: var(--iln-shadow-2);
}

/* Dashboard 容器 */
.health-dashboard-v2 {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-6);
}

/* Health Hero 區塊 */
.health-hero-v2 {
  position: relative;
  border-radius: var(--iln-radius-lg);
  overflow: hidden;
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  box-shadow: var(--iln-shadow-1);
}

.glass-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.4); /* iln-color-allow: 玻璃擬態半透明白色遮罩，無對應設計令牌 */
  pointer-events: none;
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
}

/* Health 組件網格 */
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
  margin-bottom: var(--iln-space-2);
}

.comp-icon {
  font-size: var(--iln-font-base);
}

.comp-name {
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-medium);
  color: var(--iln-text);
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

.comp-sub {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.comp-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--iln-viz-bull-bg);
  margin-left: auto;
}

/* 雙 VIX 顯示 */
.dual-vix-us,
.dual-vix-tw {
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-medium);
  color: var(--iln-text);
}

.dual-vix-sep {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

/* 詳情連結 */
.health-detail-link {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  margin-top: var(--iln-space-4);
  padding: var(--iln-space-2) var(--iln-space-4);
  background: var(--iln-surface-alt);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  color: var(--iln-brand);
  font-size: var(--iln-font-sm);
  cursor: pointer;
  transition: all var(--iln-duration-fast) var(--iln-ease-standard);
}

.health-detail-link:hover {
  background: var(--iln-surface-sunken);
  border-color: var(--iln-border-default);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-4);
}

/* 雙 VIX-US 指標 */
.dual-vix-us {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1);
}
</style>