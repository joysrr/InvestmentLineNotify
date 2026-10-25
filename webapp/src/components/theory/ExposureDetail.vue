<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title">📈 市場曝險詳細分析</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory" class="detail-unavailable">
      <p>⚠️ 理論數據未計算</p>
      <span class="detail-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Current Exposure -->
      <section class="detail-section">
        <h3 class="section-title">當前曝險狀態</h3>
        <div class="exposure-summary">
          <div class="summary-row">
            <span class="summary-label">總方向曝險</span>
            <span class="summary-value primary">{{ formatAmount(theory.grossExposure) }}</span>
          </div>
          <div v-if="portfolioSnapshot" class="summary-row">
            <span class="summary-label">財務資本</span>
            <span class="summary-value">{{ formatAmount(portfolioSnapshot.accountNetAsset) }}</span>
          </div>
          <div v-if="exposureRatio != null" class="summary-row highlight">
            <span class="summary-label">曝險比例</span>
            <span class="summary-value" :class="exposureRatioClass">{{ formatPercent(exposureRatio) }}</span>
          </div>
        </div>
      </section>

      <!-- Extreme Scenario Simulation -->
      <section v-if="portfolioSnapshot && theory.grossExposure" class="detail-section">
        <h3 class="section-title">💥 極端情境模擬</h3>
        <p class="section-desc">模擬大盤下跌時的淨值變化</p>
        <div class="scenario-list">
          <div
            v-for="scenario in scenarios"
            :key="scenario.drop"
            class="scenario-item"
            :class="scenario.severity"
          >
            <div class="scenario-header">
              <span class="scenario-drop">大盤跌 {{ scenario.drop }}%</span>
              <span class="scenario-loss">{{ formatAmount(scenario.loss) }}</span>
            </div>
            <div class="scenario-result">
              <span class="result-label">剩餘淨值</span>
              <span class="result-value" :class="scenario.severity">
                {{ formatAmount(scenario.remaining) }}
              </span>
            </div>
            <div class="scenario-bar">
              <div
                class="scenario-bar-fill"
                :style="{ width: scenario.remainingPercent + '%' }"
                :class="scenario.severity"
              ></div>
            </div>
          </div>
        </div>
        <p class="scenario-note">
          註：此模擬假設 0050 與 00675L 完全跟隨大盤變動，實際情況可能不同
        </p>
      </section>

      <!-- Portfolio Allocation -->
      <section v-if="portfolioSnapshot && inputs" class="detail-section">
        <h3 class="section-title">📊 配置建議</h3>
        <div class="allocation-box">
          <div class="allocation-current">
            <h4 class="allocation-subtitle">當前配置</h4>
            <div class="allocation-row">
              <span class="allocation-label">股票曝險</span>
              <span class="allocation-value">{{ formatPercent(exposureRatio) }}</span>
            </div>
            <div class="allocation-row">
              <span class="allocation-label">現金比例</span>
              <span class="allocation-value">{{ formatPercent(cashRatio) }}</span>
            </div>
          </div>
          <div class="allocation-suggestion">
            <h4 class="allocation-subtitle">建議配置</h4>
            <ul class="suggestion-list">
              <li v-if="exposureRatio <= 60">
                ✅ 當前配置保守，可承受較大波動
              </li>
              <li v-else-if="exposureRatio <= 80">
                ⚠️ 建議保留 30-40% 現金作為緩衝
              </li>
              <li v-else-if="exposureRatio <= 100">
                🔶 曝險偏高，建議降低至 80% 以下
              </li>
              <li v-else>
                🚨 使用槓桿中，需密切監控維持率
              </li>
              <li>依長期投資計畫定期定額，不追高殺低</li>
              <li>保留至少 20% 現金應對極端情況</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Exposure Calculation -->
      <section class="detail-section">
        <h3 class="section-title">計算公式</h3>
        <div class="formula-section">
          <h4 class="formula-title">1. 總方向曝險 (Gross Exposure)</h4>
          <div class="formula-box">
            <code>E_gross = V_0050 + (V_00675L × 2)</code>
          </div>
          <p class="formula-desc">
            00675L 乘以 2 倍是因為它是 2x 槓桿 ETF，實際方向曝險為市值的兩倍
          </p>

          <h4 class="formula-title">2. 曝險比例</h4>
          <div class="formula-box">
            <code>曝險比例 = (E_gross / 財務資本) × 100%</code>
          </div>
          <p class="formula-desc">
            衡量投資組合相對於總資本的曝險程度
          </p>

          <h4 class="formula-title">3. 現金比例</h4>
          <div class="formula-box">
            <code>現金比例 = 100% - 曝險比例</code>
          </div>
          <p class="formula-desc">
            可用於加碼或應對緊急情況的資金比例
          </p>
        </div>
      </section>

      <!-- Tobin Separation -->
      <section class="detail-section">
        <h3 class="section-title">托賓分離定理</h3>
        <div class="theory-box">
          <p class="theory-text">
            托賓分離定理（Tobin's Separation Theorem）指出：投資決策可分為兩個獨立步驟
          </p>
          <ol class="theory-list">
            <li><strong>資產配置</strong>：決定持有哪些風險資產（例如 0050）</li>
            <li><strong>槓桿決策</strong>：決定使用多少槓桿（例如 00675L）</li>
          </ol>
          <p class="theory-text">
            在本系統中：
          </p>
          <ul class="theory-list">
            <li>核心資產：0050（長期持有，定期定額）</li>
            <li>槓桿工具：00675L（依市場情緒調整配置）</li>
          </ul>
          <p class="theory-note">
            註：00675L 的產品成本（追蹤誤差、費用率）尚未完整建模，目前標示為 UNMODELED
          </p>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="detail-section">
        <div class="disclaimer-box">
          <h4 class="disclaimer-title">⚠️ 免責聲明</h4>
          <ul class="disclaimer-list">
            <li>極端情境模擬僅供參考，實際跌幅可能超出預期</li>
            <li>配置建議基於理論計算，非投資建議</li>
            <li>實際決策請考慮個人風險承受度與投資目標</li>
            <li>槓桿 ETF 具有波動耗損特性，不適合長期持有</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  theory: {
    type: Object,
    default: null,
  },
  portfolioSnapshot: {
    type: Object,
    default: null,
  },
  inputs: {
    type: Object,
    default: null,
  },
});

