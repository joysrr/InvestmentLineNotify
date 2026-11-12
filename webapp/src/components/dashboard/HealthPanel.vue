<template>
  <section class="section">
    <div class="section-header">
      <h3 class="section-title">帳戶健康監控</h3>
    </div>

    <div v-if="loading" class="skeleton-list">
      <div
        class="sk sk-hero"
        style="height: 140px; border-radius: 24px; margin-bottom: 16px"
      ></div>
      <div
        class="sk-grid"
        style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="sk"
          style="height: 100px; border-radius: 20px"
        ></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error">⚠️ 健康度資料載入失敗</div>
    <div v-else-if="!data" class="inline-hint">📭 尚無健康度資料</div>
    <div v-else class="health-dashboard-v2">
      <!-- Health Hero -->
      <div class="health-hero-v2" :class="data.status?.toLowerCase()">
        <div class="glass-overlay"></div>
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
            <span class="comp-icon">{{ getCompIcon(key) }}</span>
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

      <!-- Detail Link (Phase 3) -->
      <router-link
        v-if="detailLink"
        :to="detailLink"
        class="health-detail-link"
      >
        📊 查看完整策略狀態 →
      </router-link>
    </div>
  </section>
</template>

<script setup>
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
    margin: "🛡️",
    survival: "📉",
    decoupling: "💰",
    leverage: "📊",
    lifecycle: "📅",
    regime: "🌤️",
  };
  return icons[key] || "🔹";
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
/* 此處保留原有 CSS */
.health-dashboard-v2 {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.health-hero-v2 {
  position: relative;
  border-radius: 24px;
  padding: 24px;
  min-height: 140px;
  display: flex;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(36, 129, 204, 0.25);
  color: var(--tg-theme-text-color, #fff);
}
.health-hero-v2.green {
  background: linear-gradient(135deg, #2481cc 0%, #1c639e 100%);
}
.health-hero-v2.yellow {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 12px 32px rgba(245, 158, 11, 0.25);
}
.health-hero-v2.red {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 12px 32px rgba(239, 68, 68, 0.25);
}
.glass-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  backdrop-filter: blur(4px);
  z-index: 1;
}
.health-hero-content {
  position: relative;
  z-index: 2;
  width: 100%;
}
.health-hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.health-hero-status {
  display: flex;
  align-items: center;
  gap: 12px;
}
.health-hero-emoji {
  font-size: 40px;
}
.health-hero-score {
  font-size: 44px;
  font-weight: 900;
  line-height: 1;
}
.health-hero-summary {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
}
.health-grid-v2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.health-glass-card {
  position: relative;
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
.comp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.comp-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
}
.comp-body {
  display: flex;
  flex-direction: column;
}
.comp-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
}
.comp-sub {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}
.comp-status-dot {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.green .comp-status-dot {
  background: var(--iln-ok);
}
.yellow .comp-status-dot {
  background: var(--iln-warn);
}
.red .comp-status-dot {
  background: var(--iln-danger);
}
.health-action-v2 {
  background: var(--tg-theme-secondary-bg-color, #f5f8fa);
  border-radius: 20px;
  padding: 16px;
  border: 1px dashed rgba(36, 129, 204, 0.3);
}
.action-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-brand);
}
.action-item-v2 {
  font-size: 13px;
  padding: 10px;
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
  margin-top: 8px;
}
.sk {
  background: var(--iln-surface);
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}
.dual-vix-us {
  color: var(--tg-theme-text-color, #111);
  font-weight: 700;
}
.dual-vix-sep {
  color: var(--tg-theme-hint-color, #888);
  margin: 0 4px;
  font-weight: 700;
}
.dual-vix-tw {
  color: var(--iln-danger-text);
  font-weight: 700;
}

/* ── Detail Link (Phase 3) ── */
.health-detail-link {
  display: block;
  text-align: center;
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-button-color, #2481cc);
  text-decoration: none;
  border-radius: 12px;
  background: rgba(36, 129, 204, 0.06);
  transition: background 0.15s ease;
}
.health-detail-link:active {
  background: rgba(36, 129, 204, 0.12);
}
</style>
