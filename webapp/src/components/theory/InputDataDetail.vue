<template>
  <div class="detail-page">
    <div class="detail-header">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <h2 class="detail-title">📋 輸入數據詳細資訊</h2>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!inputs" class="detail-unavailable">
      <p>⚠️ 輸入數據未提供</p>
      <span class="detail-hint">非交易日或數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="detail-content">
      <!-- Data Overview -->
      <section class="detail-section">
        <h3 class="section-title">數據來源說明</h3>
        <div class="overview-box">
          <p class="overview-text">
            理論計算所使用的輸入數據來自 <strong>每日報告的 Portfolio Snapshot</strong>，
            結合市場即時股價計算得出。
          </p>
          <ul class="overview-list">
            <li>✅ 數據來源：持倉快照 + 市場報價</li>
            <li>✅ 驗證狀態：VERIFIED（已通過資料驗證）</li>
            <li>✅ 更新頻率：每日交易日收盤後</li>
          </ul>
        </div>
      </section>

      <!-- Detailed Data Table -->
      <section class="detail-section">
        <h3 class="section-title">詳細數據表</h3>
        
        <!-- 0050 -->
        <div v-if="inputs.value0050" class="data-card">
          <div class="data-header">
            <h4 class="data-title">元大台灣50 (0050)</h4>
            <span class="data-badge verified">{{ inputs.value0050.status }}</span>
          </div>
          <div class="data-grid">
            <div class="data-row">
              <span class="data-label">市值</span>
              <span class="data-value primary">{{ formatAmount(inputs.value0050.value) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">單位</span>
              <span class="data-value">{{ inputs.value0050.unit || "TWD" }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">數據來源</span>
              <span class="data-value source">{{ formatSource(inputs.value0050.source) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">時間戳</span>
              <span class="data-value time">{{ formatTime(inputs.value0050.asOf) }}</span>
            </div>
          </div>
        </div>

        <!-- 00675L -->
        <div v-if="inputs.value00675L" class="data-card">
          <div class="data-header">
            <h4 class="data-title">富邦台灣加權正2 (00675L)</h4>
            <span class="data-badge verified">{{ inputs.value00675L.status }}</span>
          </div>
          <div class="data-grid">
            <div class="data-row">
              <span class="data-label">市值</span>
              <span class="data-value primary">{{ formatAmount(inputs.value00675L.value) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">單位</span>
              <span class="data-value">{{ inputs.value00675L.unit || "TWD" }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">數據來源</span>
              <span class="data-value source">{{ formatSource(inputs.value00675L.source) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">時間戳</span>
              <span class="data-value time">{{ formatTime(inputs.value00675L.asOf) }}</span>
            </div>
          </div>
        </div>

        <!-- Total Debt -->
        <div v-if="inputs.totalDebt" class="data-card">
          <div class="data-header">
            <h4 class="data-title">總負債 (融資借款)</h4>
            <span class="data-badge verified">{{ inputs.totalDebt.status }}</span>
          </div>
          <div class="data-grid">
            <div class="data-row">
              <span class="data-label">金額</span>
              <span class="data-value primary">{{ formatAmount(inputs.totalDebt.value) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">單位</span>
              <span class="data-value">{{ inputs.totalDebt.unit || "TWD" }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">數據來源</span>
              <span class="data-value source">{{ formatSource(inputs.totalDebt.source) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">時間戳</span>
              <span class="data-value time">{{ formatTime(inputs.totalDebt.asOf) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Data Provenance -->
      <section class="detail-section">
        <h3 class="section-title">數據溯源 (Data Provenance)</h3>
        <div class="provenance-box">
          <h4 class="provenance-title">資料流程</h4>
          <div class="flow-diagram">
            <div class="flow-step">
              <span class="flow-number">1</span>
              <span class="flow-text">券商帳戶持倉</span>
            </div>
            <div class="flow-arrow">↓</div>
            <div class="flow-step">
              <span class="flow-number">2</span>
              <span class="flow-text">Portfolio Snapshot</span>
            </div>
            <div class="flow-arrow">↓</div>
            <div class="flow-step">
              <span class="flow-number">3</span>
              <span class="flow-text">市場報價 API</span>
            </div>
            <div class="flow-arrow">↓</div>
            <div class="flow-step">
              <span class="flow-number">4</span>
              <span class="flow-text">計算市值</span>
            </div>
            <div class="flow-arrow">↓</div>
            <div class="flow-step">
              <span class="flow-number">5</span>
              <span class="flow-text">理論計算引擎</span>
            </div>
          </div>
          <p class="provenance-note">
            所有數據在進入理論計算前都經過 <strong>verifiedPortfolioFields</strong> 模組驗證，
            確保資料完整性與一致性。
          </p>
        </div>
      </section>

      <!-- Source Code Explanation -->
      <section class="detail-section">
        <h3 class="section-title">數據來源代碼說明</h3>
        <div class="code-explanation">
          <div class="code-item">
            <h4 class="code-title">DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES</h4>
            <p class="code-desc">
              從持倉欄位（股數）結合市場即時價格計算得出的市值。
              這是最常見的數據來源，代表系統自動計算的結果。
            </p>
            <div class="code-formula">
              <code>市值 = 持有股數 × 當前股價</code>
            </div>
          </div>
        </div>
      </section>

      <!-- Data Timestamp -->
      <section v-if="reportDate" class="detail-section">
        <h3 class="section-title">報告時間資訊</h3>
        <div class="timestamp-box">
          <div class="timestamp-row">
            <span class="timestamp-label">報告日期</span>
            <span class="timestamp-value">{{ reportDate }}</span>
          </div>
          <p class="timestamp-note">
            非交易日（週末、假日）的報告使用最近一個交易日的收盤價格計算。
          </p>
        </div>
      </section>

      <!-- Data Quality -->
      <section class="detail-section">
        <h3 class="section-title">資料品質保證</h3>
        <div class="quality-box">
          <ul class="quality-list">
            <li>
              <strong>✅ 完整性檢查</strong>
              <p>確保所有必要欄位（股數、價格、時間戳）都存在</p>
            </li>
            <li>
              <strong>✅ 一致性驗證</strong>
              <p>確保 0050 與 00675L 的價格時間戳一致</p>
            </li>
            <li>
              <strong>✅ 合理性檢驗</strong>
              <p>檢查數值是否在合理範圍內（例如股價不為負）</p>
            </li>
            <li>
              <strong>✅ 溯源記錄</strong>
              <p>保留數據來源與計算路徑，可追溯驗證</p>
            </li>
          </ul>
        </div>
      </section>

      <!-- Disclaimer -->
      <section class="detail-section">
        <div class="disclaimer-box">
          <h4 class="disclaimer-title">⚠️ 注意事項</h4>
          <ul class="disclaimer-list">
            <li>市場報價可能存在延遲（通常 &lt; 1 分鐘）</li>
            <li>非交易時段使用最近收盤價，非即時數據</li>
            <li>極端市況下（漲跌停、暫停交易）報價可能不準確</li>
            <li>數據僅供理論計算使用，不作為交易依據</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  inputs: {
    type: Object,
    default: null,
  },
  reportDate: {
    type: String,
    default: null,
  },
});

defineEmits(["back"]);

// Format currency amount
function formatAmount(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0萬";
  return (value / 10000).toFixed(1) + "萬";
}

// Format source
function formatSource(source) {
  if (!source) return "—";
  return source;
}

// Format time
function formatTime(time) {
  if (!time) return "—";
  try {
    const date = new Date(time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch {
    return time;
  }
}
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

.overview-box,
.provenance-box,
.timestamp-box,
.quality-box,
.disclaimer-box {
  padding: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.overview-text {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.overview-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.8;
}

.overview-list li {
  margin-bottom: 6px;
}

.data-card {
  padding: 14px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  margin-bottom: 12px;
}

.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--tg-theme-hint-color, #e0e0e0);
}

.data-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0;
}

.data-badge {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
}

.data-badge.verified {
  background: rgba(76, 175, 80, 0.15);
  color: var(--iln-ok-text);
}

.data-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 6px;
}

.data-label {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

.data-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--tg-theme-text-color, #222);
}

.data-value.primary {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-link-color, #3390ec);
}

.data-value.source,
.data-value.time {
  font-family: "Courier New", monospace;
  font-size: 11px;
  color: var(--tg-theme-hint-color, #666);
}

.provenance-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 12px 0;
}

.flow-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 8px;
  width: 100%;
  max-width: 280px;
}

.flow-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--tg-theme-link-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.flow-text {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
}

.flow-arrow {
  font-size: 16px;
  color: var(--tg-theme-hint-color, #999);
}

.provenance-note {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.6;
  margin: 0;
}

.code-explanation {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.code-item {
  padding: 14px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
}

.code-title {
  font-family: "Courier New", monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-link-color, #3390ec);
  margin: 0 0 8px 0;
  word-break: break-all;
}

.code-desc {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
  margin: 0 0 10px 0;
}

.code-formula {
  padding: 8px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 6px;
  text-align: center;
}

.code-formula code {
  font-family: "Courier New", monospace;
  font-size: 13px;
  color: var(--tg-theme-text-color, #222);
}

.timestamp-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.timestamp-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #666);
}

.timestamp-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.timestamp-note {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  font-style: italic;
  margin: 0;
}

.quality-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.quality-list li {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--tg-theme-hint-color, #e0e0e0);
}

.quality-list li:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.quality-list strong {
  display: block;
  font-size: 13px;
  color: var(--tg-theme-text-color, #222);
  margin-bottom: 4px;
}

.quality-list p {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.6;
  margin: 0;
}

.disclaimer-box {
  background: rgba(158, 158, 158, 0.1);
  border-left: 4px solid var(--tg-theme-hint-color, #9e9e9e);
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
