<template>
  <div class="strategy-status-view">
    <!-- Header -->
    <div class="status-header">
      <h2 class="status-title">策略狀態面板</h2>
      <p class="status-subtitle">
        即時策略決策透視：分數構成、冷卻期、檔位、風控與預度
      </p>
      <div class="last-updated" v-if="data.timestamp">
        更新：{{ formatTime(data.timestamp) }}
      </div>
    </div>

    <!-- Loading / Error States -->
    <div v-if="loading" class="status-skeleton">
      <div class="sk-card" v-for="i in 4" :key="i"></div>
    </div>

    <div v-else-if="error" class="status-error">
      <p>{{ error }}</p>
      <button class="tg-button retry-btn" @click="loadData">重試</button>
    </div>

    <!-- Main Content -->
    <div v-else class="status-content">
      
      <!-- Section 1: Weight Score Breakdown -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title">📊 策略分數構成 (Weight Score)</h3>
          <span class="section-badge" :class="scoreClass">{{ data.weightScore.total }}pt</span>
        </div>
        <div class="score-breakdown">
          <ScoreBar 
            label="跌幅評分" 
            :value="data.weightScore.dropScore" 
            :max="5" 
            color="#e91e63"
            :description="getDropScoreDesc(data.weightScore.dropScore)"
          />
          <ScoreBar 
            label="RSI 評分" 
            :value="data.weightScore.rsiScore" 
            :max="5" 
            color="#2196f3"
            :description="getRsiScoreDesc(data.weightScore.rsiScore)"
          />
          <ScoreBar 
            label="MACD 評分" 
            :value="data.weightScore.macdScore" 
            :max="5" 
            color="#ff9800"
            :description="getMacdScoreDesc(data.weightScore.macdScore)"
          />
          <ScoreBar 
            label="KD 評分" 
            :value="data.weightScore.kdScore" 
            :max="5" 
            color="#9c27b0"
            :description="getKdScoreDesc(data.weightScore.kdScore)"
          />
          <ScoreBar 
            label="情緒加成" 
            :value="data.weightScore.sentimentScore" 
            :max="5" 
            color="#607d8b"
            :description="getSentimentScoreDesc(data.weightScore.sentimentScore)"
          />
        </div>
      </section>

      <!-- Section 2: Cool Down Status -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title">❄️ 冷卻期狀態</h3>
          <span class="section-badge" :class="cooldownClass">
            {{ data.cooldown.inCooldown ? `剩餘 ${data.cooldown.daysLeft} 天` : '無冷卻期' }}
          </span>
        </div>
        <div class="cooldown-card" :class="{ 'in-cooldown': data.cooldown.inCooldown }">
          <div class="cooldown-main">
            <div class="cooldown-icon" :class="{ active: data.cooldown.inCooldown }">
              {{ data.cooldown.inCooldown ? '⏳' : '✅' }}
            </div>
            <div class="cooldown-info">
              <div class="cooldown-label">{{ data.cooldown.inCooldown ? '冷卻中' : '可正常交易' }}</div>
              <div class="cooldown-days" v-if="data.cooldown.inCooldown">
                剩餘 <strong>{{ data.cooldown.daysLeft }} 個交易日</strong> 解除
              </div>
              <div class="cooldown-message">{{ data.cooldown.message }}</div>
            </div>
            <div class="cooldown-detail" v-if="data.cooldown.lastBuyDate">
              <span class="detail-label">上次買入：</span>
              <span class="detail-value">{{ formatDate(data.cooldown.lastBuyDate) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Strategy Allocation (Score Tiers) -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title">🎯 策略分數檔位與目標槓桿</h3>
          <span class="section-badge">{{ data.allocation.current.comment }}</span>
        </div>
        <div class="allocation-tiers">
          <AllocationTier
            v-for="tier in allocationTiers"
            :key="tier.minScore"
            :tier="tier"
            :is-current="tier.minScore === data.allocation.current.minScore"
            :is-next="data.allocation.next && tier.minScore === data.allocation.next.minScore"
          />
        </div>
        <div class="score-to-next" v-if="data.allocation.next">
          <span class="next-label">距離下一檔位</span>
          <span class="next-score">+{{ data.allocation.next.scoreToNext }}pt (需達 {{ data.allocation.next.minScore }}pt)</span>
        </div>
      </section>

      <!-- Section 4: Scoring Thresholds -->
      <section class="status-section compact">
        <div class="section-header">
          <h3 class="section-title">📈 評分門檻</h3>
        </div>
        <div class="thresholds-grid">
          <ThresholdItem label="起始買入門檻" :value="data.scoring.minScoreToBuy" unit="pt" />
          <ThresholdItem label="戰術加碼門檻" :value="data.scoring.buyTactical" unit="pt" />
          <ThresholdItem label="牛市戰術門檻" :value="data.scoring.buyTacticalBullish" unit="pt" />
        </div>
      </section>

      <!-- Section 5: Budget Priority -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title">💰 Budget Priority (資金預度管控)</h3>
          <span class="section-badge" :class="budgetClass">
            {{ data.budget.isLimited ? '⚠️ 受限' : '✅ 正常' }}
          </span>
        </div>
        <div class="budget-card" :class="{ limited: data.budget.isLimited }">
          <div class="budget-grid">
            <BudgetItem label="每日總可用" :value="data.budget.details.dailyAvailable" unit="元" />
            <BudgetItem label="Baseline 預留" :value="data.budget.details.dailyDcaReserve" unit="元" />
            <BudgetItem label="Tactical 可用池" :value="data.budget.details.tacticalPool" unit="元" />
            <BudgetItem label="當前請求" :value="data.budget.details.poolAmount" unit="元" />
            <BudgetItem label="實際允許" :value="data.budget.allowedAmount" unit="元" />
          </div>
          <div class="budget-reason" v-if="data.budget.isLimited">
            <span class="reason-icon">⚠️</span>
            <span class="reason-text">{{ data.budget.limitedReason }}</span>
          </div>
          <div class="budget-signal-type">
            <span class="type-label">信號類型：</span>
            <span class="type-badge" :class="signalTypeClass">{{ signalTypeLabel }}</span>
          </div>
        </div>
      </section>

      <!-- Section 6: Signal Classification -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title">📡 當前信號分類</h3>
        </div>
        <div class="signal-card">
          <div class="signal-main">
            <span class="signal-category-badge" :class="signalCategoryClass">{{ signalCategoryLabel }}</span>
            <span class="signal-type-badge" :class="signalTypeClass">{{ signalTypeLabel }}</span>
          </div>
          <div class="signal-details">
            <div class="signal-row">
              <span class="detail-label">方向</span>
              <span class="detail-value signal-direction" :class="directionClass">{{ data.signal.direction }}</span>
            </div>
            <div class="signal-row">
              <span class="detail-label">目標</span>
              <span class="detail-value">{{ data.signal.target }}</span>
            </div>
            <div class="signal-row">
              <span class="detail-label">建議</span>
              <span class="detail-value">{{ data.signal.suggestion }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 7: Lifecycle Stage -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title">👤 生命週期階段</h3>
          <span class="section-badge lifecycle-badge" :class="lifecycleClass">{{ data.lifecycle.stage }}</span>
        </div>
        <div class="lifecycle-card">
          <div class="lifecycle-grid">
            <LifecycleItem label="當前階段" :value="lifecycleStageLabel" :icon="lifecycleIcon" />
            <LifecycleItem v-if="data.lifecycle.yearsToRetirement != null" label="距退休" :value="data.lifecycle.yearsToRetirement" unit="年" />
            <LifecycleItem label="槓桿上限" :value="data.lifecycleProfile.maxLeverage" unit="x" />
            <LifecycleItem label="新增Z2上限" :value="data.lifecycleProfile.maxLeverageForNewZ2" unit="x" />
            <LifecycleItem label="最低生存跌幅" :value="data.lifecycleProfile.minSurvivalDropLimit" unit="%" />
            <LifecycleItem label="模式" :value="lifecycleModeLabel" />
          </div>
        </div>
      </section>

      <!-- Section 8: Risk Controls -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title">🛡️ 風控狀態</h3>
          <span class="section-badge risk-badge" :class="riskClass">{{ riskLabel }}</span>
        </div>
        <div class="risk-grid">
          <RiskItem 
            label="Regime 狀態" 
            :value="data.risk.regime" 
            :icon="regimeIcon" 
            :class="regimeClass"
          />
          <RiskItem 
            label="維持率" 
            :value="data.risk.maintenanceMargin" 
            unit="%"
            :icon="data.risk.maintenanceMargin < 145 ? '🔴' : data.risk.maintenanceMargin < 160 ? '🟠' : '🟢'"
          />
          <RiskItem 
            label="綜合槓桿" 
            :value="data.risk.grossLeverage" 
            unit="x"
            :icon="data.risk.grossLeverage > 2.5 ? '🔴' : data.risk.grossLeverage > 2.0 ? '🟠' : '🟢'"
          />
          <RiskItem 
            label="估值守衛" 
            :value="data.risk.valuationGuard?.latchActive ? '生效' : '未生效'"
            :icon="data.risk.valuationGuard?.latchActive ? '🔒' : '🔓'"
          />
          <RiskItem 
            label="恐慌破冰" 
            :value="data.risk.panicBypassActive ? '生效' : '未生效'"
            :icon="data.risk.panicBypassActive ? '⚡' : '🔓'"
          />
          <RiskItem 
            label="移動停利" 
            :value="data.risk.trailingActive ? '啟動' : '待機'"
            :icon="data.risk.trailingActive ? '📉' : '⏸️'"
          />
        </div>
      </section>

      <!-- Section 9: Key Metrics -->
      <section class="status-section compact">
        <div class="section-header">
          <h3 class="section-title">📋 關鍵指標速覽</h3>
        </div>
        <div class="metrics-grid">
          <MetricItem label="維持率" :value="data.keyMetrics.maintenanceMargin" unit="%" />
          <MetricItem label="綜合槓桿" :value="data.keyMetrics.grossLeverage" unit="x" />
          <MetricItem label="Z2 佔比" :value="data.keyMetrics.z2Ratio" unit="%" />
          <MetricItem label="估值 PR" :value="data.keyMetrics.currentPr" unit="%" />
          <MetricItem label="淨資產" :value="data.keyMetrics.netAsset" unit="元" format="number" />
          <MetricItem label="實際槓桿" :value="data.keyMetrics.actualLeverage" unit="x" />
        </div>
      </section>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { apiFetch } from "../api/index.js";
import { useTelegram, waitReady } from "../composables/useTelegram.js";

// Components
import ScoreBar from "../components/dashboard/ScoreBar.vue";
import AllocationTier from "../components/dashboard/AllocationTier.vue";
import ThresholdItem from "../components/dashboard/ThresholdItem.vue";
import BudgetItem from "../components/dashboard/BudgetItem.vue";
import LifecycleItem from "../components/dashboard/LifecycleItem.vue";
import RiskItem from "../components/dashboard/RiskItem.vue";
import MetricItem from "../components/dashboard/MetricItem.vue";

// State
const data = ref(null);
const loading = ref(true);
const error = ref(null);

// Load data
const loadData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await apiFetch("/api/strategy-status");
    data.value = res;
  } catch (err) {
    error.value = "無法載入策略狀態：" + err.message;
  } finally {
    loading.value = false;
  }
};

// Computed helpers
const scoreClass = computed(() => {
  const score = data.value?.weightScore?.total ?? 0;
  if (score >= 8) return "badge-buy";
  if (score >= 4) return "badge-wait";
  return "badge-sell";
};

const cooldownClass = computed(() => 
  data.value?.cooldown?.inCooldown ? "badge-warn" : "badge-ok"
);

const cooldownClassCard = computed(() => 
  data.value?.cooldown?.inCooldown ? "in-cooldown" : ""
);

const budgetClass = computed(() => 
  data.value?.budget?.isLimited ? "badge-danger" : "badge-ok"
);

const signalCategoryClass = computed(() => {
  const cat = data.value?.signal?.category ?? "baseline";
  const map = {
    panic: "badge-danger",
    deep_drop: "badge-warn",
    take_profit: "badge-profit",
    rebalance: "badge-rebalance",
    baseline: "badge-ok",
  };
  return map[cat] ?? "badge-ok";
});

const signalCategoryLabel = computed(() => {
  const cat = data.value?.signal?.category ?? "baseline";
  const map = {
    panic: "🔴 恐慌",
    deep_drop: "🟠 深度回撤",
    take_profit: "🟢 停利獲利",
    rebalance: "🔄 再平衡",
    baseline: "🌱 底倉/觀望",
  };
  return map[cat] ?? cat;
});

const signalTypeClass = computed(() => {
  const type = data.value?.signal?.type ?? "baseline";
  const map = {
    tactical_panic: "badge-danger",
    tactical_drop: "badge-warn",
    baseline: "badge-ok",
  };
  return map[type] ?? "badge-ok";
});

const signalTypeLabel = computed(() => {
  const type = data.value?.signal?.type ?? "baseline";
  const map = {
    tactical_panic: "⚡ 戰術恐慌",
    tactical_drop: "🎯 戰術回撤",
    baseline: "🌱 底倉/觀望",
  };
  return map[type] ?? type;
});

const lifecycleClass = computed(() => {
  const stage = data.value?.lifecycle?.stage ?? "EARLY";
  const map = {
    EARLY: "badge-buy",
    MID: "badge-wait",
    LATE: "badge-warn",
    PRE_RETIRE: "badge-danger",
  };
  return map[stage] ?? "badge-ok";
});

const lifecycleStageLabel = computed(() => {
  const stage = data.value?.lifecycle?.stage ?? "EARLY";
  const map = {
    EARLY: "🌱 早期累積期 (>15年)",
    MID: "🌿 中期平衡期 (10-15年)",
    LATE: "🍂 後期保守期 (5-10年)",
    PRE_RETIRE: "🍁 退休前保守期 (<5年)",
  };
  return map[stage] ?? stage;
});

const lifecycleIcon = computed(() => {
  const stage = data.value?.lifecycle?.stage ?? "EARLY";
  const map = {
    EARLY: "🌱",
    MID: "🌿",
    LATE: "🍂",
    PRE_RETIRE: "🍁",
  };
  return map[stage] ?? "🌱";
});

const lifecycleModeLabel = computed(() => {
  const mode = data.value?.lifecycleProfile?.mode ?? "unknown";
  const map = {
    aggressive: "積極",
    balanced: "平衡",
    conservative: "保守",
    defensive: "防守",
    unknown: "未知",
  };
  return map[mode] ?? mode;
});

const regimeIcon = computed(() => {
  const regime = data.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "🔴", CAUTIOUS: "🟠", NORMAL: "🟢" };
  return map[regime] ?? "⚪";
});

const regimeClass = computed(() => {
  const regime = data.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "badge-danger", CAUTIOUS: "badge-warn", NORMAL: "badge-ok" };
  return map[regime] ?? "badge-ok";
});

