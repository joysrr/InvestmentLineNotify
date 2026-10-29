<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title">🛡️ 崩盤耐受度詳細分析</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory || crashToleranceStatus === 'UNAVAILABLE'" class="detail-unavailable">
      <p>⚠️ 理論數據未計算</p>
      <span class="detail-hint">{{ crashToleranceReason }}</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Current Status -->
      <section class="detail-section">
        <h3 class="section-title">當前狀態</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">崩盤耐受度比例</span>
            <span class="status-value large">{{ formatPercent(crashToleranceValue) }}</span>
          </div>
          <div class="status-item" v-if="crashToleranceStatus">
            <span class="status-label">計算狀態</span>
            <span class="status-value">{{ crashToleranceStatus }}</span>
          </div>
        </div>
      </section>

      <!-- Theory Explanation -->
      <section class="detail-section">
        <h3 class="section-title">理論說明</h3>
        <div class="theory-box">
          <h4 class="theory-subtitle">崩盤耐受度 (Crash Tolerance)</h4>
          <p class="theory-text">
            崩盤耐受度衡量投資組合在極端市場崩盤時的最大可承受虧損比例。用於設定停損線與風險上限，避免組合在極端行情下遭受不可逆的損害。
          </p>
          <div class="formula-box">
            <code class="formula">CT = 最大可承受虧損 ÷ 總資產</code>
          </div>
          <ul class="theory-list">
            <li><strong>崩盤耐受度</strong>: 極端行情下可承受的最大虧損比例</li>
            <li><strong>建議上限</strong>: 通常建議不超過 30%，避免單次崩盤造成毀滅性損失</li>
            <li><strong>壓力情境</strong>: 基於歷史崩盤劇本（如 COVID 熔斷、金融海嘯）模擬</li>
            <li><strong>聯動機制</strong>: 當耐受度接近上限時，應減少槓桿或增加現金比重</li>
          </ul>
          <p class="theory-note">
            💡 崩盤耐受度越低，代表風險承受能力越弱，應更保守
          </p>
        </div>
      </section>

      <!-- Crash Tolerance Zones -->
      <section class="detail-section">
        <h3 class="section-title">崩盤耐受度區間判斷</h3>
        <div class="leverage-zones">
          <div class="zone-item safe">
            <div class="zone-header">
              <span class="zone-icon">✅</span>
              <span class="zone-name">保守區</span>
            </div>
            <p class="zone-range">崩盤耐受度 ≤ 20%</p>
            <p class="zone-desc">風險承受能力較強，可適度承受市場波動</p>
          </div>
          <div class="zone-item moderate">
            <div class="zone-header">
              <span class="zone-icon">⚠️</span>
              <span class="zone-name">適中區</span>
            </div>
            <p class="zone-range">20% < 崩盤耐受度 ≤ 30%</p>
            <p class="zone-desc">風險承受適中，需關注市場極端行情</p>
          </div>
          <div class="zone-item high">
            <div class="zone-header">
              <span class="zone-icon">🚨</span>
              <span class="zone-name">激進區</span>
            </div>
            <p class="zone-range">崩盤耐受度 > 30%</p>
            <p class="zone-desc">風險承受較低，建議降低槓桿或增加現金</p>
          </div>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="detail-section">
        <div class="disclaimer-box">
          <h4 class="disclaimer-title">⚠️ 免責聲明</h4>
          <ul class="disclaimer-list">
            <li>崩盤耐受度僅為理論估算，非實際風險指標</li>
            <li>實際決策請參考既有風控機制（維持率、槓桿天花板）</li>
            <li>市場條件變化時，理論參數需重新校準</li>
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

const crashToleranceData = computed(() => props.theory?.crashTolerance);
const crashToleranceStatus = computed(() => crashToleranceData.value?.status ?? null);
const crashToleranceValue = computed(() => crashToleranceData.value?.crashTolerance ?? null);
const crashToleranceReason = computed(() => crashToleranceData.value?.reason ?? null);

const formatPercent = (value) => {
  if (value == null) return "--";
  return new Intl.NumberFormat("zh-TW", { style: "percent", minimumFractionDigits: 0 }).format(value);
};
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--tg-theme-bg-color, #fff);
}

.detail-header {
  position: sticky;
  top: 0;
  background: var(--tg-theme-bg-color, #fff);
  padding: 12px 16px;
  border-bottom: 1px solid var(--tg-theme-hint-color, #e0e0e0);
  z-index: 10;
}

.back-btn {
  background: transparent;
  border: none;
  font-size: 14px;
  color: var(--tg-theme-link-color, #3390ec);
  cursor: pointer;
  padding: 4px 0;
  margin-bottom: 8px;
}

.detail-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
  margin: 0;
}

.detail-unavailable {
  text-align: center;
  padding: 40px 16px;
}

.detail-unavailable p {
  font-size: 16px;
  color: var(--tg-theme-hint-color, #999);
  margin: 0 0 8px 0;
}

.detail-hint {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #aaa);
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
  color: var(--tg-theme-text-color, #222);
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
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
}

.status-label {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 6px;
}

.status-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.status-value.large {
  font-size: 20px;
  color: var(--tg-theme-link-color, #3390ec);
}

.theory-box,
.calculation-box,
.warning-box,
.disclaimer-box {
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.theory-subtitle,
.warning-title,
.disclaimer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 8px 0;
}

.theory-text,
.warning-text {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.formula-box {
  padding: 12px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 6px;
  margin: 12px 0;
  text-align: center;
}

.formula {
  font-family: "Courier New", monospace;
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.theory-list,
.warning-list,
.disclaimer-list {
  margin: 12px 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
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
  color: var(--tg-theme-hint-color, #999);
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
  border-left-color: var(--tg-theme-text-color, #4caf50);
}

.zone-item.moderate {
  background: rgba(239, 108, 0, 0.1);
  border-left-color: var(--tg-theme-text-color, #ff9800);
}

.zone-item.high {
  background: rgba(198, 40, 40, 0.1);
  border-left-color: var(--tg-theme-text-color, #f44336);
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
  color: var(--tg-theme-text-color, #222);
}

.zone-range {
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 4px 0;
}

.zone-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  margin: 0;
}

.warning-box {
  background: rgba(239, 108, 0, 0.1);
  border-left: 4px solid var(--tg-theme-text-color, #ff9800);
}

.disclaimer-box {
  background: rgba(158, 158, 158, 0.1);
  border-left: 4px solid var(--tg-theme-text-color, #9e9e9e);
}
</style>
