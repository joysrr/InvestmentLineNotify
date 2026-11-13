<template>
  <section class="section hero-section">
    <div v-if="loading" class="hero-card skeleton-card">
      <div class="sk sk-title"></div>
      <div class="sk sk-label" style="margin-top: 12px"></div>
      <div class="sk sk-value" style="width: 60%"></div>
    </div>
    <div v-else-if="error" class="inline-error">⚠️ 報告載入失敗</div>
    <div v-else-if="!report" class="inline-hint">📭 尚無報告資料</div>
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
          📈 資產趨勢 →
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
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
  background: var(--iln-bg);
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  text-align: center;
  border: 1px solid var(--iln-surface);
}
.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.hero-date {
  font-size: 13px;
  color: var(--iln-hint);
}
.hero-target {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 12px;
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
  font-size: 15px;
  color: var(--iln-text);
  margin-bottom: 20px;
  line-height: 1.5;
}
.hero-badges {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}
.hero-route {
  padding-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--iln-surface);
  gap: 8px;
}
.hero-route-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.hero-trend-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--iln-brand);
  text-decoration: none;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s ease;
}
.hero-trend-link:active {
  background: rgba(36, 129, 204, 0.1);
}
.route-label {
  font-size: 12px;
  color: var(--iln-hint);
}
.route-path {
  font-size: 14px;
  font-weight: 600;
  color: var(--iln-text);
}
.badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
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
  background: var(--iln-surface);
  color: var(--iln-hint);
}
</style>
