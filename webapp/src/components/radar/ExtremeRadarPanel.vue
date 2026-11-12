<template>
  <div class="extreme-radar-container">
    <!-- 無資料時提示 -->
    <div v-if="!leadingIndicators" class="empty-radar-bar">
      🛡️ 極端雷達與防禦層：暫無雷達數據
    </div>

    <!-- 常態平穩條狀（IDLE） -->
    <div
      v-else-if="isIdle"
      class="radar-panel radar-panel-idle"
    >
      <div class="radar-panel-header" @click="toggleExpanded">
        <div class="header-left">
          <span class="status-icon">🛡️</span>
          <span class="status-title">極端防禦狀態：</span>
          <span class="status-badge badge-idle">常態平穩</span>
          <span class="status-sub">監控狀態：IDLE（未觸發異常警報）</span>
          <span class="status-summary">● 4 項指標監控中 · 全數正常</span>
        </div>
        <div class="header-right">
          <span class="toggle-btn" data-testid="toggle-radar-btn">{{ isExpanded ? "▲ 收合" : "▼ 展開" }}</span>
        </div>
      </div>

      <!-- 常態展開檢視微型雷達詳細清單 -->
      <div v-if="isExpanded" class="radar-detail-list">
        <div
          v-for="r in normalizedRadars"
          :key="r.radarId"
          class="radar-mini-item"
        >
          <div class="mini-item-left">
            <div class="mini-status-dot dot-normal"></div>
            <div class="mini-info">
              <div class="mini-title-row">
                <span class="mini-name">{{ r.displayName }}</span>
                <span class="radar-code">{{ r.displayCode }}</span>
                <span v-if="r.displayDesc" class="mini-desc">{{ r.displayDesc }}</span>
                <button
                  class="radar-info-button"
                  type="button"
                  :aria-label="`查看${r.displayName}說明`"
                  :data-testid="`radar-info-${r.radarId}`"
                  @click.stop="toggleRadarInfo(r.radarId)"
                >ⓘ</button>
              </div>
              <div class="mini-purpose">{{ r.displayDefinition }}</div>
              <div class="mini-summary">{{ r.displaySummary }}</div>
              <div v-if="openRadarInfo === r.radarId" class="radar-info-panel">
                <strong>這個指標在看什麼？</strong>
                <span>{{ r.definition }}</span>
                <strong>何時需要注意？</strong>
                <span>{{ r.thresholdHint }}</span>
                <span class="radar-info-status">目前未超過警戒門檻</span>
              </div>
            </div>
          </div>
          <div class="mini-item-right">
            <span class="mini-badge-ok">正常 ✅</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 極端警報觸發面板（ACTIVE_DEFENSE / CONTINUOUS_SHOCK / COOLDOWN） -->
    <div
      v-else
      class="radar-panel radar-panel-alert"
      :class="`panel-severity-${maxSeverity.toLowerCase()}`"
    >
      <div class="radar-panel-header" @click="toggleExpanded">
        <div class="header-left">
          <span class="status-icon">🚨</span>
          <span class="status-title">防禦層已啟動：</span>
          <span class="status-badge badge-active">{{ stateLabel }} ({{ stateMachine.state }})</span>
          <span v-if="stateMachine.activeDays > 0" class="status-sub">
            (第 {{ stateMachine.activeDays }} 天)
          </span>
        </div>
        <div class="header-right">
          <span class="toggle-btn" data-testid="toggle-radar-btn">{{ isExpanded ? "▲ 收合" : "▼ 展開" }}</span>
        </div>
      </div>

      <!-- 觸發雷達清單與行動紀律（預設展開） -->
      <div v-show="isExpanded" class="radar-alert-body">
        <!-- 觸發的雷達清單 -->
        <div class="triggered-section">
          <div class="section-subtitle">⚡ 觸發極端雷達</div>
          <div class="triggered-list">
            <div
              v-for="r in triggeredRadars"
              :key="r.radarId"
              class="triggered-item"
            >
              <div class="ti-header">
                <span class="ti-name">{{ r.displayName }}</span>
                <span class="ti-severity" :class="`sev-${r.severity.toLowerCase()}`">
                  {{ r.severity }}
                </span>
              </div>
              <div class="ti-summary">{{ r.displaySummary }}</div>
            </div>
          </div>
        </div>

        <!-- 嚴格行動紀律 -->
        <div class="action-discipline-section">
          <div class="section-subtitle">🎯 即時防禦行動紀律</div>
          <div class="discipline-grid">
            <!-- 00675L 行動 -->
            <div class="discipline-card" :class="{ 'card-freeze': stateMachine.freeze00675L }">
              <span class="dc-label">00675L (2x槓桿)</span>
              <span v-if="stateMachine.freeze00675L" class="dc-status text-danger">
                🚫 凍結禁止加碼
              </span>
              <span v-else class="dc-status text-success">
                ✅ 允許加碼
              </span>
            </div>

            <!-- 0050 行動 -->
            <div class="discipline-card">
              <span class="dc-label">0050 (原型加碼)</span>
              <span v-if="stateMachine.allowLeft0050" class="dc-status text-success">
                ✅ 允許低接
              </span>
              <span v-else class="dc-status text-muted">
                ⏸️ 暫停加碼
              </span>
            </div>

            <!-- P0 定期定額 -->
            <div class="discipline-card card-p0">
              <span class="dc-label">P0 定期定額</span>
              <span class="dc-status text-success">
                🟢 正常扣款 (最高豁免)
              </span>
            </div>

            <!-- 現金曝險分析 -->
            <CashExposureWidget v-if="cashExposureAnalysis" :analysis="cashExposureAnalysis" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import CashExposureWidget from "./CashExposureWidget.vue";

