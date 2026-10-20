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
          <span class="status-badge badge-idle">常態平穩 (IDLE)</span>
          <span class="status-summary">● 4 雷達監控中 · 全數正常</span>
        </div>
        <div class="header-right">
          <span class="toggle-icon">{{ isExpanded ? "▲ 收合" : "▼ 展開" }}</span>
        </div>
      </div>

      <!-- 常態展開檢視微型雷達燈號 -->
      <div v-if="isExpanded" class="radar-detail-list">
        <div
          v-for="r in radars"
          :key="r.radarId"
          class="radar-mini-item"
        >
          <div class="mini-status-dot dot-normal"></div>
          <div class="mini-name">{{ r.radarName }}</div>
          <div class="mini-summary">{{ r.cardSummary }}</div>
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
          <span class="toggle-icon">{{ isExpanded ? "▲ 收合" : "▼ 展開" }}</span>
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
                <span class="ti-name">{{ r.radarName }}</span>
                <span class="ti-severity" :class="`sev-${r.severity.toLowerCase()}`">
                  {{ r.severity }}
                </span>
              </div>
              <div class="ti-summary">{{ r.cardSummary }}</div>
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
                ✅ 允許加碼 ({{ formatMoney(p1Allocation.allocated00675L) }})
              </span>
            </div>

            <!-- 0050 行動 -->
            <div class="discipline-card">
              <span class="dc-label">0050 (原型加碼)</span>
              <span v-if="stateMachine.allowLeft0050" class="dc-status text-success">
                ✅ 允許低接: {{ formatMoney(p1Allocation.allocated0050) }}
                <small class="dc-note">(GL上限: {{ p1Allocation.glMax0050 }}x)</small>
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

            <!-- P1 加碼狀態 -->
            <div class="discipline-card">
              <span class="dc-label">P1 條件加碼額度</span>
              <span v-if="stateMachine.p1Frozen" class="dc-status text-danger">
                🔒 全面凍結 (維持率低於 160%)
              </span>
              <span v-else class="dc-status text-info">
                剩餘可用: {{ formatMoney(p1Balance) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  leadingIndicators: {
    type: Object,
    default: null,
  },
  p1Balance: {
    type: Number,
    default: 0,
  },
});

const isExpanded = ref(false);

const stateMachine = computed(() => {
  return (
    props.leadingIndicators?.stateMachine ?? {
      state: "IDLE",
      cooldownDays: 0,
      activeDays: 0,
      p1Frozen: false,
      freeze00675L: false,
      allowLeft0050: true,
      p0Exempt: true,
    }
  );
});

const p1Allocation = computed(() => {
  return (
    props.leadingIndicators?.p1Allocation ?? {
      allocated00675L: 0,
      allocated0050: 0,
      p1Frozen: false,
      glMax0050: 2.5,
    }
  );
});

const radars = computed(() => props.leadingIndicators?.radars ?? []);
const triggeredRadars = computed(() => props.leadingIndicators?.triggeredRadars ?? []);

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
  color: var(--text-secondary, #888);
  background: var(--bg-card, #1c1c1e);
  border-radius: 8px;
  border: 1px solid var(--border-color, #2c2c2e);
}

.radar-panel {
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
  border: 1px solid var(--border-color, #2c2c2e);
}

.radar-panel-idle {
  background: var(--bg-card, #1c1c1e);
}

.radar-panel-alert {
  background: rgba(255, 69, 58, 0.08);
  border-color: rgba(255, 69, 58, 0.4);
}

.panel-severity-critical {
  border-color: #ff453a;
  background: rgba(255, 69, 58, 0.12);
}

.panel-severity-alert {
  border-color: #ff9f0a;
  background: rgba(255, 159, 10, 0.12);
}

.radar-panel-header {
  padding: 10px 14px;
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
}

.status-icon {
  font-size: 16px;
}

.status-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.status-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.badge-idle {
  background: rgba(48, 209, 88, 0.15);
  color: #30d158;
  border: 1px solid rgba(48, 209, 88, 0.3);
}

.badge-active {
  background: rgba(255, 69, 58, 0.2);
  color: #ff453a;
  border: 1px solid rgba(255, 69, 58, 0.4);
}

.status-summary {
  font-size: 12px;
  color: var(--text-secondary, #8e8e93);
}

.status-sub {
  font-size: 11px;
  color: var(--text-secondary, #8e8e93);
}

.toggle-icon {
  font-size: 11px;
  color: var(--text-secondary, #8e8e93);
}

.radar-detail-list {
  padding: 8px 14px 12px;
  border-top: 1px solid var(--border-color, #2c2c2e);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.radar-mini-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.mini-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-normal {
  background: #30d158;
}

.mini-name {
  color: var(--text-primary, #fff);
  font-weight: 500;
}

.mini-summary {
  color: var(--text-secondary, #8e8e93);
  font-size: 11px;
}

.radar-alert-body {
  padding: 10px 14px 14px;
  border-top: 1px solid rgba(255, 69, 58, 0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #8e8e93);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.triggered-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.triggered-item {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
  border-left: 3px solid #ff453a;
}

.ti-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.ti-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.ti-severity {
  font-size: 10px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 3px;
}

.sev-critical {
  background: #ff453a;
  color: #fff;
}

.sev-alert {
  background: #ff9f0a;
  color: #000;
}

.sev-watch {
  background: #ffd60a;
  color: #000;
}

.ti-summary {
  font-size: 12px;
  color: var(--text-secondary, #ebebf599);
}

.discipline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.discipline-card {
  background: rgba(0, 0, 0, 0.25);
  padding: 8px 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--border-color, #2c2c2e);
}

.card-freeze {
  border-color: rgba(255, 69, 58, 0.4);
  background: rgba(255, 69, 58, 0.05);
}

.dc-label {
  font-size: 11px;
  color: var(--text-secondary, #8e8e93);
}

.dc-status {
  font-size: 12px;
  font-weight: 600;
}

.dc-note {
  font-size: 10px;
  opacity: 0.8;
  font-weight: normal;
  display: block;
}

.text-danger {
  color: #ff453a;
}

.text-success {
  color: #30d158;
}

.text-info {
  color: #64d2ff;
}

.text-muted {
  color: #8e8e93;
}
</style>