const riskLabel = computed(() => {
  const regime = data.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "🔴 危機", CAUTIOUS: "🟠 警戒", NORMAL: "🟢 正常" };
  return map[regime] ?? regime;
});

const riskClass = computed(() => {
  const regime = data.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "badge-danger", CAUTIOUS: "badge-warn", NORMAL: "badge-ok" };
  return map[regime] ?? "badge-ok";
});

const signalTypeClass = computed(() => {
  const type = data.value?.signal?.type ?? "baseline";
  const map = {
    tactical_panic: "badge-danger",
    tactical_drop: "badge-warn",
    baseline: "badge-ok",
  };
  return map[type] ?? "badge-ok";
});

const signalCategoryClass = computed(() => {
  const cat = data.value?.signal?.category ?? "baseline";
  const map = {
    panic: "badge-danger",
    deep_drop: "badge-warn",
    take_profit: "badge-profit",
    rebalance: "badge-rebalance",
    baseline: "badge-ok",
  };
  return map[cat] ?? "badge-ok";
});

const directionClass = computed(() => {
  const dir = data.value?.signal?.direction ?? "hold";
  const map = { long: "text-buy", short: "text-sell", hold: "text-wait" };
  return map[dir] ?? "";
});

const allocationTiers = computed(() => {
  const strategy = data.value?.data?.strategySnapshot ?? {};
  const allocation = strategy.allocation ?? [];
  return allocation.map(tier => ({
    minScore: tier.minScore ?? 0,
    leverage: tier.leverage ?? 0,
    cash: tier.cash ?? 0,
    comment: tier.comment ?? "",
  }));
});

