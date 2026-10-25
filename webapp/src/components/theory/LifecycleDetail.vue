<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title">💼 生命週期投資詳細分析</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory" class="detail-unavailable">
      <p>⚠️ 理論數據未計算</p>
      <span class="detail-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Life Timeline -->
      <section class="detail-section">
        <h3 class="section-title">人生時間軸</h3>
        <div class="timeline-box">
          <div class="timeline-item current">
            <span class="timeline-label">當前年齡</span>
            <span class="timeline-value">33 歲</span>
          </div>
          <div class="timeline-arrow">→</div>
          <div class="timeline-item">
            <span class="timeline-label">剩餘工作年限</span>
            <span class="timeline-value highlight">32 年</span>
          </div>
          <div class="timeline-arrow">→</div>
          <div class="timeline-item target">
            <span class="timeline-label">退休目標</span>
            <span class="timeline-value">65 歲</span>
          </div>
        </div>
      </section>

      <!-- Theory Explanation -->
      <section class="detail-section">
        <h3 class="section-title">理論說明</h3>
        <div class="theory-box">
          <h4 class="theory-subtitle">生命週期投資理論（Life-Cycle Investing）</h4>
          <p class="theory-text">
            由諾貝爾經濟學獎得主 Robert Merton 提出，核心概念：
          </p>
          <ul class="theory-list">
            <li><strong>人力資本</strong>：未來工作收入的現值，類似「人生債券」</li>
            <li><strong>財務資本</strong>：已累積的金融資產</li>
            <li><strong>總資本</strong> = 人力資本 + 財務資本</li>
          </ul>
          <p class="theory-text">
            年輕時人力資本大、財務資本小，可承受較高風險；接近退休時相反，應降低風險。
          </p>
        </div>
      </section>

      <!-- Human Capital -->
      <section class="detail-section">
        <h3 class="section-title">人力資本分析</h3>
        <div class="hc-status-box">
          <div class="hc-row">
            <span class="hc-label">人力資本 (HC)</span>
            <span class="hc-value">{{ formatHumanCapital(theory.humanCapital) }}</span>
          </div>
          <div v-if="!theory.humanCapital" class="hc-missing">
            <h4 class="missing-title">⚠️ 人力資本未計算</h4>
            <p class="missing-text">需要以下資料才能計算：</p>
            <ul class="missing-list">
              <li>稅後月收入或年收入</li>
              <li>可投入投資的現金流比例</li>
              <li>預期收入成長率</li>
              <li>折現率（通常為 3-5%）</li>
            </ul>
            <div class="formula-box">
              <code>HC = Σ (可投資現金流_t / (1 + 折現率)^t)</code>
            </div>
            <p class="missing-note">
              註：目前系統僅記錄每月 DCA 金額（3萬），但這不等於薪資或完整人力資本
            </p>
          </div>
          <div v-else class="hc-breakdown">
            <p class="breakdown-text">
              人力資本代表未來 32 年工作期間可投入投資的現金流總現值
            </p>
          </div>
        </div>
      </section>

      <!-- True Exposure -->
      <section v-if="theory.trueExposure != null" class="detail-section">
        <h3 class="section-title">人生真實曝險</h3>
        <div class="true-exposure-box">
          <div class="te-display">
            <span class="te-label">True Exposure</span>
            <span class="te-value" :class="trueExposureClass">
              {{ formatPercent(theory.trueExposure * 100) }}
            </span>
          </div>
          <div class="formula-box">
            <code>TrueExposure = 投資曝險 / (財務資本 + 人力資本)</code>
          </div>
          <p class="te-explanation">
            相比只看財務資本的曝險比例，真實曝險考慮了人力資本這個「隱性資產」，
            更真實地反映整體財務狀況的風險暴露。
          </p>
        </div>
      </section>
      <section v-else class="detail-section">
        <div class="warning-box">
          <h4 class="warning-title">⚠️ 真實曝險未計算</h4>
          <p class="warning-text">
            需要人力資本數據才能計算人生真實曝險。
          </p>
        </div>
      </section>

      <!-- Age-Based Strategy -->
      <section class="detail-section">
        <h3 class="section-title">年齡分段策略</h3>
        <div class="age-strategy-list">
          <div class="age-phase current">
            <div class="phase-header">
              <span class="phase-icon">✅</span>
              <span class="phase-name">累積期（30-45 歲）</span>
            </div>
            <p class="phase-desc"><strong>當前所在階段</strong></p>
            <ul class="phase-list">
              <li>人力資本充沛，財務資本較少</li>
              <li>可承受較高風險，採取積極配置</li>
              <li>定期定額建立核心部位</li>
              <li>保持低槓桿（&lt;1.5x）避免極端風險</li>
            </ul>
          </div>
          <div class="age-phase">
            <div class="phase-header">
              <span class="phase-icon">⏳</span>
              <span class="phase-name">成長期（45-55 歲）</span>
            </div>
            <p class="phase-desc">距離 12 年後</p>
            <ul class="phase-list">
              <li>財務資本顯著增加</li>
              <li>逐步降低風險曝險</li>
              <li>減少槓桿使用頻率</li>
              <li>增加債券配置至 20-30%</li>
            </ul>
          </div>
          <div class="age-phase">
            <div class="phase-header">
              <span class="phase-icon">🎯</span>
              <span class="phase-name">保本期（55-65 歲）</span>
            </div>
            <p class="phase-desc">距離 22 年後</p>
            <ul class="phase-list">
              <li>接近退休，財務資本達高峰</li>
              <li>大幅降低股票曝險至 50-60%</li>
              <li>完全停止槓桿操作</li>
              <li>債券配置提高至 40-50%</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Lifecycle Advantage -->
      <section class="detail-section">
        <h3 class="section-title">💡 你的生命週期優勢</h3>
        <div class="advantage-box">
          <div class="advantage-item">
            <h4 class="advantage-title">⏰ 時間優勢</h4>
            <p class="advantage-text">
              距離退休還有 <strong>32 年</strong>，是股市歷史上任何熊市恢復時間（平均 3-5 年）的數倍。
              即使遭遇 50% 大跌，仍有充足時間讓市場恢復並繼續成長。
            </p>
          </div>
          <div class="advantage-item">
            <h4 class="advantage-title">📈 複利優勢</h4>
            <p class="advantage-text">
              32 年的複利成長是財富累積的核心動力。假設年化 8% 報酬，
              現有 211 萬在 32 年後將成長至約 <strong>2,515 萬</strong>（不含新增投入）。
            </p>
          </div>
          <div class="advantage-item">
            <h4 class="advantage-title">💰 現金流優勢</h4>
            <p class="advantage-text">
              持續的工作收入可用於逢低加碼，將市場下跌轉化為累積部位的機會。
              定期定額策略充分利用這個優勢。
            </p>
          </div>
        </div>
      </section>

      <!-- Best Practices -->
      <section class="detail-section">
        <h3 class="section-title">行動建議</h3>
        <div class="practices-box">
          <ul class="practices-list">
            <li>✅ <strong>維持定期定額</strong>：每月 3 萬持續投入，不受短期波動影響</li>
            <li>✅ <strong>控制槓桿水位</strong>：維持在 1.5x 以下，避免極端風險</li>
            <li>✅ <strong>保留緊急預備金</strong>：至少 6 個月生活費</li>
            <li>⚠️ <strong>定期檢視配置</strong>：每年根據年齡和市況微調</li>
            <li>⚠️ <strong>避免情緒決策</strong>：市場恐慌時不恐慌性賣出</li>
            <li>📊 <strong>記錄收入數據</strong>：未來可計算完整人力資本</li>
          </ul>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="detail-section">
        <div class="disclaimer-box">
          <h4 class="disclaimer-title">⚠️ 免責聲明</h4>
          <ul class="disclaimer-list">
            <li>生命週期理論基於統計平均，個人情況可能不同</li>
            <li>未來收入與市場報酬均具不確定性</li>
            <li>本分析僅供參考，非財務規劃建議</li>
            <li>實際投資決策應考慮個人完整財務狀況</li>
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
});

