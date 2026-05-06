<template>
  <section class="section" v-if="report">
    <div class="tab-header">
      <button class="tab-btn" :class="{ active: activeTab === 'offense' }" @click="activeTab = 'offense'">⚔️ 進攻動能</button>
      <button class="tab-btn" :class="{ active: activeTab === 'defense' }" @click="activeTab = 'defense'">🛡️ 防禦機制</button>
    </div>
    
    <!-- 進攻動能 -->
    <div v-if="activeTab === 'offense'" class="tab-content">
      <div class="offense-panel">
        <div class="offense-top">
           <div class="radar-verdict" :class="scoreOk ? 'verdict-ok' : 'verdict-wait'">
             {{ scoreOk ? "🟢 達標" : "⏸️ 觀望" }} ({{ scoreVal }} / {{ scoreMin }})
           </div>
           <button class="toggle-btn" @click="showList = !showList">
             {{ showList ? "雷達圖" : "指標列表" }}
           </button>
        </div>
        
        <div v-if="!showList" class="radar-wrapper">
          <slot name="radar-chart"></slot>
        </div>
        <div v-else class="score-list">
          <div class="score-row" v-for="row in scoreRows" :key="row.label" :class="row.active ? 'score-row--active' : ''">
            <span class="score-label">{{ row.label }}</span>
            <span class="score-pt">{{ row.pt }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 防禦機制 -->
    <div v-if="activeTab === 'defense'" class="tab-content">
      <div class="defense-panel">
        <div class="defense-item" v-for="item in defenseItems" :key="item.title">
          <div class="defense-icon">{{ item.icon }}</div>
          <div class="defense-main">
            <div class="defense-title">{{ item.title }}</div>
            <div class="defense-status" :class="item.statusClass">{{ item.statusText }}</div>
            <div class="defense-desc">{{ item.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最新消息 (選配) -->
    <div class="news-section mt-4" v-if="news?.length">
      <div class="section-header">
        <h3 class="section-title">相關新聞</h3>
      </div>
      <div class="news-list">
        <div v-for="n in news" :key="n.id" class="news-card" @click="$emit('open-news', n.url)">
          <p class="news-title">{{ n.title }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  report: Object,
  scoreOk: Boolean,
  scoreVal: Number,
  scoreMin: Number,
  scoreRows: Array,
  defenseItems: Array,
  news: Array
});

defineEmits(['open-news']);

const activeTab = ref('offense');
const showList = ref(false);
</script>

<style scoped>
.tab-header {
  display: flex;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px; padding: 4px; margin-bottom: 16px;
}
.tab-btn {
  flex: 1; border: none; background: transparent; padding: 10px 0;
  font-size: 14px; font-weight: 600; color: #999; border-radius: 8px;
}
.tab-btn.active {
  background: #fff; color: #111; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.tab-content {
  background: #fff; border-radius: 12px; padding: 16px;
  border: 1px solid var(--tg-theme-secondary-bg-color, #f0f0f0);
}
.offense-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
.radar-verdict { font-weight: 700; font-size: 14px; }
.verdict-ok { color: #26a17b; }
.verdict-wait { color: #d4ac0d; }
.score-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f9f9f9; font-size: 13px; }
.score-row--active { font-weight: 700; color: #2481cc; }
.defense-item { display: flex; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.defense-item:last-child { border-bottom: none; }
.defense-icon { font-size: 20px; margin-right: 12px; padding: 8px; background: #f5f5f5; border-radius: 10px; }
.defense-title { font-size: 11px; color: #999; }
.defense-status { font-size: 15px; font-weight: 700; }
.defense-desc { font-size: 12px; color: #888; }
.news-card { background: #f9f9f9; padding: 10px; border-radius: 8px; margin-bottom: 6px; font-size: 13px; }
.mt-4 { margin-top: 24px; }
</style>