const formatTime = (iso) => new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
const formatDate = (iso) => new Date(iso).toLocaleDateString("zh-TW");

const loadData = async () => {
  try {
    const res = await apiFetch("/api/strategy-status");
    data.value = res;
  } catch (err) {
    error.value = "載入失敗：" + err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await waitReady();
  await loadData();
});
</script>

<style scoped>
.status-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.status-title {
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 4px;
}
.status-subtitle {
  font-size: 13px;
  color: #888;
  margin: 0 0 12px;
}
.last-updated {
  font-size: 11px;
  color: #aaa;
}

.status-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sk-card {
  height: 120px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 12px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.status-error {
  text-align: center;
  padding: 32px;
  color: #ff3b30;
}
.retry-btn {
  margin-top: 12px;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-section {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.06);
  padding: 16px;
}
.status-section.compact {
  padding: 12px 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}
.section-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.badge-ok { background: #e8f5e9; color: #2e7d32; }
.badge-warn { background: #fff3e0; color: #e65100; }
.badge-danger { background: #fbe9e7; color: #c62828; }
.badge-buy { background: #e3f2fd; color: #1565c0; }
.badge-wait { background: #f3e5f5; color: #6a1b9a; }
.badge-sell { background: #fbe9e7; color: #c62828; }
.badge-profit { background: #e8f5e9; color: #2e7d32; }
.badge-rebalance { background: #e3f2fd; color: #1565c0; }
.badge-rebalance { background: #e3f2fd; color: #1565c0; }

/* Score Breakdown */
.score-breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Cool Down */
.cooldown-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  border-radius: 12px;
}
.cooldown-card.in-cooldown {
  background: #fff8e1;
  border: 1px solid #ffcc02;
}
.cooldown-icon {
  font-size: 28px;
  opacity: 0.5;
  transition: opacity 0.3s;
}
.cooldown-icon.active {
  opacity: 1;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
.cooldown-info {
  flex: 1;
}
.cooldown-label {
  font-weight: 600;
  font-size: 14px;
}
.cooldown-days {
  font-size: 13px;
  color: #e65100;
  margin-top: 2px;
}
.cooldown-message {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}
.cooldown-detail {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #888;
  padding-top: 4px;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.detail-label { color: #888; }
.detail-value { font-weight: 500; }

/* Allocation Tiers */
.allocation-tiers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.score-to-next {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #e3f2fd;
  border-radius: 12px;
  margin-top: 8px;
}
.next-label { font-size: 12px; color: #888; }
.next-score { font-weight: 600; color: #1565c0; }

/* Thresholds */
.thresholds-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* Budget */
.budget-card {
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  border-radius: 12px;
  padding: 16px;
}
.budget-card.limited {
  background: #fbe9e7;
  border: 1px solid #ffccbc;
}
.budget-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.budget-signal-type {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.type-label { font-size: 12px; color: #888; }
.type-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}
.budget-reason {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #ffebee;
  border-radius: 8px;
  color: #c62828;
  font-size: 12px;
}

/* Signal Card */
.signal-card {
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  border-radius: 12px;
  padding: 16px;
}
.signal-main {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.signal-category-badge, .signal-type-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}
.badge-profit { background: #e8f5e9; color: #2e7d32; }
.badge-rebalance { background: #e3f2fd; color: #1565c0; }
.signal-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.signal-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.detail-label { color: #888; }
.detail-value { font-weight: 500; }
.signal-direction.text-buy { color: #2e7d32; }
.signal-direction.text-sell { color: #c62828; }
.signal-direction.text-wait { color: #6a1b9a; }

/* Lifecycle */
.lifecycle-card {
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  border-radius: 12px;
  padding: 16px;
}
.lifecycle-badge.badge-buy { background: #e8f5e9; color: #2e7d32; }
.lifecycle-badge.badge-wait { background: #f3e5f5; color: #6a1b9a; }
.lifecycle-badge.badge-warn { background: #fff3e0; color: #e65100; }
.lifecycle-badge.badge-danger { background: #fbe9e7; color: #c62828; }
.lifecycle-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* Risk Grid */
.risk-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* Budget Item, Lifecycle Item, Risk Item, Metric Item, Threshold Item */
.budget-item, .lifecycle-item, .risk-item, .metric-item, .threshold-item {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}
.budget-item .label, .lifecycle-item .label, .risk-item .label, .metric-item .label, .threshold-item .label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.budget-item .value, .lifecycle-item .value, .risk-item .value, .metric-item .value, .threshold-item .value {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}
.budget-item .unit, .lifecycle-item .unit, .risk-item .unit, .metric-item .unit, .threshold-item .unit {
  font-size: 10px;
  color: #aaa;
  margin-left: 2px;
}

/* Allocation Tier */
.allocation-tier {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.3s;
}
.allocation-tier.is-current {
  background: #e3f2fd;
  border-color: #2196f3;
}
.allocation-tier.is-next {
  background: #fff3e0;
  border-color: #ff9800;
}
.tier-score {
  font-size: 12px;
  color: #888;
  min-width: 60px;
}
.tier-bar {
  flex: 1;
  height: 6px;
  background: rgba(0,0,0,0.06);
  border-radius: 3px;
  overflow: hidden;
}
.tier-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.tier-fill.current { background: #2196f3; }
.tier-fill.next { background: #ff9800; }
.tier-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 80px;
}
.tier-leverage { font-weight: 600; font-size: 14px; }
.tier-cash { font-size: 11px; color: #888; }
.tier-comment { font-size: 10px; color: #aaa; margin-top: 2px; }

/* Utility */
.text-buy { color: #2e7d32; }
.text-sell { color: #c62828; }
.text-wait { color: #6a1b9a; }
.text-ok { color: #2e7d32; }
.text-warn { color: #e65100; }
.text-danger { color: #c62828; }
</style>