defineEmits(["back"]);

// Format human capital
function formatHumanCapital(value) {
  if (value == null || !Number.isFinite(value)) return "未計算";
  return (value / 10000).toFixed(0) + "萬";
}

// Format percentage
function formatPercent(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(0) + "%";
}

// True exposure status class
const trueExposureClass = computed(() => {
  if (props.theory?.trueExposure == null) return "";
  
  const ratio = props.theory.trueExposure * 100;
  if (ratio <= 50) return "te-low";
  if (ratio <= 80) return "te-moderate";
  return "te-high";
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
  margin: 0 0 12px 0;
}

.timeline-box {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  overflow-x: auto;
}

.timeline-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 8px;
  min-width: 90px;
}

.timeline-item.current {
  border: 2px solid var(--tg-theme-link-color, #3390ec);
}

.timeline-item.target {
  border: 2px solid #4caf50;
}

.timeline-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 4px;
  text-align: center;
}

.timeline-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.timeline-value.highlight {
  color: var(--tg-theme-link-color, #3390ec);
  font-size: 16px;
}

.timeline-arrow {
  margin: 0 8px;
  font-size: 18px;
  color: var(--tg-theme-hint-color, #999);
  flex-shrink: 0;
}

.theory-box,
.hc-status-box,
.true-exposure-box,
.warning-box,
.disclaimer-box {
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.theory-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 8px 0;
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

.hc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.hc-label {
  font-size: 14px;
  color: var(--tg-theme-hint-color, #666);
}

.hc-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}

.hc-missing,
.hc-breakdown {
  padding-top: 12px;
  border-top: 1px solid var(--tg-theme-hint-color, #e0e0e0);
}

.missing-title,
.warning-title,
.disclaimer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 8px 0;
}

.missing-text,
.warning-text {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  margin: 0 0 8px 0;
}

.missing-list,
.disclaimer-list {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.8;
}

.missing-list li,
.disclaimer-list li {
  margin-bottom: 6px;
}

.formula-box {
  padding: 10px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 6px;
  margin: 12px 0;
  text-align: center;
}

.formula-box code {
  font-family: "Courier New", monospace;
  font-size: 13px;
  color: var(--tg-theme-text-color, #222);
}

.missing-note {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  font-style: italic;
  margin: 8px 0 0 0;
}

.breakdown-text {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
  margin: 0;
}

.te-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.te-label {
  font-size: 14px;
  color: var(--tg-theme-hint-color, #666);
}

.te-value {
  font-size: 24px;
  font-weight: 700;
}

.te-value.te-low {
  color: #4caf50;
}

.te-value.te-moderate {
  color: #ff9800;
}

.te-value.te-high {
  color: #f44336;
}

.te-explanation {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.6;
  margin: 12px 0 0 0;
}

.age-strategy-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.age-phase {
  padding: 14px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  border-left: 4px solid #ccc;
}

.age-phase.current {
  border-left-color: var(--tg-theme-link-color, #3390ec);
  background: rgba(51, 144, 236, 0.05);
}

.phase-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.phase-icon {
  font-size: 16px;
}

.phase-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.phase-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  margin: 0 0 8px 0;
}

.phase-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.8;
}

.phase-list li {
  margin-bottom: 4px;
}

.advantage-box {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.advantage-item {
  padding: 14px;
  background: rgba(76, 175, 80, 0.08);
  border-left: 3px solid #4caf50;
  border-radius: 8px;
}

.advantage-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 6px 0;
}

.advantage-text {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
  margin: 0;
}

.advantage-text strong {
  color: #4caf50;
  font-weight: 600;
}

.practices-box {
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.practices-list {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 2;
}

.practices-list li {
  margin-bottom: 8px;
}

.warning-box {
  background: rgba(255, 152, 0, 0.1);
  border-left: 4px solid #ff9800;
}

.disclaimer-box {
  background: rgba(158, 158, 158, 0.1);
  border-left: 4px solid #9e9e9e;
}
</style>
