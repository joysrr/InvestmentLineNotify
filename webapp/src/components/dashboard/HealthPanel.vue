<template>
  <ContentCard variant="outlined" padding="lg" radius="lg">
    <div class="section-header">
      <h3 class="section-title">帳戶健康監控</h3>
    </div>

    <div v-if="loading" class="skeleton-list">
      <div
        class="sk sk-hero"
        style="height: 140px; margin-bottom: 16px"
      ></div>
      <div
        class="sk-grid"
        style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="sk"
          style="height: 100px"
        ></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error"><Icon name="danger" size="sm" color="var(--iln-danger)" /> 健康度資料載入失敗</div>
    <div v-else-if="!data" class="inline-hint"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 尚無健康度資料</div>
    <div v-else class="health-dashboard-v2">
      <!-- Health Hero -->
      <div class="health-hero-v2" :class="data.status?.toLowerCase()">
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
              <span class="health-hero-score">{{ data.score }}</span>
              <span class="health-hero-score-unit">/100</span>
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
        v-if="detailLink"
        class="health-detail-link"
        role="button"
        tabindex="0"
        @click="emit('open-strategy-status')"
        @keydown.enter="emit('open-strategy-status')"
      >
        <Icon name="chart" size="sm" color="var(--iln-text)" /> 查看完整策略狀態 →
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

const emit = defineEmits(["open-strategy-status"]);

const props = defineProps({
  data: Object,
  loading: Boolean,
  error: Boolean,
  detailLink: {
    type: String,
    default: "",
  },
});

const getCompIcon = (key) => {
  const icons = {
    margin: "shield",
    survival: "chart",
    decoupling: "default",
    leverage: "chart",
    lifecycle: "default",
    regime: "default",
  };
  return icons[key] || "default";
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
  if (d.margin != null) return `${d.margin}%`;
  if (d.dropPercent != null)
    return typeof d.dropPercent === "number"
      ? `${d.dropPercent.toFixed(1)}%`
      : d.dropPercent;
  if (d.z2Ratio != null) return `${d.z2Ratio.toFixed(1)}%`;
  if (d.current != null) return `${d.current.toFixed(2)}x`;
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
  background: linear-gradient(135deg, var(--iln-warn) 0%, var(--iln-health-warn-end) 100%);
  box-shadow: var(--iln-shadow-2);
}
.health-card--danger {
  background: linear-gradient(135deg, var(--iln-danger) 0%, var(--iln-health-danger-end) 100%);
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
.health-badge--ok { background: var(--iln-ok-bg); color: var(--iln-ok-text); }
.health-badge--warn { background: var(--iln-warn-bg); color: var(--iln-warn-text); }
.health-badge--danger { background: var(--iln-danger-bg); color: var(--iln-danger-text); }
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
</style>