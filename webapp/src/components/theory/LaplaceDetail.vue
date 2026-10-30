<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title">⚖️ 拉普拉斯準則詳細分析</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory || !theory.laplaceCriterion" class="detail-unavailable">
      <p>⚠️ 理論數據未計算</p>
      <span class="detail-hint">非交易日或壓力情境數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Current Status -->
      <section class="detail-section">
        <h3 class="section-title">當前狀態</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">最小最大損失</span>
            <span class="status-value large">{{ formatPercent(minimaxLoss) }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">最壞情境</span>
            <span class="status-value">{{ worstScenario }}</span>
          </div>
          <div class="status-item" v-if="laplaceStatus">
            <span class="status-label">計算狀態</span>
            <span class="status-value">{{ laplaceStatus }}</span>
          </div>
        </div>
      </section>

      <!-- Theory Explanation -->
      <section class="detail-section">
        <h3 class="section-title">理論說明</h3>
        <div class="theory-box">
          <h4 class="theory-subtitle">拉普拉斯準則 (Laplace Criterion)</h4>
          <p class="theory-desc">
            拉普拉斯準則採用「最小化最大損失」(Minimax) 原則。在多個壓力情境中，
            選擇最壞損失最小的方案，以確保極端情況下的資產安全。
          </p>
          <div class="formula-box">
            <span class="formula-label">公式</span>
            <span class="formula-expression">minimaxLoss = min(scenarios, key → maxLoss)</span>
          </div>
        </div>
      </section>

      <!-- Scenario Detail -->
      <section class="detail-section">
        <h3 class="section-title">壓力情境細節</h3>
        <div class="scenario-list">
          <div class="scenario-item">
            <span class="scenario-name">COVID 熔斷</span>
            <span class="scenario-loss">40% 最大損失</span>
          </div>
          <div class="scenario-item">
            <span class="scenario-name">熊市震盪</span>
            <span class="scenario-loss">25% 最大損失</span>
          </div>
          <div class="scenario-item">
            <span class="scenario-name">閃崩</span>
            <span class="scenario-loss">35% 最大損失</span>
          </div>
          <div class="scenario-item">
            <span class="scenario-name">估值回歸</span>
            <span class="scenario-loss">20% 最大損失</span>
          </div>
        </div>
        <p class="scenario-note">
          以上為 dailyCheck 排程內建的四個標準壓力情境，每日由後端執行並更新數據。
        </p>
      </section>

      <!-- Zone Judgment -->
      <section class="detail-section">
        <h3 class="section-title">區域判斷</h3>
        <div class="zone-item">
          <span class="zone-label">風險等級</span>
          <span class="zone-value">{{ zoneLabel }}</span>
        </div>
        <div class="zone-item">
          <span class="zone-label">建議行動</span>
          <span class="zone-value">{{ zoneAction }}</span>
        </div>
      </section>

      <!-- Disclaimer -->
      <div class="disclaimer-box">
        <p class="disclaimer-text">
          ⚠️ 僅供理論參考，不構成投資建議。拉普拉斯準則結果為 SHADOW_ONLY，不影響 P0 固定 DCA 執行。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  theory: { type: Object, required: true },
});

const laplaceData = computed(() => props.theory.laplaceCriterion);
const minimaxLoss = computed(() => laplaceData.value?.minimaxLoss ?? 0);
const worstScenario = computed(() => laplaceData.value?.worstScenario ?? "—");
const laplaceStatus = computed(() => laplaceData.value?.status ?? "—");

const zoneLabel = computed(() => {
  const loss = minimaxLoss.value;
  if (loss >= 0.35) return "高風險";
  if (loss >= 0.25) return "中風險";
  if (loss > 0) return "低風險";
  return "無數據";
});

const zoneAction = computed(() => {
  const status = laplaceStatus.value;
  if (status === "UNAVAILABLE") return "等待 dailyCheck 排程計算";
  if (minimaxLoss.value >= 0.35) return "建議觀望，暫緩條件加碼 (P1)";
  return "維持 P0 DCA 執行，觀察市場變化";
});

function formatPercent(value) {
  if (value == null) return "—";
  return (value * 100).toFixed(0) + "%";
}
</script>

<style scoped>
.detail-page {
  background: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tg-theme-border-color);
}

.back-btn {
  padding: 6px 12px;
  background: var(--tg-theme-button-bg);
  color: var(--tg-theme-button-text);
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.back-btn:hover {
  opacity: 0.9;
}

.detail-title {
  margin: 0;
  font-size: 20px;
  color: var(--tg-theme-text-color);
}

.detail-unavailable {
  padding: 16px;
  background: rgba(128, 128, 128, 0.1);
  border: 1px dashed var(--tg-theme-border-color);
  border-radius: 6px;
  color: var(--tg-theme-text-color);
  text-align: center;
}

.detail-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.7;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: var(--tg-theme-text-color);
  border-bottom: 1px solid var(--tg-theme-border-color);
  padding-bottom: 4px;
}

.status-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 6px;
}

.status-label {
  font-size: 14px;
  color: var(--tg-theme-text-color);
  opacity: 0.7;
}

.status-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color);
}

.status-value.large {
  font-size: 18px;
}

.theory-box {
  padding: 12px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 6px;
}

.theory-subtitle {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: var(--tg-theme-text-color);
}

.theory-desc {
  margin: 0 0 10px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--tg-theme-text-color);
  opacity: 0.9;
}

.formula-box {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: var(--tg-theme-bg-color);
  border: 1px solid var(--tg-theme-border-color);
  border-radius: 4px;
}

.formula-label {
  font-size: 13px;
  color: var(--tg-theme-text-color);
  opacity: 0.7;
}

.formula-expression {
  font-size: 14px;
  font-family: monospace;
  color: var(--tg-theme-text-color);
}

.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scenario-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 6px;
}

.scenario-name {
  font-size: 14px;
  color: var(--tg-theme-text-color);
}

.scenario-loss {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color);
}

.scenario-note {
  margin-top: 8px;
  font-size: 12px;
  color: var(--tg-theme-text-color);
  opacity: 0.6;
}

.zone-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 6px;
}

.zone-label {
  font-size: 14px;
  color: var(--tg-theme-text-color);
  opacity: 0.7;
}

.zone-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color);
}

.disclaimer-box {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 152, 0, 0.05);
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 6px;
}

.disclaimer-text {
  margin: 0;
  font-size: 12px;
  color: var(--tg-theme-text-color);
  opacity: 0.8;
}
</style>
