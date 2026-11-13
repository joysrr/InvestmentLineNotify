<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> 凱莉槓桿詳細分析</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory" class="detail-unavailable">
      <p><Icon name="warn" size="sm" color="var(--iln-warn)" /> 理論數據未計算</p>
      <span class="detail-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Current Status -->
      <section class="detail-section">
        <h3 class="section-title">當前狀態</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">當前槓桿</span>
            <span class="status-value large">{{ formatLeverage(theory.currentLeverage) }}</span>
          </div>
          <div class="status-item" v-if="hasKellyLimits">
            <span class="status-label">保守凱莉 (50%)</span>
            <span class="status-value">{{ formatLeverage(theory.kellyLimits.conservative) }}</span>
          </div>
          <div class="status-item" v-if="hasKellyLimits">
            <span class="status-label">完全凱莉 (100%)</span>
            <span class="status-value">{{ formatLeverage(theory.kellyLimits.full) }}</span>
          </div>
        </div>
      </section>

      <!-- Theory Explanation -->
      <section class="detail-section">
        <h3 class="section-title">理論說明</h3>
        <div class="theory-box">
          <h4 class="theory-subtitle">凱莉公式（Kelly Criterion）</h4>
          <p class="theory-text">
            凱莉公式計算幾何成長最大化的最佳槓桿倍數，用於避免過度槓桿導致的破產風險。
          </p>
          <div class="formula-box">
            <code class="formula">L* = (μ - r) / σ²</code>
          </div>
          <ul class="theory-list">
            <li><strong>μ</strong>: 預期年化報酬率</li>
            <li><strong>r</strong>: 借款利率 + 產品成本</li>
            <li><strong>σ²</strong>: 報酬率變異數</li>
            <li><strong>L*</strong>: 完全凱莉槓桿（理論最大值）</li>
          </ul>
          <p class="theory-note">            <Icon name="default" size="sm" color="var(--iln-hint)" /> 保守凱莉 = 0.5 × L*，用於降低波動風險
          </p>
        </div>
      </section>

      <!-- Kelly Limits Status -->
      <section v-if="hasKellyLimits" class="detail-section">
        <h3 class="section-title">槓桿區間判斷</h3>
        <div class="leverage-zones">
          <div class="zone-item safe">
            <div class="zone-header">
              <span class="zone-icon"><Icon name="ok" size="sm" color="var(--iln-ok)" /></span>
              <span class="zone-name">安全區</span>
            </div>
            <p class="zone-range">0x ~ {{ formatLeverage(theory.kellyLimits.conservative) }}</p>
            <p class="zone-desc">低於保守凱莉，長期幾何成長穩健</p>
          </div>
          <div class="zone-item moderate">
            <div class="zone-header">
              <span class="zone-icon"><Icon name="warn" size="sm" color="var(--iln-warn)" /></span>
              <span class="zone-name">適中區</span>
            </div>
            <p class="zone-range">{{ formatLeverage(theory.kellyLimits.conservative) }} ~ {{ formatLeverage(theory.kellyLimits.full) }}</p>
            <p class="zone-desc">介於保守與完全凱莉之間，波動增加</p>
          </div>
          <div class="zone-item high">
            <div class="zone-header">
              <span class="zone-icon"><Icon name="danger" size="sm" color="var(--iln-danger)" /></span>
              <span class="zone-name">高風險區</span>
            </div>
            <p class="zone-range">> {{ formatLeverage(theory.kellyLimits.full) }}</p>
            <p class="zone-desc">超過完全凱莉，長期破產風險上升</p>
          </div>
        </div>
      </section>

      <!-- No Kelly Limits Warning -->
      <section v-else class="detail-section">
        <div class="warning-box">
          <h4 class="warning-title"><Icon name="warn" size="sm" color="var(--iln-warn)" /> 凱莉槓桿未計算</h4>
          <p class="warning-text">
            需要以下參數才能計算凱莉槓桿限制：
          </p>
          <ul class="warning-list">
            <li>預期報酬率 (μ)</li>
            <li>報酬率標準差 (σ)</li>
            <li>借款利率</li>
            <li>產品成本調整</li>
          </ul>
          <p class="warning-note">
            目前系統尚未配置這些研究參數，因此無法提供凱莉槓桿建議。
          </p>
        </div>
      </section>

      <!-- Gross Exposure -->
      <section v-if="theory.grossExposure != null" class="detail-section">
        <h3 class="section-title">總方向曝險計算</h3>
        <div class="calculation-box">
          <p class="calc-label">總曝險 (Gross Exposure)</p>
          <div class="calc-formula">
            <code>E_gross = V_0050 + (V_00675L × 2)</code>
          </div>
          <div class="calc-result">
            <span class="calc-value">{{ formatAmount(theory.grossExposure) }}</span>
          </div>
          <p class="calc-note">
            註：00675L 乘以 2 是方向曝險近似，不代表長期報酬模型
          </p>
        </div>
      </section>

      <!-- Current Leverage Calculation -->
      <section v-if="theory.currentLeverage != null && portfolioSnapshot" class="detail-section">
        <h3 class="section-title">當前槓桿計算</h3>
        <div class="calculation-box">
          <p class="calc-label">當前總槓桿 (Current Leverage)</p>
          <div class="calc-formula">
            <code>L_current = E_gross / FC</code>
          </div>
          <div class="calc-breakdown">
            <div class="breakdown-row">
              <span>總曝險 (E_gross)</span>
              <span>{{ formatAmount(theory.grossExposure) }}</span>
            </div>
            <div class="breakdown-row">
              <span>財務資本 (FC)</span>
              <span>{{ formatAmount(portfolioSnapshot.accountNetAsset) }}</span>
            </div>
            <div class="breakdown-divider"></div>
            <div class="breakdown-row result">
              <span>當前槓桿</span>
              <span>{{ formatLeverage(theory.currentLeverage) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="detail-section">
        <div class="disclaimer-box">
          <h4 class="disclaimer-title"><Icon name="warn" size="sm" color="var(--iln-warn)" /> 免責聲明</h4>
          <ul class="disclaimer-list">
            <li>凱莉公式僅供研究參考，非投資建議</li>
            <li>實際決策請參考既有風控機制（維持率、槓桿天花板）</li>
            <li>市場條件變化時，理論參數需要重新校準</li>
            <li>本系統目前處於研究階段 (RESEARCH_ONLY)</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  theory: {
    type: Object,
    default: null,
  },
  portfolioSnapshot: {
    type: Object,
    default: null,
  },
});