const props = defineProps({
  leadingIndicators: {
    type: Object,
    default: null,
  },
});

const isExpanded = ref(false);
const openRadarInfo = ref(null);

const stateMachine = computed(() => {
  return (
    props.leadingIndicators?.stateMachine ?? {
      state: "IDLE",
      cooldownDays: 0,
      activeDays: 0,
      freeze00675L: false,
      allowLeft0050: true,
      p0Exempt: true,
    }
  );
});

const cashExposureAnalysis = computed(() => {
  return props.leadingIndicators?.cashExposureAnalysis ?? null;
});

const RADAR_CONFIG = {
  OVERNIGHT_SHOCK: {
    name: "美股隔夜衝擊",
    desc: "費半 / 台積ADR / 夜盤",
    defaultSummary: "美股與夜盤走勢平穩無異常",
    definition: "監測跨日價格是否出現異常跳動。",
    dataDefinition: "日盤到夜盤變化率＝(夜盤收盤−日盤收盤)／日盤收盤。",
    thresholdHint: "跨日波動明顯放大，或海外市場與夜盤同步急挫時。",
  },
  MARGIN_SETTLING: {
    name: "籌碼沉澱偵測",
    desc: "融資維持率與斷頭潮",
    defaultSummary: "維持率在安全區間，籌碼穩定",
    definition: "觀察融資維持率與籌碼變化，評估槓桿部位壓力。",
    thresholdHint: "維持率快速下滑，或融資部位出現異常收縮時。",
  },
  EXTREME_PANIC: {
    name: "歷史極度恐慌",
    desc: "台股 VIX 與 60 日乖離",
    defaultSummary: "市場情緒平靜，未見恐慌性拋售",
    definition: "偵測急跌、恐慌性賣壓與波動率是否同時升高。",
    dataDefinition: "60 日乖離率＝(最新收盤價−MA60)／MA60。",
    thresholdHint: "恐慌指標與價格偏離程度同步超過警戒範圍時。",
  },
  RETAIL_SENTIMENT: {
    name: "散戶多空情緒",
    desc: "非三大法人淨部位比率",
    defaultSummary: "非三大法人部位無法確認，暫不判讀",
    definition: "觀察非三大法人淨部位，作為散戶為主的市場部位估計。",
    dataDefinition: "RSR＝−三大法人淨未平倉／小台全市場未平倉總量。",
    thresholdHint: "僅在部位極端且與市場走勢背離時，作為多殺多或軋空的輔助確認。",
  },
};

