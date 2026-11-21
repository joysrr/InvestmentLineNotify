<template>
  <ContentCard
    v-if="report && report.ai"
    variant="outlined"
    padding="md"
    radius="lg"
    data-testid="coaching-advice"
  >
    <h3 class="section-title"><Icon name="info" size="sm" color="var(--iln-hint)" /> <span>AI 教練建議</span></h3>

    <!-- 核心洞察 -->
    <div class="ai-insight" v-if="insight">
      <div class="insight-label">核心洞察</div>
      <div class="insight-text">{{ insight }}</div>
    </div>

    <!-- 風險提示 -->
    <div class="ai-block" v-if="risks && risks.length">
      <CollapsibleSection title="風險提示">
        <template #header>
          <Icon name="warn" size="sm" color="var(--iln-viz-alert)" />
          <span class="collapsible-title">風險提示</span>
          <span class="ai-count tabular">{{ risks.length }} 項</span>
        </template>
        <ul class="ai-list ai-list--risk">
          <li v-for="(item, i) in risks" :key="i">{{ item }}</li>
        </ul>
      </CollapsibleSection>
    </div>

    <!-- 觀察清單 -->
    <div class="ai-block" v-if="actions && actions.length">
      <CollapsibleSection title="下一步觀察清單">
        <template #header>
          <Icon name="search" size="sm" color="var(--iln-hint)" />
          <span class="collapsible-title">下一步觀察清單</span>
          <span class="ai-count tabular">{{ actions.length }} 項</span>
        </template>
        <ul class="ai-list ai-list--action">
          <li v-for="(item, i) in actions" :key="i">{{ item }}</li>
        </ul>
      </CollapsibleSection>
    </div>

    <!-- 行動微調 -->
    <div class="ai-block" v-if="mindset && mindset.length">
      <CollapsibleSection title="行動微調建議">
        <template #header>
          <Icon name="arrow-up" size="sm" color="var(--iln-hint)" />
          <span class="collapsible-title">行動微調建議</span>
          <span class="ai-count tabular">{{ mindset.length }} 項</span>
        </template>
        <ul class="ai-list ai-list--mindset">
          <li v-for="(item, i) in mindset" :key="i">{{ item }}</li>
        </ul>
      </CollapsibleSection>
    </div>

    <!-- 教練內心推演 -->
    <div class="ai-block" v-if="thinking">
      <CollapsibleSection title="教練內心推演">
        <div class="ai-thinking">{{ thinking }}</div>
      </CollapsibleSection>
    </div>
  </ContentCard>
</template>

<script setup>
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";

defineProps({
  report: Object,
  risks: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
  mindset: { type: Array, default: () => [] },
  thinking: String,
  insight: String,
  verdict: String,
});
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  margin: 0 0 var(--iln-space-3);
  font-size: var(--iln-font-md);
  font-weight: 700;
  color: var(--iln-text);
}

.ai-insight {
  background: linear-gradient(135deg, var(--iln-coaching-start) 0%, var(--iln-coaching-end) 100%);
  border-left: 4px solid var(--iln-viz-alert);
  padding: var(--iln-space-3);
  border-radius: var(--iln-radius-sm);
  margin-bottom: var(--iln-space-4);
}

.insight-label {
  font-size: var(--iln-font-xs);
  font-weight: 800;
  color: var(--iln-viz-alert-text);
  text-transform: uppercase;
  margin-bottom: var(--iln-space-1);
}

.insight-text {
  font-size: var(--iln-font-base);
  font-weight: 600;
  color: var(--iln-viz-alert-text);
  line-height: 1.4;
}

.ai-block {
  margin-bottom: var(--iln-space-3);
  background: var(--iln-bg);
  border-radius: var(--iln-radius-md);
  overflow: hidden;
  border: 1px solid var(--iln-border-subtle);
}

.ai-block:last-child {
  margin-bottom: 0;
}

.collapsible-title {
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-medium);
  color: var(--iln-text);
}

.ai-count {
  margin-left: auto;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.ai-list {
  list-style: none;
  margin: 0;
  padding: var(--iln-space-2) var(--iln-space-3) var(--iln-space-2-5, 10px);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1-5, 6px);
}

.ai-list li {
  font-size: var(--iln-font-sm);
  line-height: 1.5;
  padding-left: var(--iln-space-3-5, 14px);
  position: relative;
  color: var(--iln-text);
}

.ai-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--iln-brand);
}

.ai-thinking {
  padding: var(--iln-space-3);
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  font-style: italic;
  line-height: var(--iln-leading-normal);
  background: var(--iln-surface);
  border-top: 1px solid var(--iln-border-subtle);
}
</style>
