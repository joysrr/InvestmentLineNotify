<template>
  <section class="section" v-if="report?.ai">
    <h3 class="section-title">🤖 AI 教練建議</h3>
    
    <!-- 核心洞察 -->
    <div class="ai-insight" v-if="insight">
      <div class="insight-label">核心洞察</div>
      <div class="insight-text">{{ insight }}</div>
    </div>

    <!-- 策略定調 -->
    <div class="ai-verdict" v-if="verdict">
      <span class="verdict-tag">策略定調</span>
      <span class="verdict-text">{{ verdict }}</span>
    </div>

    <!-- 風險提示 (點擊控制) -->
    <div class="ai-block" v-if="risks && risks.length">
      <div class="ai-block-header" @click="riskExpanded = !riskExpanded" style="cursor: pointer;">
        <span>⚠️ 風險提示</span>
        <span class="ai-count">{{ risks.length }} 項</span>
        <span class="expand-arrow">{{ riskExpanded ? "▲" : "▼" }}</span>
      </div>
      <ul v-show="riskExpanded" class="ai-list ai-list--risk">
        <li v-for="(item, i) in risks" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 觀察清單 -->
    <div class="ai-block" v-if="actions && actions.length">
      <div class="ai-block-header" @click="actionExpanded = !actionExpanded" style="cursor: pointer;">
        <span>📌 下一步觀察清單</span>
        <span class="ai-count">{{ actions.length }} 項</span>
        <span class="expand-arrow">{{ actionExpanded ? "▲" : "▼" }}</span>
      </div>
      <ul v-show="actionExpanded" class="ai-list ai-list--action">
        <li v-for="(item, i) in actions" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 行動微調 -->
    <div class="ai-block" v-if="mindset && mindset.length">
      <div class="ai-block-header" @click="mindsetExpanded = !mindsetExpanded" style="cursor: pointer;">
        <span>💡 行動微調建議</span>
        <span class="ai-count">{{ mindset.length }} 項</span>
        <span class="expand-arrow">{{ mindsetExpanded ? "▲" : "▼" }}</span>
      </div>
      <ul v-show="mindsetExpanded" class="ai-list ai-list--mindset">
        <li v-for="(item, i) in mindset" :key="i">{{ item }}</li>
      </ul>
    </div>

    <!-- 教練內心推演 -->
    <div class="ai-block" v-if="thinking">
      <div class="ai-block-header" @click="thinkingExpanded = !thinkingExpanded" style="cursor: pointer;">
        <span>🧠 教練內心推演</span>
        <span class="expand-arrow">{{ thinkingExpanded ? "▲" : "▼" }}</span>
      </div>
      <div v-show="thinkingExpanded" class="ai-thinking">
        {{ thinking }}
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  report: Object,
  risks: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
  mindset: { type: Array, default: () => [] },
  thinking: String,
  insight: String,
  verdict: String
});

const riskExpanded = ref(true);
const actionExpanded = ref(true);
const mindsetExpanded = ref(false);
const thinkingExpanded = ref(false);
</script>

<style scoped>
/* 樣式保持不變 */
.ai-insight { background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%); border-left: 4px solid #f59e0b; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
.insight-label { font-size: 11px; font-weight: 800; color: #f59e0b; text-transform: uppercase; margin-bottom: 4px; }
.insight-text { font-size: 14px; font-weight: 600; color: #92400e; line-height: 1.4; }
.ai-verdict { display: flex; align-items: center; gap: 8px; background: #f0f9ff; padding: 8px 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #bae6fd; }
.verdict-tag { font-size: 11px; font-weight: 800; background: #0369a1; color: #fff; padding: 2px 6px; border-radius: 4px; }
.verdict-text { font-size: 13px; font-weight: 700; color: #0c4a6e; }
.ai-block { margin-bottom: 12px; background: var(--tg-theme-bg-color, #fff); border-radius: 10px; overflow: hidden; border: 1px solid rgba(0, 0, 0, 0.07); }
.ai-block-header { display: flex; align-items: center; width: 100%; padding: 10px 12px; background: var(--tg-theme-secondary-bg-color, #f5f5f5); font-size: 13px; font-weight: 600; gap: 6px; user-select: none; }
.ai-count { margin-left: auto; font-size: 11px; color: var(--tg-theme-hint-color, #888); }
.expand-arrow { font-size: 10px; color: #bbb; transition: transform 0.2s; }
.ai-list { list-style: none; padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 7px; }
.ai-list li { font-size: 13px; line-height: 1.5; padding-left: 14px; position: relative; color: var(--tg-theme-text-color, #333); }
.ai-list li::before { content: "•"; position: absolute; left: 0; color: var(--tg-theme-button-color, #2481cc); }
.ai-thinking { padding: 12px; font-size: 13px; color: #666; font-style: italic; line-height: 1.5; background: #fff; border-top: 1px solid #f9f9f9; }
</style>
