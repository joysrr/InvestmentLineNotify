<template>
  <ContentCard
    v-if="hasAiSection"
    variant="outlined"
    padding="md"
    radius="lg"
    data-testid="coaching-advice"
  >
    <h3 class="section-title"><Icon name="info" size="sm" color="var(--iln-hint)" /> <span>AI 教練建議</span></h3>

    <!-- 策略裁決徽章（若有 verdict） -->
    <div class="ai-verdict-row" v-if="resolvedVerdict">
      <span class="ai-verdict-badge">{{ resolvedVerdict }}</span>
    </div>

    <!-- 核心洞察 -->
    <div class="ai-insight" v-if="resolvedInsight">
      <div class="insight-label">核心洞察</div>
      <div class="insight-text">{{ resolvedInsight }}</div>
    </div>

    <!-- 風險提示 -->
    <div class="ai-block" v-if="resolvedRisks && resolvedRisks.length">
      <CollapsibleSection title="風險提示">
        <template #header>
          <Icon name="warn" size="sm" color="var(--iln-viz-alert)" />
          <span class="collapsible-title">風險提示</span>
          <span class="ai-count tabular">{{ resolvedRisks.length }} 項</span>
        </template>
        <ul class="ai-list ai-list--risk">
          <li v-for="(item, i) in resolvedRisks" :key="i">{{ item }}</li>
        </ul>
      </CollapsibleSection>
    </div>

    <!-- 觀察清單 -->
    <div class="ai-block" v-if="resolvedActions && resolvedActions.length">
      <CollapsibleSection title="下一步觀察清單">
        <template #header>
          <Icon name="search" size="sm" color="var(--iln-hint)" />
          <span class="collapsible-title">下一步觀察清單</span>
          <span class="ai-count tabular">{{ resolvedActions.length }} 項</span>
        </template>
        <ul class="ai-list ai-list--action">
          <li v-for="(item, i) in resolvedActions" :key="i">{{ item }}</li>
        </ul>
      </CollapsibleSection>
    </div>

    <!-- 行動微調 -->
    <div class="ai-block" v-if="resolvedMindset && resolvedMindset.length">
      <CollapsibleSection title="行動微調建議">
        <template #header>
          <Icon name="arrow-up" size="sm" color="var(--iln-hint)" />
          <span class="collapsible-title">行動微調建議</span>
          <span class="ai-count tabular">{{ resolvedMindset.length }} 項</span>
        </template>
        <ul class="ai-list ai-list--mindset">
          <li v-for="(item, i) in resolvedMindset" :key="i">{{ item }}</li>
        </ul>
      </CollapsibleSection>
    </div>

    <!-- 教練內心推演 -->
    <div class="ai-block" v-if="resolvedThinking">
      <CollapsibleSection title="教練內心推演">
        <div class="ai-thinking">{{ resolvedThinking }}</div>
      </CollapsibleSection>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";

const props = defineProps({
  report: Object,
  risks: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
  mindset: { type: Array, default: () => [] },
  thinking: String,
  insight: String,
  verdict: String,
});

const aiObj = computed(() => {
  const ai = props.report?.ai;
  return ai && typeof ai === "object" ? ai : {};
});

const hasAiSection = computed(() => Boolean(props.report && props.report.ai));

const resolvedInsight = computed(
  () => props.insight || aiObj.value.core_insight || aiObj.value.insight || "",
);
const resolvedVerdict = computed(
  () => props.verdict || aiObj.value.strategy_verdict || aiObj.value.verdict || "",
);
const resolvedRisks = computed(() =>
  props.risks && props.risks.length
    ? props.risks
    : (aiObj.value.risk_warnings ?? aiObj.value.risks ?? []),
);
const resolvedActions = computed(() =>
  props.actions && props.actions.length
    ? props.actions
    : (aiObj.value.action_items ?? aiObj.value.actions ?? []),
);
const resolvedMindset = computed(() =>
  props.mindset && props.mindset.length
    ? props.mindset
    : (aiObj.value.mindset_advice ?? aiObj.value.mindset ?? []),
);
const resolvedThinking = computed(
  () => props.thinking || aiObj.value.coach_internal_thinking || aiObj.value.thinking || "",
);
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

.ai-verdict-row {
  margin-bottom: var(--iln-space-2);
}

.ai-verdict-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--iln-space-2);
  border-radius: var(--iln-radius-sm);
  font-size: var(--iln-font-xs);
  font-weight: 700;
  background: var(--iln-brand-soft);
  color: var(--iln-brand);
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
