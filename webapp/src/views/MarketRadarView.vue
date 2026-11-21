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
            {{ typeof a === "string" ? a : a?.message || a?.title || formatKeyValueInline(a) }}
          </li>
        </ul>
      </div>

      <div v-if="radar.cashExposure" class="sub-block">
        <div class="sub-title">現金曝險分析</div>
        <div class="kv-list tabular">
          <div
            v-for="(row, idx) in objectToRows(radar.cashExposure)"
            :key="`ce-${idx}`"
            class="kv-row"
          >
            <span class="kv-k">{{ row.label }}</span>
            <span class="kv-v">{{ row.value }}</span>
          </div>
        </div>
      </div>

      <div v-if="radar.leadingIndicators" class="sub-block">
        <div class="sub-title">先行指標狀態</div>
        <div class="kv-list tabular">
          <div
            v-for="(row, idx) in objectToRows(radar.leadingIndicators)"
            :key="`li-${idx}`"
            class="kv-row"
          >
            <span class="kv-k">{{ row.label }}</span>
            <span class="kv-v">{{ row.value }}</span>
          </div>
        </div>
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

function formatKeyValueInline(obj) {
  if (!obj || typeof obj !== "object") return String(obj ?? "");
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");
}

function objectToRows(val) {
  if (!val) return [];
  if (typeof val !== "object") {
    return [{ label: "狀態", value: String(val) }];
  }
  if (Array.isArray(val)) {
    return val.map((item, i) => ({
      label: `項目 ${i + 1}`,
      value: typeof item === "object" ? formatKeyValueInline(item) : String(item),
    }));
  }
  return Object.entries(val)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => ({
      label: k,
      value: Array.isArray(v)
        ? v.map((x) => (typeof x === "object" ? formatKeyValueInline(x) : String(x))).join("、")
        : typeof v === "object"
          ? formatKeyValueInline(v)
          : String(v),
    }));
}
</script>

<style scoped>
.radar-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--iln-text, #e5e7eb);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.defense-banner {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--iln-viz-bear-bg, rgba(220, 38, 38, 0.16));
  border: 1px solid var(--iln-viz-bear-border, rgba(248, 113, 113, 0.35));
  color: var(--iln-viz-bear-text, #fca5a5);
  font-size: 13px;
  font-weight: 700;
}

.card {
  background: var(--iln-surface, #161b22);
  color: var(--iln-text, #e5e7eb);
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.conclusion-card {
  border-left: 4px solid var(--iln-brand, #3b82f6);
}

.card-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-hint, #9ca3af);
}

.conclusion-text {
  font-size: 16px;
  font-weight: 800;
  color: var(--iln-text, #f3f4f6);
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
  border: 1px solid var(--iln-border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  padding: 10px;
  background: var(--iln-surface-alt, #1c222b);
  color: var(--iln-text, #e5e7eb);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-cell.tone-ok {
  background: var(--iln-viz-bull-bg, rgba(22, 163, 74, 0.15));
  border-color: var(--iln-viz-bull-border, rgba(74, 222, 128, 0.35));
}

.m-cell.tone-warn {
  background: var(--iln-viz-alert-bg, rgba(217, 119, 6, 0.16));
  border-color: rgba(251, 191, 36, 0.35);
}

.m-cell.tone-danger {
  background: var(--iln-viz-bear-bg, rgba(220, 38, 38, 0.16));
  border-color: var(--iln-viz-bear-border, rgba(248, 113, 113, 0.35));
}

.m-name {
  font-size: 11px;
  color: var(--iln-hint, #9ca3af);
}

.m-val {
  font-size: 16px;
  font-weight: 800;
  color: var(--iln-text, #f9fafb);
}

.m-sub {
  font-size: 11px;
  font-weight: 600;
  color: var(--iln-hint, #cbd5e1);
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.kv-k {
  color: var(--iln-hint, #9ca3af);
  flex-shrink: 0;
}

.kv-v {
  font-weight: 700;
  color: var(--iln-text, #f3f4f6);
  text-align: right;
  word-break: break-word;
}

.pos {
  color: var(--iln-viz-bull-text, #4ade80);
}

.neg {
  color: var(--iln-viz-bear-text, #f87171);
}

.muted {
  color: var(--iln-hint, #9ca3af);
}

.details-summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-brand, #60a5fa);
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
  color: var(--iln-hint, #9ca3af);
}

.plain-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--iln-text, #e5e7eb);
}
</style>