function normalizeRadarId(radarId) {
  return String(radarId || "").replace(/^RADAR_+/, "");
}

function getDisplayDefinition(radarId, metrics = {}, config) {
  const bias60Status = metrics?.bias60DataStatus;
  const dataUnavailable =
    metrics?.dataStatus === "UNAVAILABLE" ||
    (radarId === "EXTREME_PANIC" &&
      bias60Status != null &&
      bias60Status !== "VERIFIED");

  if (dataUnavailable) {
    const dataDefinition = config.dataDefinition
      ? ` ${config.dataDefinition}`
      : "";
    return `${config.definition}${dataDefinition} 目前資料不足，暫不判讀。`;
  }

  if (
    radarId === "OVERNIGHT_SHOCK" &&
    metrics?.dayToNightChangePct != null
  ) {
    return `${config.definition} ${config.dataDefinition}`;
  }

  if (radarId === "EXTREME_PANIC" || radarId === "RETAIL_SENTIMENT") {
    return `${config.definition} ${config.dataDefinition}`;
  }

  return config.definition;
}

function getRadarConfig(radarId, fallbackSummary = "指標平穩正常") {
  const normalizedId = normalizeRadarId(radarId);
  return RADAR_CONFIG[normalizedId] || {
    name: "未知雷達",
    desc: "即時監控",
    defaultSummary: fallbackSummary,
    definition: "這是用來觀察市場異常變化的即時監控指標。",
    thresholdHint: "指標明顯偏離常態範圍時。",
  };
}

const normalizedRadars = computed(() => {
  const raw = props.leadingIndicators?.radars;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
    ? Object.values(raw)
    : [];

  return list.map((r) => {
    const normalizedId = normalizeRadarId(r.radarId);
    const conf = getRadarConfig(normalizedId);
    return {
      ...r,
      radarId: normalizedId,
      displayName: conf.name,
      displayCode: `RADAR_${normalizedId}`,
      displayDesc: conf.desc,
      displaySummary: r.cardSummary || conf.defaultSummary,
      displayDefinition: getDisplayDefinition(normalizedId, r.metrics, conf),
      definition: conf.definition,
      thresholdHint: conf.thresholdHint,
      isTriggered: Boolean(r.triggered),
    };
  });
});

const rawTriggeredRadars = computed(() => props.leadingIndicators?.triggeredRadars ?? []);
const triggeredRadars = computed(() => {
  return rawTriggeredRadars.value.map((r) => {
    const normalizedId = normalizeRadarId(r.radarId);
    const conf = getRadarConfig(normalizedId, "觸發警報");
    return {
      ...r,
      radarId: normalizedId,
      displayName: conf.name,
      displayCode: `RADAR_${normalizedId}`,
      displaySummary: r.cardSummary || conf.defaultSummary,
    };
  });
});

const isIdle = computed(() => {
  return (
    stateMachine.value.state === "IDLE" &&
    triggeredRadars.value.length === 0
  );
});

// 當非 IDLE（極端狀態）時，預設自動展開
if (!isIdle.value) {
  isExpanded.value = true;
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function toggleRadarInfo(radarId) {
  openRadarInfo.value = openRadarInfo.value === radarId ? null : radarId;
}

const stateLabel = computed(() => {
  switch (stateMachine.value.state) {
    case "ACTIVE_DEFENSE":
      return "主動防禦";
    case "CONTINUOUS_SHOCK":
      return "連續衝擊";
    case "COOLDOWN":
      return "冷卻回穩";
    default:
      return "常態平穩";
  }
});

const maxSeverity = computed(() => {
  if (triggeredRadars.value.some((r) => r.severity === "CRITICAL")) return "CRITICAL";
  if (triggeredRadars.value.some((r) => r.severity === "ALERT")) return "ALERT";
  if (triggeredRadars.value.some((r) => r.severity === "WATCH")) return "WATCH";
  return "NORMAL";
});

function formatMoney(amount) {
  if (!amount || amount === 0) return "0 萬";
  return `${(amount / 10000).toFixed(1)} 萬`;
}
</script>

<style scoped>
.extreme-radar-container {
  margin-bottom: 16px;
  font-family: inherit;
}

.empty-radar-bar {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--tg-theme-hint-color);
  background: var(--tg-theme-secondary-bg-color);
  border-radius: 12px;
  border: 1px solid var(--iln-border-subtle);
}

