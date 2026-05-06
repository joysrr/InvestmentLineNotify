<template>
  <section class="section" v-if="report?.ai">
    <h3 class="section-title">🤖 AI 教練建議</h3>
    
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

    <!-- 觀察清單 -->
    <div class="ai-block" v-if="actions.length">
      <button class="ai-block-header" @click="actionExpanded = !actionExpanded">
        <span>📌 下一步觀察清單</span>
        <span class="ai-count">{{ actions.length }} 項</span>
        <span class="expand-arrow">{{ actionExpanded ? "▲" : "▼" }}</span>
      </button>
      <ul v-if="actionExpanded" class="ai-list ai-list--action">
        <li v-for="(item, i) in actions" :key="i">{{ item }}</li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  report: Object,
  risks: Array,
  actions: Array
});

const riskExpanded = ref(true);
const actionExpanded = ref(true);
</script>

<style scoped>
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
</style>
