<template>
  <section class="section" v-if="report?.ai">
    <h3 class="section-title">🤖 AI 教練建議</h3>
    
    <!-- 核心洞察 (Hero Style) -->
    <div class="ai-insight" v-if="insight">
      <div class="insight-label">核心洞察</div>
      <div class="insight-text">{{ insight }}</div>
    </div>

    <!-- 攻防狀態摘要 -->
    <div class="ai-verdict" v-if="verdict">
      <span class="verdict-tag">策略定調</span>
      <span class="verdict-text">{{ verdict }}</span>
    </div>

    <!-- 風險提示 -->
    <div class="ai-block" v-if="risks.length">
      <button class="ai-block-header" @click="riskExpanded = !riskExpanded">
        <span>⚠️ 風險提示</span>
        <span class="ai-count">{{ risks.length }} 項</span>
        <span class="expand-arrow">{{ riskExpanded ? "▲" : "▼" }}</span>
      </button>
      <ul v-if="riskExpanded" class="ai-list ai-list--risk">
        <li v-for="(item, i) in risks" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 行動微調建議 -->
    <div class="ai-block" v-if="mindset.length">
      <button class="ai-block-header" @click="mindsetExpanded = !mindsetExpanded">
        <span>💡 行動微調建議</span>
        <span class="ai-count">{{ mindset.length }} 項</span>
        <span class="expand-arrow">{{ mindsetExpanded ? "▲" : "▼" }}</span>
      </button>
      <ul v-if="mindsetExpanded" class="ai-list ai-list--mindset">
        <li v-for="(item, i) in mindset" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 教練內心推演 -->
    <div class="ai-block" v-if="thinking">
      <button class="ai-block-header" @click="thinkingExpanded = !thinkingExpanded">
        <span>🧠 教練內心推演</span>
        <span class="expand-arrow">{{ thinkingExpanded ? "▲" : "▼" }}</span>
      </button>
      <p v-if="thinkingExpanded" class="ai-thinking">
        {{ thinking }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  report: Object,
  risks: Array,
  actions: Array,
  mindset: Array,
  thinking: String,
  insight: String,
  verdict: String
});
// ... (原有 refs)

</script>

<style scoped>
.ai-insight {
  background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%);
  border-left: 4px solid #f59e0b;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}
.insight-label { font-size: 11px; font-weight: 800; color: #f59e0b; text-transform: uppercase; margin-bottom: 4px; }
.insight-text { font-size: 14px; font-weight: 600; color: #92400e; line-height: 1.4; }

.ai-verdict {
  display: flex; align-items: center; gap: 8px;
  background: #f0f9ff; padding: 8px 12px; border-radius: 8px;
  margin-bottom: 16px; border: 1px solid #bae6fd;
}
.verdict-tag { font-size: 11px; font-weight: 800; background: #0369a1; color: #fff; padding: 2px 6px; border-radius: 4px; }
.verdict-text { font-size: 13px; font-weight: 700; color: #0c4a6e; }

.ai-block {
  margin-bottom: 12px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.07);
}
.ai-block-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  font-size: 13px;
  font-weight: 600;
  border: none;
  gap: 6px;
}
.ai-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
}
.ai-list {
  list-style: none;
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.ai-list li {
  font-size: 13px;
  line-height: 1.5;
  padding-left: 14px;
  position: relative;
}
.ai-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--tg-theme-button-color, #2481cc);
}
.ai-thinking {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  font-style: italic;
  line-height: 1.5;
}
</style>