.radar-panel {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.25s ease;
}

/* 常態平穩（IDLE） - 柔和清新淺綠微透風格，與美股卡片完美融合 */
.radar-panel-idle {
  background: var(--tg-theme-secondary-bg-color);
  border: 1px solid var(--iln-ok);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

/* 極端警報觸發狀態 */
.radar-panel-alert {
  background: var(--iln-danger-bg);
  border: 1px solid var(--iln-danger);
}

.panel-severity-critical {
  border-color: var(--iln-danger-text);
  background: var(--iln-danger-bg);
}

.panel-severity-alert {
  border-color: var(--iln-warn-text);
  background: var(--iln-warn-bg);
}

.radar-panel-header {
  padding: 11px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.header-right {
  flex-shrink: 0;
  margin-left: 8px;
}

.status-icon {
  font-size: 16px;
  line-height: 1;
}

.status-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--tg-theme-text-color, var(--iln-surface));
}

.status-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
  font-weight: 600;
  white-space: nowrap;
}

.badge-idle {
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
  border: 1px solid var(--iln-ok);
}

.badge-active {
  background: var(--iln-danger-bg);
  color: var(--iln-danger-text);
  border: 1px solid var(--iln-danger);
}

.status-summary {
  font-size: 12px;
  color: var(--tg-theme-hint-color);
}

.status-sub {
  font-size: 11px;
  color: var(--tg-theme-hint-color);
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.04);
  color: var(--tg-theme-hint-color);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

/* 展開詳細清單 */
.radar-detail-list {
  padding: 8px 12px 12px;
  border-top: 1px solid var(--iln-ok);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.radar-mini-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 11px;
  border-radius: 9px;
  border: 1px solid var(--iln-border-subtle);
  transition: all 0.15s ease;
}

.mini-item-left {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  flex: 1;
  min-width: 0;
}

.mini-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.dot-normal {
  background: var(--iln-ok-text);
  box-shadow: 0 0 5px var(--iln-ok);
}

.mini-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.mini-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.mini-name {
  color: var(--tg-theme-text-color, var(--iln-surface));
  font-size: 13px;
  font-weight: 600;
}

.mini-desc {
  font-size: 10px;
  color: var(--tg-theme-hint-color);
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 5px;
  border-radius: 4px;
}

.radar-code {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9px;
  color: var(--tg-theme-hint-color);
  opacity: 0.85;
}

.radar-info-button {
  border: 0;
  padding: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--iln-brand-soft);
  color: var(--iln-brand);
  font-size: 13px;
  line-height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.radar-info-panel {
  display: grid;
  gap: 3px;
  margin-top: 7px;
  padding: 8px 9px;
  border-left: 2px solid var(--iln-brand);
  border-radius: 0 7px 7px 0;
  background: var(--iln-brand-soft);
  color: var(--tg-theme-hint-color);
  font-size: 11px;
  line-height: 1.45;
}

.radar-info-panel strong {
  color: var(--tg-theme-text-color, var(--iln-surface));
  font-size: 11px;
}

.radar-info-status {
  margin-top: 3px;
  color: var(--iln-ok-text);
  font-weight: 600;
}

.mini-purpose {
  color: var(--tg-theme-text-color);
  font-size: 11px;
  line-height: 1.35;
}

.mini-summary {
  color: var(--tg-theme-hint-color);
  font-size: 11px;
  line-height: 1.35;
}

.mini-item-right {
  flex-shrink: 0;
}

