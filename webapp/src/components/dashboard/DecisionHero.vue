<template>
  <ContentCard variant="outlined" size="lg">
    <div v-if="loading" class="hero-card skeleton-card">
      <div class="sk sk-title"></div>
      <div class="sk sk-label" style="margin-top: 12px"></div>
      <div class="sk sk-value" style="width: 60%"></div>
    </div>
    <div v-else-if="error" class="inline-error"><Icon name="danger" size="sm" color="var(--iln-viz-bear)" /> 報告載入失敗</div>
    <div v-else-if="!report" class="inline-hint"><Icon name="info" size="sm" color="var(--iln-hint)" /> 尚無報告資料</div>
    <div v-else class="hero-card">
      <div class="hero-top">
        <span class="hero-date">{{ report.date }}</span>
        <span class="priority-tag" v-if="activePriority">{{
          activePriority
        }}</span>
      </div>
      
      <!-- Primary Action Area -->
      <div class="hero-cta-area">
        <div class="hero-target iln-num-tabular" :class="targetClass">
          {{ report.signals?.target ?? "—" }}
        </div>
        <div class="hero-suggestion">
          {{ report.signals?.suggestion || "分析中..." }}
        </div>
        <el-button 
          type="primary" 
          size="large" 
          class="hero-cta-btn"
          @click="$emit('action')"
        >
          {{ actionText || '立即決策' }}
        </el-button>
      </div>

      <CollapsibleSection title="查看風險與詳情" :expanded="expanded" class="hero-details">
        <div class="hero-badges">
          <span class="badge iln-num-tabular" :class="pctClass">{{ pctText }}</span>
          <span class="badge badge-score iln-num-tabular"
            >評分 {{ report.signals?.score ?? "—" }}</span
          >
        </div>
        <div class="hero-route">
          <div class="hero-route-main">
            <span class="route-label">核心路由：</span>
            <span class="route-path">{{ routingPath || "—" }}</span>
          </div>
          <router-link v-if="showTrendLink" to="/chart" class="hero-trend-link">
            <Icon name="chart" size="sm" color="var(--iln-text)" /> 資產趨勢 →
          </router-link>
        </div>
      </CollapsibleSection>
    </div>
  </ContentCard>
</template>

<script setup>
import ContentCard from "@/components/common/ContentCard.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";
import Icon from "@/components/common/Icon.vue";
import { ElButton } from "element-plus";

defineProps({
  report: Object,
  loading: Boolean,
  error: Boolean,
  activePriority: String,
  targetClass: String,
  pctClass: String,
  pctText: String,
  routingPath: String,
  actionText: String,
  expanded: {
    type: Boolean,
    default: false,
  },
  showTrendLink: {
    type: Boolean,
    default: true,
  },
});

defineEmits(["action"]);
</script>

<style scoped>
.hero-cta-area {
  background: var(--iln-brand-soft);
  padding: var(--iln-space-5);
  border-radius: var(--iln-radius-lg);
  margin-bottom: var(--iln-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}
.hero-cta-btn {
  width: 100%;
  margin-top: var(--iln-space-2);
}
.hero-target {
  font-size: var(--iln-font-base);
  color: var(--iln-text);
  font-weight: var(--iln-weight-bold);
}
.hero-suggestion {
  font-size: var(--iln-font-xl);
  color: var(--iln-text);
  font-weight: var(--iln-weight-bold);
  line-height: 1.3;
}
.hero-details {
  border-top: 1px solid var(--iln-border-subtle);
  padding-top: var(--iln-space-4);
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
.hero-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.hero-route {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}
.hero-route-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hero-trend-link {
  font-size: var(--iln-font-xs);
  color: var(--iln-brand);
  text-decoration: none;
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
  padding: 4px 8px;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface);
}
.badge-score {
  color: var(--iln-text);
}
.priority-tag {
  font-size: var(--iln-font-xs);
  padding: 2px 8px;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-brand-soft);
  color: var(--iln-brand);
}
.skeleton-card {
  padding: var(--iln-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
}
.sk-title { height: 20px; border-radius: var(--iln-radius-sm); background: var(--iln-surface-alt); }
.sk-value { height: 24px; border-radius: var(--iln-radius-sm); background: var(--iln-surface-alt); }
.inline-error, .inline-hint {
  display: flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-3);
}
</style>