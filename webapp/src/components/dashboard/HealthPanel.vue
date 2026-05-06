<template>
  <section class="section">
    <div class="section-header">
      <h3 class="section-title">帳戶健康監控</h3>
    </div>
    
    <div v-if="loading" class="skeleton-list">
      <div class="sk sk-hero" style="height: 140px; border-radius: 24px; margin-bottom: 16px;"></div>
      <div class="sk-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div v-for="i in 6" :key="i" class="sk" style="height: 100px; border-radius: 20px;"></div>
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
              <span class="health-hero-emoji">{{ data.lightStatus?.emoji || '📊' }}</span>
              <div class="health-hero-labels">
                <span class="health-hero-title">帳戶健康評級</span>
                <span class="health-hero-label">{{ data.lightStatus?.label || '分析中' }}</span>
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
        <div v-for="(comp, key) in data.components" :key="key" 
             class="health-glass-card" :class="comp.status?.toLowerCase()">
          <div class="comp-header">
            <span class="comp-icon">{{ getCompIcon(key) }}</span>
            <span class="comp-name">{{ getCompName(key) }}</span>
          </div>
          <div class="comp-body">
            <div class="comp-value">{{ getCompDisplayValue(comp) }}</div>
            <div class="comp-sub">{{ comp.details?.message || comp.details?.stage || '正常' }}</div>
          </div>
          <div class="comp-status-dot"></div>
        </div>
      </div>

      <!-- Recommendations -->
      <div class="health-action-v2" v-if="data.recommendations?.length">
        <div class="action-header">
          <span class="action-icon">💡</span>
          <span class="action-title">策略建議行動</span>
        </div>
        <div class="action-list-v2">
          <div v-for="(rec, i) in data.recommendations" :key="i" class="action-item-v2">
            {{ rec }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  data: Object,
  loading: Boolean,
  error: Boolean
});

const getCompIcon = (key) => {
  const icons = { margin: '🛡️', survival: '📉', decoupling: '💰', leverage: '📊', lifecycle: '📅', regime: '🌤️' };
  return icons[key] || '🔹';
};

const getCompName = (key) => {
  const names = { margin: '維持率', survival: '生存空間', decoupling: '資產解耦', leverage: '槓桿比例', lifecycle: '生命週期', regime: '市場環境' };
  return names[key] || key;
};

const getCompDisplayValue = (comp) => {
  const d = comp.details || {};
  if (d.margin != null) return `${d.margin}%`;
  if (d.dropPercent != null) return typeof d.dropPercent === 'number' ? `${d.dropPercent.toFixed(1)}%` : d.dropPercent;
  if (d.z2Ratio != null) return `${d.z2Ratio.toFixed(1)}%`;
  if (d.current != null) return `${d.current.toFixed(2)}x`;
  if (d.stage) return d.stage;
  if (d.vix) return `VIX ${d.vix}`;
  return comp.value || '—';
};
</script>

<style scoped>
/* 此處保留原有 CSS */
.health-dashboard-v2 { display: flex; flex-direction: column; gap: 16px; }
.health-hero-v2 { position: relative; border-radius: 24px; padding: 24px; min-height: 140px; display: flex; align-items: center; overflow: hidden; box-shadow: 0 12px 32px rgba(36, 129, 204, 0.25); color: #fff; }
.health-hero-v2.green { background: linear-gradient(135deg, #2481cc 0%, #1c639e 100%); }
.health-hero-v2.yellow { background: linear-gradient(135deg, #f39c12 0%, #d35400 100%); box-shadow: 0 12px 32px rgba(243, 156, 18, 0.25); }
.health-hero-v2.red { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); box-shadow: 0 12px 32px rgba(231, 76, 60, 0.25); }
.glass-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%); backdrop-filter: blur(4px); z-index: 1; }
.health-hero-content { position: relative; z-index: 2; width: 100%; }
.health-hero-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.health-hero-status { display: flex; align-items: center; gap: 12px; }
.health-hero-emoji { font-size: 40px; }
.health-hero-score { font-size: 44px; font-weight: 900; line-height: 1; }
.health-hero-summary { font-size: 14px; font-weight: 500; line-height: 1.6; }
.health-grid-v2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.health-glass-card { position: relative; background: var(--tg-theme-bg-color, #fff); border: 1px solid rgba(0, 0, 0, 0.05); border-radius: 20px; padding: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); }
.comp-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.comp-name { font-size: 12px; font-weight: 600; color: #888; }
.comp-body { display: flex; flex-direction: column; }
.comp-value { font-size: 20px; font-weight: 700; color: var(--tg-theme-text-color, #111); }
.comp-sub { font-size: 11px; color: #999; }
.comp-status-dot { position: absolute; top: 16px; right: 16px; width: 8px; height: 8px; border-radius: 50%; }
.green .comp-status-dot { background: #2ecc71; }
.yellow .comp-status-dot { background: #f39c12; }
.red .comp-status-dot { background: #e74c3c; }
.health-action-v2 { background: var(--tg-theme-secondary-bg-color, #f5f8fa); border-radius: 20px; padding: 16px; border: 1px dashed rgba(36, 129, 204, 0.3); }
.action-title { font-size: 13px; font-weight: 700; color: #2481cc; }
.action-item-v2 { font-size: 13px; padding: 10px; background: #fff; border-radius: 12px; margin-top: 8px; }
.sk { background: #eee; animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>
