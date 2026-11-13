<template>
  <ContentCard
    v-if="report && report.ai"
    variant="outlined"
    padding="md"
    radius="lg"
    data-testid="coaching-advice"
  >
    <h3 class="section-title">🤖 AI 教練建議</h3>

    <!-- 核心洞察 -->
    <div class="ai-insight" v-if="insight">
      <div class="insight-label">核心洞察</div>
      <div class="insight-text">{{ insight }}</div>
    </div>

    <!-- 風險提示 (點擊控制) -->
    <div class="ai-block" v-if="risks && risks.length">
      <div
        class="ai-block-header"
        @click="riskExpanded = !riskExpanded"
        style="cursor: pointer"
      >
        <span><Icon name="warn" size="sm" color="var(--iln-warn)" /> 風險提示</span>
        <span class="ai-count">{{ risks.length }} 項</span>
        <span class="expand-arrow">{{ riskExpanded ? "▲" : "▼" }}</span>
      </div>
      <ul v-show="riskExpanded" class="ai-list ai-list--risk">
        <li v-for="(item, i) in risks" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 觀察清單 -->
    <div class="ai-block" v-if="actions && actions.length">
      <div
        class="ai-block-header"
        @click="actionExpanded = !actionExpanded"
        style="cursor: pointer"
      >
        <span><Icon name="default" size="sm" color="var(--iln-hint)" /> 下一步觀察清單</span>
        <span class="ai-count">{{ actions.length }} 項</span>
        <span class="expand-arrow">{{ actionExpanded ? "▲" : "▼" }}</span>
      </div>
      <ul v-show="actionExpanded" class="ai-list ai-list--action">
        <li v-for="(item, i) in actions" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 行動微調 -->
    <div class="ai-block" v-if="mindset && mindset.length">
      <div
        class="ai-block-header"
        @click="mindsetExpanded = !mindsetExpanded"
        style="cursor: pointer"
      >
        <span><Icon name="default" size="sm" color="var(--iln-hint)" /> 行動微調建議</span>
        <span class="ai-count">{{ mindset.length }} 項</span>
        <span class="expand-arrow">{{ mindsetExpanded ? "▲" : "▼" }}</span>
      </div>
      <ul v-show="mindsetExpanded" class="ai-list ai-list--mindset">
        <li v-for="(item, i) in mindset" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 教練內心推演 -->
    <div class="ai-block" v-if="thinking">
      <div
        class="ai-block-header"
        @click="thinkingExpanded = !thinkingExpanded"
        style="cursor: pointer"
      >
        <span>🧠 教練內心推演</span>
        <span class="expand-arrow">{{ thinkingExpanded ? "▲" : "▼" }}</span>
      </div>
      <div v-show="thinkingExpanded" class="ai-thinking">
        {{ thinking }}
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { ref } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  report: Object,
  risks: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
  mindset: { type: Array, default: () => [] },
  thinking: String,
  insight: String,
  verdict: String,
});

const riskExpanded = ref(false);
const actionExpanded = ref(false);
const mindsetExpanded = ref(false);
const thinkingExpanded = ref(false);
</script>

<style scoped>
.ai-insight {
  background: linear-gradient(135deg, var(--iln-coaching-start) 0%, var(--iln-coaching-end) 100%);
  border-left: 4px solid var(--iln-warn);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}
.insight-label {
  font-size: var(--iln-font-xs);
  font-weight: 800;
  color: var(--iln-warn-text);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.insight-text {
  font-size: var(--iln-font-base);
  font-weight: 600;
  color: var(--iln-warn-text);
  line-height: 1.4;
}
.ai-verdict {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--iln-info-bg);
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid var(--iln-info);
}
.verdict-tag {
  font-size: var(--iln-font-xs);
  font-weight: 800;
  background: var(--iln-info);
  color: var(--iln-text);
  padding: 2px 6px;
  border-radius: 4px;
}
.verdict-text {
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-info-text);
}
.ai-block {
  margin-bottom: 12px;
  background: var(--iln-bg);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--iln-border-subtle);
}
.ai-block-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: var(--iln-surface);
  font-size: var(--iln-font-sm);
  font-weight: 600;
  gap: 6px;
  user-select: none;
}
.ai-count {
  margin-left: auto;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.expand-arrow {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  transition: transform 0.2s;
}
.ai-list {
  list-style: none;
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.ai-list li {
  font-size: var(--iln-font-sm);
  line-height: 1.5;
  padding-left: 14px;
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
