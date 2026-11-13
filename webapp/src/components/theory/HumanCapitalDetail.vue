<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title">💼 人力資本詳細分析</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory || humanCapitalStatus === 'UNAVAILABLE'" class="detail-unavailable">
      <p>⚠️ 理論數據未計算</p>
      <span class="detail-hint">{{ humanCapitalReason }}</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Current Status -->
      <section class="detail-section">
        <h3 class="section-title">當前狀態</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">人力資本金額</span>
            <span class="status-value large">{{ formatAmount(humanCapitalValue) }}</span>
          </div>
          <div class="status-item" v-if="humanCapitalStatus">
            <span class="status-label">計算狀態</span>
            <span class="status-value">{{ humanCapitalStatus }}</span>
          </div>
        </div>
      </section>

      <!-- Theory Explanation -->
      <section class="detail-section">
        <h3 class="section-title">理論說明</h3>
        <div class="theory-box">
          <h4 class="theory-subtitle">人力資本 (Human Capital)</h4>
          <p class="theory-text">
            人力資本代表未來勞動收入的現值，是投資組合中除金融資本外的另一大資本來源。人力資本越高，可承受的投資風險亦越高。
          </p>
          <div class="formula-box">
            <code class="formula">HC = Σ (未來勞動收入 ÷ (1 + 折現率)^t)</code>
          </div>
          <ul class="theory-list">
            <li><strong>人力資本</strong>: 未來勞動收入現值，以新台幣計價</li>
            <li><strong>金融資本</strong>: 目前投資組合淨值</li>
            <li><strong>總資本</strong>: 人力資本 + 金融資本</li>
            <li><strong>人資佔比</strong>: 人力資本 ÷ 總資本，越高代表未來收入依賴度越大</li>
          </ul>
          <p class="theory-note">
            💡 人力資本隨年齡遞減，隨薪資成長遞增，退休後趨近於零
          </p>
        </div>
      </section>

      <!-- Human Capital Zones -->
      <section class="detail-section">
        <h3 class="section-title">人力資本區間判斷</h3>
        <div class="leverage-zones">
          <div class="zone-item safe">
            <div class="zone-header">
              <span class="zone-icon">✅</span>
              <span class="zone-name">充足區</span>
            </div>
            <p class="zone-range">人力資本 > 金融資本</p>
            <p class="zone-desc">未來勞動收入仍為主要資本，可承受較高投資風險</p>
          </div>
          <div class="zone-item moderate">
            <div class="zone-header">
              <span class="zone-icon">⚠️</span>
              <span class="zone-name">平衡區</span>
            </div>
            <p class="zone-range">人力資本 ≈ 金融資本</p>
            <p class="zone-desc">人力資本與金融資本相當，風險承受度適中</p>
          </div>
          <div class="zone-item high">
            <div class="zone-header">
              <span class="zone-icon">🚨</span>
              <span class="zone-name">依賴區</span>
            </div>
            <p class="zone-range">人力資本 < 金融資本</p>
            <p class="zone-desc">金融資本佔比較高，應審慎評估投資風險</p>
          </div>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="detail-section">
        <div class="disclaimer-box">
          <h4 class="disclaimer-title">⚠️ 免責聲明</h4>
          <ul class="disclaimer-list">
            <li>人力資本僅為理論估算，非實際資產價值</li>
            <li>實際決策請參考既有風控機制（維持率、槓桿天花板）</li>
            <li>市場條件與個人收入狀況變化時，理論參數需重新校準</li>
            <li>本系統目前處於研究階段 (RESEARCH_ONLY)</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  theory: { type: Object, required: true },
});

const humanCapitalData = computed(() => props.theory?.humanCapital);
const humanCapitalStatus = computed(() => humanCapitalData.value?.status ?? null);
const humanCapitalValue = computed(() => humanCapitalData.value?.humanCapital ?? null);
const humanCapitalReason = computed(() => humanCapitalData.value?.reason ?? null);

const formatAmount = (value) => {
  if (value == null) return "--";
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", minimumFractionDigits: 0 }).format(value);
};
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--iln-bg);
}

.detail-header {
  position: sticky;
  top: 0;
  background: var(--iln-bg);
  padding: 12px 16px;
  border-bottom: 1px solid var(--iln-hint);
  z-index: 10;
}

.back-btn {
  background: transparent;
  border: none;
  font-size: 14px;
  color: var(--iln-link);
  cursor: pointer;
  padding: 4px 0;
  margin-bottom: 8px;
}

.detail-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--iln-text);
  margin: 0;
}

.detail-unavailable {
  text-align: center;
  padding: 40px 16px;
}

.detail-unavailable p {
  font-size: 16px;
  color: var(--iln-hint);
  margin: 0 0 8px 0;
}

.detail-hint {
  font-size: 13px;
  color: var(--iln-hint);
}

.detail-content {
  padding: 16px;
}

.detail-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--iln-text);
  margin: 0 0 12px 0;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.status-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--iln-surface);
  border-radius: 8px;
}

.status-label {
  font-size: 12px;
  color: var(--iln-hint);
  margin-bottom: 6px;
}

.status-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--iln-text);
}

.status-value.large {
  font-size: 20px;
  color: var(--iln-link);
}

.theory-box,
.calculation-box,
.warning-box,
.disclaimer-box {
  padding: 16px;
  background: var(--iln-surface);
  border-radius: 10px;
}

.theory-subtitle,
.warning-title,
.disclaimer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--iln-text);
  margin: 0 0 8px 0;
}

.theory-text,
.warning-text {
  font-size: 13px;
  color: var(--iln-text);
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.formula-box {
  padding: 12px;
  background: var(--iln-bg);
  border-radius: 6px;
  margin: 12px 0;
  text-align: center;
}

.formula {
  font-family: "Courier New", monospace;
  font-size: 15px;
  font-weight: 600;
  color: var(--iln-text);
}

.theory-list,
.warning-list,
.disclaimer-list {
  margin: 12px 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--iln-text);
  line-height: 1.8;
}

.theory-list li,
.warning-list li,
.disclaimer-list li {
  margin-bottom: 6px;
}

.theory-note,
.warning-note,
.calc-note {
  font-size: 12px;
  color: var(--iln-hint);
  font-style: italic;
  margin: 8px 0 0 0;
}

.leverage-zones {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zone-item {
  padding: 14px;
  border-radius: 8px;
  border-left: 4px solid;
}

.zone-item.safe {
  background: rgba(46, 125, 50, 0.1);
  border-left-color: var(--iln-text);
}

.zone-item.moderate {
  background: rgba(239, 108, 0, 0.1);
  border-left-color: var(--iln-text);
}

.zone-item.high {
  background: rgba(198, 40, 40, 0.1);
  border-left-color: var(--iln-text);
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.zone-icon {
  font-size: 16px;
}

.zone-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--iln-text);
}

.zone-range {
  font-size: 15px;
  font-weight: 600;
  color: var(--iln-text);
  margin: 0 0 4px 0;
}

.zone-desc {
  font-size: 12px;
  color: var(--iln-hint);
  margin: 0;
}

.warning-box {
  background: rgba(239, 108, 0, 0.1);
  border-left: 4px solid var(--iln-text);
}

.disclaimer-box {
  background: rgba(158, 158, 158, 0.1);
  border-left: 4px solid var(--iln-text);
}
</style>