defineEmits(["back"]);

// Check if Kelly limits are available
const hasKellyLimits = computed(() => {
  return (
    props.theory?.kellyLimits &&
    props.theory.kellyLimits.conservative != null &&
    props.theory.kellyLimits.full != null
  );
});

// Format leverage value
function formatLeverage(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2) + "x";
}

// Format currency amount
function formatAmount(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return (value / 10000).toFixed(1) + "萬";
}
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
  background: rgba(76, 175, 80, 0.1);
  border-left-color: var(--iln-ok-text);
}

.zone-item.moderate {
  background: rgba(255, 152, 0, 0.1);
  border-left-color: var(--iln-warn-text);
}

.zone-item.high {
  background: rgba(244, 67, 54, 0.1);
  border-left-color: var(--iln-danger-text);
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

.calc-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--iln-hint);
  margin: 0 0 8px 0;
}

.calc-formula {
  padding: 10px;
  background: var(--iln-bg);
  border-radius: 6px;
  margin-bottom: 12px;
  text-align: center;
}

.calc-formula code {
  font-family: "Courier New", monospace;
  font-size: 14px;
  color: var(--iln-text);
}

.calc-result {
  text-align: center;
  margin: 12px 0;
}

.calc-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--iln-link);
}

.calc-breakdown {
  padding: 12px;
  background: var(--iln-bg);
  border-radius: 6px;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;
  color: var(--iln-text);
}

.breakdown-row.result {
  font-size: 15px;
  font-weight: 600;
  color: var(--iln-text);
}

.breakdown-divider {
  height: 1px;
  background: var(--iln-hint);
  margin: 8px 0;
}

.warning-box {
  background: rgba(255, 152, 0, 0.1);
  border-left: 4px solid var(--iln-warn-text);
}

.disclaimer-box {
  background: rgba(158, 158, 158, 0.1);
  border-left: 4px solid var(--iln-hint);
}
</style>