.mini-badge-ok {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--iln-ok-bg);
  color: var(--iln-ok-text);
  white-space: nowrap;
}

/* 警報面板主體 */
.radar-alert-body {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--iln-danger);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-subtitle {
  font-size: 12px;
  font-weight: 700;
  color: var(--tg-theme-text-color, var(--iln-surface));
  margin-bottom: 6px;
  letter-spacing: 0.3px;
}

.triggered-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.triggered-item {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  padding: 8px 10px;
  border-left: 3px solid var(--iln-danger-text);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-left-width: 3px;
}

.ti-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px;
}

.ti-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--tg-theme-text-color, var(--iln-surface));
}

.ti-severity {
  font-size: 10px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 4px;
}

.sev-critical {
  background: var(--iln-danger-text);
  /* 業務語義色：白色文字在危險背景上，保持高對比 */
  color: #fff;
}

.sev-alert {
  background: var(--iln-warn-text);
  /* 業務語義色：黑色文字在警告背景上，保持可讀性 */
  color: #000;
}

.sev-watch {
  /* 業務語義色：watch 狀態黃色背景，區別於 ok/warn/danger */
  background: #ffd60a;
  /* 業務語義色：黑色文字在黃色背景上，保持可讀性 */
  color: #000;
}

.ti-summary {
  font-size: 11px;
  color: var(--tg-theme-hint-color);
  line-height: 1.35;
}

.discipline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
  gap: 8px;
}

.discipline-card {
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 10px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.card-freeze {
  border-color: var(--iln-danger);
  background: var(--iln-danger-bg);
}

.dc-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color);
}

.dc-status {
  font-size: 12px;
  font-weight: 700;
}

.dc-note {
  font-size: 10px;
  opacity: 0.8;
  font-weight: normal;
  display: block;
}

.text-danger {
  color: var(--iln-danger-text);
}

.text-success {
  color: var(--iln-ok-text);
}

.text-info {
  color: var(--iln-brand);
}

.text-muted {
  color: var(--tg-theme-hint-color);
}

/* ── 深色主題相容 ── */
.dark .radar-panel-idle,
:global(.dark) .radar-panel-idle {
  background: var(--iln-surface);
  border-color: var(--iln-ok);
}

.dark .radar-mini-item,
:global(.dark) .radar-mini-item {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark .status-title,
:global(.dark) .status-title,
.dark .mini-name,
:global(.dark) .mini-name,
.dark .section-subtitle,
:global(.dark) .section-subtitle,
.dark .ti-name,
:global(.dark) .ti-name {
  /* 業務語義色：深色主題標題文字，與 hint-color 對齊 */
  color: #f2f2f7;
}

.dark .status-summary,
:global(.dark) .status-summary,
.dark .mini-summary,
:global(.dark) .mini-summary,
.dark .ti-summary,
:global(.dark) .ti-summary {
  /* 業務語義色：深色主題摘要文字，與 hint-color 對齊 */
  color: #8e8e93;
}

.dark .toggle-btn,
:global(.dark) .toggle-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  /* 業務語義色：深色主題按鈕文字 */
  color: #aaa;
}

.dark .mini-desc,
:global(.dark) .mini-desc {
  background: rgba(255, 255, 255, 0.08);
  /* 業務語義色：深色主題描述文字 */
  color: #aaa;
}

.dark .triggered-item,
:global(.dark) .triggered-item,
.dark .discipline-card,
:global(.dark) .discipline-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}
/* ── 以下 rgba 屬裝飾性或深色專用，留待 Phase 5 統一處理 ── */
/* .radar-panel-idle box-shadow: rgba(0,0,0,0.02) — 極淡陰影 */
/* .dot-normal box-shadow: 狀態點光暈（ok 色，留待 Phase 5 統一處理） */
/* .radar-mini-item background: rgba(255,255,255,0.7) — 半透明卡片設計 */
/* .dark .toggle-btn background: rgba(0,0,0,0.04) — 深色專用 */
/* .dark .mini-desc background: rgba(255,255,255,0.08) — 深色專用 */

</style>
