<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title"><Icon name="shield" size="sm" color="var(--iln-brand)" /> 托賓分離定理詳細分析</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory || !theory.tobinSeparation" class="detail-unavailable">
      <p><Icon name="warn" size="sm" color="var(--iln-warn)" /> 理論數據未計算</p>
      <span class="detail-hint">非交易日或資產數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Current Status -->
      <section class="detail-section">
        <h3 class="section-title">當前狀態</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">風險資產比例</span>
            <span class="status-value large">{{ formatPercent(riskyRatio) }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">無風險資產比例</span>
            <span class="status-value large">{{ formatPercent(riskFreeRatio) }}</span>
          </div>
          <div class="status-item" v-if="tobinStatus">
            <span class="status-label">計算狀態</span>
            <span class="status-value">{{ tobinStatus }}</span>
          </div>
        </div>
      </section>

      <!-- Theory Explanation -->
      <section class="detail-section">
        <h3 class="section-title">理論說明</h3>
        <div class="theory-box">
          <h4 class="theory-subtitle">托賓分離定理 (Tobin Separation)</h4>
          <p class="theory-desc">
            托賓分離定理將投資決策分為兩個獨立步驟：先決定風險資產與無風險資產的最佳配比，
            再根據個人風險偏好調整總槓桿。無風險資產（如 00740B 債券）作為穩定錨點。
          </p>
          <div class="formula-box">
            <span class="formula-label">公式</span>
            <span class="formula-expression">riskyRatio = riskyAssetValue / totalAssets</span>
          </div>
        </div>
      </section>

      <!-- Asset Allocation -->
      <section class="detail-section">
        <h3 class="section-title">資產配置分析</h3>
        <div class="allocation-grid">
          <div class="allocation-item">
            <span class="allocation-label">風險資產 (0050 等)</span>
            <span class="allocation-value">{{ formatPercent(riskyRatio) }}</span>
          </div>
          <div class="allocation-item">
            <span class="allocation-label">無風險資產 (00740B 等)</span>
            <span class="allocation-value">{{ formatPercent(riskFreeRatio) }}</span>
          </div>
        </div>
        <p class="allocation-note">
          無風險資產比例越高，組合越穩健；風險資產比例越高，預期報酬與波動皆增加。
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
        <p class="disclaimer-text">          <Icon name="warn" size="sm" color="var(--iln-warn)" /> 僅供理論參考，不構成投資建議。托賓分離結果為 SHADOW_ONLY，不影響 P0 固定 DCA 執行。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  theory: { type: Object, required: true },
});

const tobinData = computed(() => props.theory.tobinSeparation);
const riskyRatio = computed(() => tobinData.value?.riskyRatio ?? 0);
const riskFreeRatio = computed(() => tobinData.value?.riskFreeRatio ?? 0);
const tobinStatus = computed(() => tobinData.value?.status ?? "—");

const zoneLabel = computed(() => {
  const r = riskyRatio.value;
  if (r >= 0.8) return "高風險";
  if (r >= 0.5) return "中風險";
  if (r > 0) return "低風險";
  return "無數據";
});

const zoneAction = computed(() => {
  const status = tobinStatus.value;
  if (status === "UNAVAILABLE") return "等待 dailyCheck 排程計算";
  if (riskyRatio.value >= 0.8) return "建議降低風險資產比例，增加無風險配置";
  return "維持 P0 DCA 執行，定期檢視配比";
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

.allocation-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.allocation-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 6px;
}

.allocation-label {
  font-size: 14px;
  color: var(--tg-theme-text-color);
}

.allocation-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color);
}

.allocation-note {
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
