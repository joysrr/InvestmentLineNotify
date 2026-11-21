<template>
  <div class="radar-panel">
    <!-- 長期防禦模式警示 -->
    <div v-if="radar.isLongTermDefense" class="defense-banner" role="status">
      長期防禦模式中 — 嚴格控制槓桿與加碼
    </div>

    <!-- 掃描結論 -->
    <section class="card conclusion-card" aria-label="雷達掃描結論">
      <div class="card-label">雷達掃描結論</div>
      <div class="conclusion-text tabular">{{ radar.scanConclusion }}</div>
    </section>

    <!-- 美股市場 -->
    <section class="card" aria-label="美股市場">
      <div class="card-label">美股市場</div>
      <div class="metric-grid tabular">
        <div
          v-for="item in radar.us"
          :key="item.key"
          class="m-cell"
          :class="`tone-${item.status}`"
        >
          <div class="m-name">{{ item.label }}</div>
          <div class="m-val">{{ item.valueText }}</div>
          <div class="m-sub">{{ item.subText }}</div>
        </div>
      </div>
    </section>

    <!-- 台股市場 -->
    <section class="card" aria-label="台股市場">
      <div class="card-label">台股市場</div>
      <div class="metric-grid metric-grid--3 tabular">
        <div
          v-for="item in radar.tw"
          :key="item.key"
          class="m-cell"
          :class="`tone-${item.status}`"
        >
          <div class="m-name">{{ item.label }}</div>
          <div class="m-val">{{ item.valueText }}</div>
          <div class="m-sub">{{ item.subText }}</div>
        </div>
      </div>
    </section>

    <!-- 融資餘額變化明細 -->
    <section v-if="radar.marginDetail.hasData" class="card" aria-label="融資餘額變化">
      <div class="card-label">融資餘額變化</div>
      <div class="kv-list tabular">
        <div class="kv-row">
          <span class="kv-k">融資餘額</span>
          <span class="kv-v">
            {{
              radar.marginDetail.marginValue != null
                ? `${radar.marginDetail.marginValue.toFixed(1)} 億`
                : "—"
            }}
          </span>
        </div>
        <div class="kv-row">
          <span class="kv-k">單日增減</span>
          <span
            class="kv-v"
            :class="
              radar.marginDetail.marginChange != null
                ? radar.marginDetail.marginChange >= 0
                  ? 'pos'
                  : 'neg'
                : ''
            "
          >
            {{
              radar.marginDetail.marginChange != null
                ? `${radar.marginDetail.marginChange >= 0 ? "+" : ""}${radar.marginDetail.marginChange.toFixed(1)} 億`
                : "—"
            }}
          </span>
        </div>
        <div v-if="radar.marginDetail.marginDate" class="kv-row">
          <span class="kv-k">資料日期</span>
          <span class="kv-v muted">{{ radar.marginDetail.marginDate }}</span>
        </div>
      </div>
    </section>

    <!-- 先行指標 / 極端雷達 / 現金曝險補充明細（可折疊，不遺失資訊） -->
    <details
      v-if="radar.extremeAlerts.length || radar.cashExposure || radar.leadingIndicators"
      class="card details-card"
    >
      <summary class="details-summary">先行指標、極端雷達與現金曝險明細</summary>

      <div v-if="radar.extremeAlerts.length" class="sub-block">
        <div class="sub-title">極端雷達警示（{{ radar.extremeAlerts.length }}）</div>
        <ul class="plain-list">
          <li v-for="(a, idx) in radar.extremeAlerts" :key="idx">
            {{ typeof a === "string" ? a : a?.message || a?.title || JSON.stringify(a) }}
          </li>
        </ul>
      </div>

      <div v-if="radar.cashExposure" class="sub-block">
        <div class="sub-title">現金曝險分析</div>
        <pre class="json-pre">{{ formatStructured(radar.cashExposure) }}</pre>
      </div>

      <div v-if="radar.leadingIndicators" class="sub-block">
        <div class="sub-title">先行指標原始結構</div>
        <pre class="json-pre">{{ formatStructured(radar.leadingIndicators) }}</pre>
      </div>
    </details>
  </div>
</template>

<script setup>
defineProps({
  radar: { type: Object, required: true },
  reportDate: { type: String, default: "" },
  updatedAt: { type: [String, Number, Date, Object], default: null },
});

function formatStructured(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}
</script>

<style scoped>
.radar-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.defense-banner {
  padding: 12px 14px;
  border-radius: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  font-size: 13px;
  font-weight: 700;
}

.card {
  background: var(--iln-surface, #ffffff);
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.conclusion-card {
  border-left: 4px solid var(--iln-brand, #2563eb);
}

.card-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-hint, #4b5563);
}

.conclusion-text {
  font-size: 16px;
  font-weight: 800;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 520px) {
  .metric-grid--3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.m-cell {
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
  border-radius: 10px;
  padding: 10px;
  background: var(--iln-surface-alt, #f9fafb);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-cell.tone-ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.m-cell.tone-warn {
  background: #fffbeb;
  border-color: #fde68a;
}

.m-cell.tone-danger {
  background: #fef2f2;
  border-color: #fecaca;
}

.m-name {
  font-size: 11px;
  color: var(--iln-hint, #6b7280);
}

.m-val {
  font-size: 16px;
  font-weight: 800;
}

.m-sub {
  font-size: 11px;
  font-weight: 600;
  color: var(--iln-hint, #4b5563);
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.kv-k {
  color: var(--iln-hint, #6b7280);
}

.kv-v {
  font-weight: 700;
}

.pos {
  color: #15803d;
}

.neg {
  color: #b91c1c;
}

.muted {
  color: var(--iln-hint, #6b7280);
}

.details-summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-brand, #2563eb);
}

.sub-block {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--iln-hint, #4b5563);
}

.plain-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.5;
}

.json-pre {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  background: var(--iln-surface-alt, #f3f4f6);
  font-size: 11px;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