defineEmits(["back"]);

// Format currency amount
function formatAmount(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return (value / 10000).toFixed(1) + "萬";
}

// Format percentage
function formatPercent(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(0) + "%";
}

// Calculate exposure ratio
const exposureRatio = computed(() => {
  if (!props.theory?.grossExposure || !props.portfolioSnapshot?.accountNetAsset) {
    return null;
  }
  return (props.theory.grossExposure / props.portfolioSnapshot.accountNetAsset) * 100;
});

// Calculate cash ratio
const cashRatio = computed(() => {
  if (exposureRatio.value == null) return null;
  return Math.max(0, 100 - exposureRatio.value);
});

// Exposure ratio status class
const exposureRatioClass = computed(() => {
  if (exposureRatio.value == null) return "";
  
  const ratio = exposureRatio.value;
  if (ratio <= 60) return "status-safe";
  if (ratio <= 80) return "status-moderate";
  if (ratio <= 100) return "status-aggressive";
  return "status-extreme";
});

// Extreme scenario simulations
const scenarios = computed(() => {
  if (!props.theory?.grossExposure || !props.portfolioSnapshot?.accountNetAsset) {
    return [];
  }

  const grossExposure = props.theory.grossExposure;
  const netAsset = props.portfolioSnapshot.accountNetAsset;
  
  return [
    {
      drop: 10,
      loss: grossExposure * 0.1,
      remaining: netAsset - grossExposure * 0.1,
      remainingPercent: ((netAsset - grossExposure * 0.1) / netAsset) * 100,
      severity: "mild",
    },
    {
      drop: 20,
      loss: grossExposure * 0.2,
      remaining: netAsset - grossExposure * 0.2,
      remainingPercent: ((netAsset - grossExposure * 0.2) / netAsset) * 100,
      severity: "moderate",
    },
    {
      drop: 30,
      loss: grossExposure * 0.3,
      remaining: netAsset - grossExposure * 0.3,
      remainingPercent: ((netAsset - grossExposure * 0.3) / netAsset) * 100,
      severity: "severe",
    },
    {
      drop: 40,
      loss: grossExposure * 0.4,
      remaining: netAsset - grossExposure * 0.4,
      remainingPercent: ((netAsset - grossExposure * 0.4) / netAsset) * 100,
      severity: "extreme",
    },
  ];
});
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
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #666);
  margin: 0 0 12px 0;
}

.exposure-summary {
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.summary-row.highlight {
  padding-top: 14px;
  border-top: 1px solid var(--tg-theme-hint-color, #e0e0e0);
  margin-top: 8px;
}

.summary-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #666);
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.summary-value.primary {
  font-size: 18px;
  color: var(--tg-theme-link-color, #3390ec);
}

.summary-value.status-safe {
  color: #4caf50;
}

.summary-value.status-moderate {
  color: #ff9800;
}

.summary-value.status-aggressive {
  color: #ff5722;
}

.summary-value.status-extreme {
  color: #f44336;
}

.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scenario-item {
  padding: 14px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  border-left: 4px solid;
}

.scenario-item.mild {
  border-left-color: #4caf50;
}

.scenario-item.moderate {
  border-left-color: #ff9800;
}

.scenario-item.severe {
  border-left-color: #ff5722;
}

.scenario-item.extreme {
  border-left-color: #f44336;
}

.scenario-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.scenario-drop {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.scenario-loss {
  font-size: 15px;
  font-weight: 700;
  color: #f44336;
}

.scenario-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-label {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

.result-value {
  font-size: 15px;
  font-weight: 600;
}

.result-value.mild {
  color: #4caf50;
}

.result-value.moderate {
  color: #ff9800;
}

.result-value.severe {
  color: #ff5722;
}

.result-value.extreme {
  color: #f44336;
}

.scenario-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.scenario-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.scenario-bar-fill.mild {
  background: #4caf50;
}

.scenario-bar-fill.moderate {
  background: #ff9800;
}

.scenario-bar-fill.severe {
  background: #ff5722;
}

.scenario-bar-fill.extreme {
  background: #f44336;
}

.scenario-note {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  font-style: italic;
  margin: 12px 0 0 0;
}

.allocation-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.allocation-current,
.allocation-suggestion {
  padding: 14px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.allocation-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 10px 0;
}

.allocation-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;
}

.allocation-label {
  color: var(--tg-theme-hint-color, #666);
}

.allocation-value {
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.suggestion-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.8;
}

.suggestion-list li {
  margin-bottom: 6px;
}

.formula-section {
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.formula-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 16px 0 8px 0;
}

.formula-title:first-child {
  margin-top: 0;
}

.formula-box {
  padding: 10px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 6px;
  margin-bottom: 8px;
  text-align: center;
}

.formula-box code {
  font-family: "Courier New", monospace;
  font-size: 14px;
  color: var(--tg-theme-text-color, #222);
}

.formula-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.theory-box,
.disclaimer-box {
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.theory-text {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.theory-list {
  margin: 12px 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.8;
}

.theory-list li {
  margin-bottom: 6px;
}

.theory-note {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  font-style: italic;
  margin: 8px 0 0 0;
}

.disclaimer-box {
  background: rgba(158, 158, 158, 0.1);
  border-left: 4px solid #9e9e9e;
}

.disclaimer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 8px 0;
}

.disclaimer-list {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.8;
}

.disclaimer-list li {
  margin-bottom: 6px;
}
</style>
