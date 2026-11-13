<template>
  <GlobalErrorBoundary>
    <div class="strategy-status-view">
      <!-- Header -->
    <div class="status-header">
      <h2 class="status-title">策略狀態面板</h2>
      <p class="status-subtitle">
        即時策略決策透視：分數構成、冷卻期、檔位、風控與預度
      </p>
      <div class="last-updated" v-if="data?.timestamp">
        更新：{{ formatTime(health.timestamp) }}
      </div>
    </div>

    <!-- Loading / Error States -->
    <div v-if="isLoading" class="status-skeleton">
      <div class="sk-card" v-for="i in 4" :key="i"></div>
    </div>

    <div v-else-if="loadError" class="status-error">
      <p>{{ loadError }}</p>
      <button class="tg-button retry-btn" @click="loadData">重試</button>
    </div>

    <!-- Main Content -->
    <div v-else-if="health" class="status-content">
      <!-- Segmented Control Tabs -->
      <div class="segmented-control">
        <button
          class="segmented-btn"
          :class="{ active: activeTab === 'scores' }"
          @click="activeTab = 'scores'"
        >          <Icon name="chart" size="sm" color="var(--iln-text)" /> 評分與檔位
        </button>
        <button
          class="segmented-btn"
          :class="{ active: activeTab === 'risk' }"
          @click="activeTab = 'risk'"
        >          <Icon name="shield" size="sm" color="var(--iln-brand)" /> 風控與機制
        </button>
      </div>

      <!-- TAB 1: 評分與檔位 -->
      <div v-show="activeTab === 'scores'">
        <!-- Section 1: Weight Score Breakdown -->
        <section class="status-section">
        <div class="section-header">
          <h3 class="section-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> 策略分數構成 (Weight Score)</h3>
          <span class="section-badge" :class="scoreClass">{{ health.weightScore.total }}pt</span>
        </div>
        <div class="score-breakdown">
          <!-- 業務語義色：跌幅評分（粉紅） -->
          <ScoreBar 
            label="跌幅評分" 
            :value="health.weightScore.dropScore" 
            :max="5"
            color="var(--iln-strategy-drop)"
            :description="getDropScoreDesc(health.weightScore.dropScore)"
          />
          <!-- 業務語義色：RSI 評分（藍色） -->
          <ScoreBar 
            label="RSI 評分" 
            :value="health.weightScore.rsiScore" 
            :max="5"
            color="var(--iln-strategy-rsi)"
            :description="getRsiScoreDesc(health.weightScore.rsiScore)"
          />
          <!-- 業務語義色：MACD 評分（橘色） -->
          <ScoreBar 
            label="MACD 評分" 
            :value="health.weightScore.macdScore" 
            :max="5"
            color="var(--iln-strategy-macd)"
            :description="getMacdScoreDesc(health.weightScore.macdScore)"
          />
          <ScoreBar 
            label="KD 評分" 
            :value="health.weightScore.kdScore" 
            :max="5"
            :description="getKdScoreDesc(health.weightScore.kdScore)"
          />
          <ScoreBar 
            label="情緒加成" 
            :value="health.weightScore.sentimentScore" 
            :max="5"
            :description="getSentimentScoreDesc(health.weightScore.sentimentScore)"
          />
        </div>
      </section>

      <!-- Section 2: Cool Down Status -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 冷卻期狀態</h3>
          <span class="section-badge" :class="cooldownClass">
            {{ health.cooldown.inCooldown ? `剩餘 ${health.cooldown.daysLeft} 天` : '無冷卻期' }}
          </span>
        </div>
        <div class="cooldown-card" :class="{ 'in-cooldown': health.cooldown.inCooldown }">
          <div class="cooldown-main">
            <div class="cooldown-icon" :class="{ active: health.cooldown.inCooldown }">
              {{ health.cooldown.inCooldown ? 'default' : 'ok' }}
            </div>
            <div class="cooldown-info">
              <div class="cooldown-label">{{ health.cooldown.inCooldown ? '冷卻中' : '可正常交易' }}</div>
              <div class="cooldown-days" v-if="health.cooldown.inCooldown">
                剩餘 <strong>{{ health.cooldown.daysLeft }} 個交易日</strong> 解除
              </div>
              <div class="cooldown-message">{{ health.cooldown.message }}</div>
            </div>
            <div class="cooldown-detail" v-if="health.cooldown.lastBuyDate">
              <span class="detail-label">上次買入：</span>
              <span class="detail-value">{{ formatDate(health.cooldown.lastBuyDate) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Strategy Allocation (Score Tiers) -->
      <section class="status-section">
        <div class="section-header">
          <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 策略分數檔位與目標槓桿</h3>
          <span class="section-badge">{{ health.allocation.current.comment }}</span>
        </div>
        <div class="allocation-tiers">
          <AllocationTier
            v-for="tier in allocationTiers"
            :key="tier.minScore"
            :tier="tier"
            :is-current="tier.minScore === health.allocation.current.minScore"
            :is-next="health.allocation.next && tier.minScore === health.allocation.next.minScore"
          />
        </div>
        <div class="score-to-next" v-if="health.allocation.next">
          <span class="next-label">距離下一檔位</span>
          <span class="next-score">+{{ health.allocation.next.scoreToNext }}pt (需達 {{ health.allocation.next.minScore }}pt)</span>
        </div>
      </section>

      <!-- Section 4: Scoring Thresholds -->
      <section class="status-section compact">
        <div class="section-header">
          <h3 class="section-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> 評分門檻</h3>
        </div>
        <div class="thresholds-grid">
          <ThresholdItem label="起始買入門檻" :value="health.scoring.minScoreToBuy" unit="pt" />
          <ThresholdItem label="戰術加碼門檻" :value="health.scoring.buyTactical" unit="pt" />
          <ThresholdItem label="牛市戰術門檻" :value="health.scoring.buyTacticalBullish" unit="pt" />
        </div>
      </section>
      </div>

      <!-- TAB 2: 風控與機制 -->
      <div v-show="activeTab === 'risk'">
        <!-- Section 8: Risk Controls -->
        <section class="status-section">
          <div class="section-header">
            <h3 class="section-title"><Icon name="shield" size="sm" color="var(--iln-brand)" /> 風控狀態</h3>
            <span class="section-badge risk-badge" :class="riskClass"><Icon :name="regimeIcon" size="sm" /> {{ riskLabel }}</span>
          </div>
          <div class="risk-grid">
            <RiskItem 
              label="Regime 狀態" 
              :value="health.risk.regime" 
              :icon="regimeIcon" 
              :class="regimeClass"
              :desc="health.risk.regime === 'CRISIS' ? '市場極度恐慌' : health.risk.regime === 'CAUTIOUS' ? '波動放大警戒' : '總體環境正常'"
            />
            <RiskItem 
              label="維持率" 
              :value="health.risk.maintenanceMargin" 
              unit="%"
              :icon="health.risk.maintenanceMargin < 145 ? 'danger' : health.risk.maintenanceMargin < 160 ? 'warn' : 'ok'"
              :desc="health.risk.maintenanceMargin < 145 ? '追繳威脅' : health.risk.maintenanceMargin < 160 ? '警戒水位' : '跌破145%觸發減碼'"
            />
            <RiskItem 
              label="綜合槓桿" 
              :value="health.risk.grossLeverage" 
              unit="x"
              :icon="health.risk.grossLeverage > 2.5 ? 'danger' : health.risk.grossLeverage > 2.0 ? 'warn' : 'ok'"
              :desc="health.risk.grossLeverage > 2.5 ? '槓桿上限' : health.risk.grossLeverage > 2.0 ? '偏高水位' : '上限 2.50x'"
            />
            <RiskItem 
              label="估值守衛" 
              :value="health.risk.valuationGuard?.latchActive ? '防禦生效' : '安全'"
              :icon="health.risk.valuationGuard?.latchActive ? 'default' : 'default'"
              :desc="health.risk.valuationGuard?.currentPR != null ? `PR${health.risk.valuationGuard.currentPR}% (Floor ${health.risk.valuationGuard.floorPR || 70}%)` : '大盤 PB PR分位數'"
            />
            <RiskItem 
              label="恐慌破冰" 
              :value="health.risk.panicBypassActive ? '破冰生效' : '待機'"
              :icon="health.risk.panicBypassActive ? 'trigger' : 'default'"
              :desc="health.risk.panicBypassActive ? 'VIX極端值買入' : 'VIX常態監控'"
            />
            <RiskItem 
              label="移動停利" 
              :value="health.risk.trailingActive ? '啟動' : '待機'"
              :icon="health.risk.trailingActive ? 'chart' : 'neutral'"
              :desc="health.risk.trailingActive ? '高點回撤保護' : '未達停利門檻'"
            />
          </div>
        </section>

        <!-- Section 6: Signal Classification -->
        <section class="status-section">
          <div class="section-header">
            <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 當前信號分類</h3>
          </div>
          <div class="signal-card">
            <div class="signal-main">
              <span class="signal-category-badge" :class="signalCategoryClass"><Icon :name="signalCategoryIcon" size="sm" /> {{ signalCategoryLabel }}</span>
              <span class="signal-type-badge" :class="signalTypeClass"><Icon :name="signalTypeIcon" size="sm" /> {{ signalTypeLabel }}</span>
            </div>
            <div class="signal-details">
              <div class="signal-row">
                <span class="detail-label">方向</span>
                <span class="detail-value signal-direction" :class="directionClass">{{ health.signal.direction }}</span>
              </div>
              <div class="signal-row">
                <span class="detail-label">目標</span>
                <span class="detail-value">{{ health.signal.target }}</span>
              </div>
              <div class="signal-row">
                <span class="detail-label">建議</span>
                <span class="detail-value">{{ health.signal.suggestion }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 5: Budget Priority -->
        <section class="status-section">
          <div class="section-header">
            <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> Budget Priority (資金預度管控)</h3>
            <span class="section-badge" :class="budgetClass">
              <Icon :name="health.budget.isLimited ? 'warn' : 'ok'" size="sm" />
              {{ health.budget.isLimited ? '受限' : '正常' }}
            </span>
          </div>
          <div class="budget-card" :class="{ limited: health.budget.isLimited }">
            <div class="budget-grid">
              <StatCard label="每日總可用" :value="health.budget.details.dailyAvailable" unit="元" decimals="0" />
              <StatCard label="Baseline 預留" :value="health.budget.details.dailyDcaReserve" unit="元" decimals="0" />
              <StatCard label="Tactical 可用池" :value="health.budget.details.tacticalPool" unit="元" decimals="0" />
              <StatCard label="當前請求" :value="health.budget.details.poolAmount" unit="元" decimals="0" />
              <StatCard label="實際允許" :value="health.budget.allowedAmount" unit="元" decimals="0" />
            </div>
            <div class="budget-reason" v-if="health.budget.isLimited">
              <span class="reason-icon"><Icon name="warn" size="sm" color="var(--iln-warn)" /></span>
              <span class="reason-text">{{ health.budget.limitedReason }}</span>
            </div>
            <div class="budget-signal-type">
              <span class="type-label">信號類型：</span>
              <span class="type-badge" :class="signalTypeClass"><Icon :name="signalTypeIcon" size="sm" /> {{ signalTypeLabel }}</span>
            </div>
          </div>
        </section>

        <!-- Section 7: Lifecycle Stage -->
        <section class="status-section">
          <div class="section-header">
            <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 生命週期階段</h3>
            <span class="section-badge lifecycle-badge" :class="lifecycleClass">{{ health.lifecycle.stage }}</span>
          </div>
          <div class="lifecycle-card">
            <div class="lifecycle-grid">
              <LifecycleItem label="當前階段" :value="lifecycleStageLabel" :icon="lifecycleIcon" />
              <LifecycleItem v-if="health.lifecycle.yearsToRetirement != null" label="距退休" :value="health.lifecycle.yearsToRetirement" unit="年" />
              <LifecycleItem label="槓桿上限" :value="health.lifecycleProfile.maxLeverage" unit="x" />
              <LifecycleItem label="新增Z2上限" :value="health.lifecycleProfile.maxLeverageForNewZ2" unit="x" />
              <LifecycleItem label="最低生存跌幅" :value="health.lifecycleProfile.minSurvivalDropLimit" unit="%" />
              <LifecycleItem label="模式" :value="lifecycleModeLabel" />
            </div>
          </div>
        </section>

        <!-- Section 9: Key Metrics -->
        <section class="status-section compact">
          <div class="section-header">
            <h3 class="section-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 關鍵指標速覽</h3>
          </div>
          <div class="metrics-grid">
            <MetricItem label="淨資產" :value="health.keyMetrics.netAsset" unit="元" format="number" />
            <MetricItem label="Z2 佔比" :value="health.keyMetrics.z2Ratio" unit="%" />
            <MetricItem label="實際槓桿" :value="health.keyMetrics.actualLeverage" unit="x" />
          </div>
        </section>
      </div>

    </div>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import Icon from "@/components/common/Icon.vue";
import { apiFetch } from "../api/index.js";
import { waitReady } from "../composables/useTelegram.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";

// Components
import ScoreBar from "../components/dashboard/ScoreBar.vue";
import AllocationTier from "../components/dashboard/AllocationTier.vue";
import ThresholdItem from "../components/dashboard/ThresholdItem.vue";
import StatCard from "@/components/common/StatCard.vue";
import LifecycleItem from "../components/dashboard/LifecycleItem.vue";
import RiskItem from "../components/dashboard/RiskItem.vue";
import MetricItem from "../components/dashboard/MetricItem.vue";

// Props (Phase 3: prop-driven, parent DashboardView passes :health)
const props = defineProps({
  health: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
});

// Internal state for fallback self-load mode (used when no :health prop)
const data = ref(null);
const internalLoading = ref(true);
const internalError = ref(null);
const activeTab = ref("scores"); // "scores" | "risk"

// Computed: prefer prop health, fall back to internal data
const health = computed(() => props.health ?? data.value);
const isLoading = computed(() =>
  props.health !== null || props.error !== null
    ? props.loading
    : internalLoading.value,
);
const loadError = computed(() =>
  props.health !== null || props.error !== null
    ? props.error
    : internalError.value,
);

// Load data (only when no :health prop provided by parent)
const loadData = async () => {
  if (props.health != null) return; // prop-driven: skip self-load
  internalLoading.value = true;
  internalError.value = null;
  try {
    const res = await apiFetch("/api/strategy-status");
    data.value = res;
  } catch (err) {
    if (err.status === 404) {
      internalError.value = "策略狀態數據尚未產生或服務升級中，請稍後再試。";
    } else {
      internalError.value = "無法載入策略狀態：" + err.message;
    }
  } finally {
    internalLoading.value = false;
  }
};

// Computed helpers
const scoreClass = computed(() => {
  const score = health.value?.weightScore?.total ?? 0;
  if (score >= 8) return "badge-buy";
  if (score >= 4) return "badge-wait";
  return "badge-sell";
});

const cooldownClass = computed(() => 
  health.value?.cooldown?.inCooldown ? "badge-warn" : "badge-ok"
);

const budgetClass = computed(() => 
  health.value?.budget?.isLimited ? "badge-danger" : "badge-ok"
);

const signalCategoryClass = computed(() => {
  const cat = health.value?.signal?.category ?? "baseline";
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
  const cat = health.value?.signal?.category ?? "baseline";
  const map = {
    panic: "恐慌",
    deep_drop: "深度回撤",
    take_profit: "停利獲利",
    rebalance: "再平衡",
    baseline: "底倉/觀望",
  };
  return map[cat] ?? cat;
});

const signalCategoryIcon = computed(() => {
  const cat = health.value?.signal?.category ?? "baseline";
  const map = {
    panic: "danger",
    deep_drop: "danger",
    take_profit: "ok",
    rebalance: "default",
    baseline: "default",
  };
  return map[cat] ?? "default";
});

const signalTypeClass = computed(() => {
  const type = health.value?.signal?.type ?? "baseline";
  const map = {
    tactical_panic: "badge-danger",
    tactical_drop: "badge-warn",
    baseline: "badge-ok",
  };
  return map[type] ?? "badge-ok";
});

const signalTypeLabel = computed(() => {
  const type = health.value?.signal?.type ?? "baseline";
  const map = {
    tactical_panic: "戰術恐慌",
    tactical_drop: "戰術回撤",
    baseline: "底倉/觀望",
  };
  return map[type] ?? type;
});

const signalTypeIcon = computed(() => {
  const type = health.value?.signal?.type ?? "baseline";
  const map = {
    tactical_panic: "danger",
    tactical_drop: "warn",
    baseline: "default",
  };
  return map[type] ?? "default";
});

const lifecycleClass = computed(() => {
  const stage = health.value?.lifecycle?.stage ?? "EARLY";
  const map = {
    EARLY: "badge-buy",
    MID: "badge-wait",
    LATE: "badge-warn",
    PRE_RETIRE: "badge-danger",
  };
  return map[stage] ?? "badge-ok";
});

const lifecycleStageLabel = computed(() => {
  const stage = health.value?.lifecycle?.stage ?? "EARLY";
  const map = {
    EARLY: "早期累積期 (>15年)",
    MID: "中期平衡期 (10-15年)",
    LATE: "後期保守期 (5-10年)",
    PRE_RETIRE: "退休前保守期 (<5年)",
  };
  return map[stage] ?? stage;
});

const lifecycleIcon = computed(() => {
  const stage = health.value?.lifecycle?.stage ?? "EARLY";
  const map = {
    EARLY: "default",
    MID: "default",
    LATE: "default",
    PRE_RETIRE: "default",
  };
  return map[stage] ?? "default";
});

const lifecycleModeLabel = computed(() => {
  const mode = health.value?.lifecycleProfile?.mode ?? "unknown";
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
  const regime = health.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "danger", CAUTIOUS: "warn", NORMAL: "ok" };
  return map[regime] ?? "neutral";
});

const regimeClass = computed(() => {
  const regime = health.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "badge-danger", CAUTIOUS: "badge-warn", NORMAL: "badge-ok" };
  return map[regime] ?? "badge-ok";
});

const riskLabel = computed(() => {
  const regime = health.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "危機", CAUTIOUS: "警戒", NORMAL: "正常" };
  return map[regime] ?? regime;
});

const riskClass = computed(() => {
  const regime = health.value?.risk?.regime ?? "NORMAL";
  const map = { CRISIS: "badge-danger", CAUTIOUS: "badge-warn", NORMAL: "badge-ok" };
  return map[regime] ?? "badge-ok";
});

const directionClass = computed(() => {
  const dir = health.value?.signal?.direction ?? "hold";
  const map = { long: "text-buy", short: "text-sell", hold: "text-wait" };
  return map[dir] ?? "";
});

// ScoreBar 描述輔助函數
const getDropScoreDesc = (score) => {
  if (score >= 4) return "跌幅較大，策略積極加碼";
  if (score >= 2) return "跌幅中等，觀察機會";
  return "跌幅較小，維持觀望";
};

const getRsiScoreDesc = (score) => {
  if (score >= 4) return "RSI 明顯超賣";
  if (score >= 2) return "RSI 略微超賣";
  return "RSI 中性";
};

const getMacdScoreDesc = (score) => {
  if (score >= 3) return "MACD 金叉強烈";
  if (score >= 1) return "MACD 轉強";
  return "MACD 無明顯訊號";
};

const getKdScoreDesc = (score) => {
  if (score >= 3) return "KD 金叉明確";
  if (score >= 1) return "KD 略微轉強";
  return "KD 無明顯訊號";
};

const getSentimentScoreDesc = (score) => {
  if (score >= 3) return "情緒極度恐慌，反向機會大";
  if (score >= 1) return "情緒偏恐慌";
  if (score <= -3) return "情緒極度貪婪，風險增加";
  if (score <= -1) return "情緒偏貪婪";
  return "情緒中性";
};

const allocationTiers = computed(() => {
  const strategy = health.value?.strategySnapshot ?? {};
  const allocation = strategy.allocation ?? {};
  // Filter out null/non-object values before mapping
  const validTiers = Array.isArray(allocation)
    ? allocation
    : Object.values(allocation).filter(t => t && typeof t === "object");
  return validTiers.map(tier => ({
    minScore: tier.minScore ?? 0,
    leverage: tier.leverage ?? 0,
    cash: tier.cash ?? 0,
    comment: tier.comment ?? "",
  }));
});

const formatTime = (iso) => new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
const formatDate = (iso) => new Date(iso).toLocaleDateString("zh-TW");

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
  color: var(--iln-hint);
  margin: 0 0 12px;
}
.last-updated {
  font-size: 11px;
  color: var(--iln-hint);
}

.status-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sk-card {
  height: 120px;
  background: linear-gradient(90deg, var(--iln-surface) 25%, var(--iln-surface) 50%, var(--iln-surface) 75%);
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
  color: var(--iln-danger-text);
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
  background: var(--iln-bg);
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

.badge-ok { background: var(--iln-ok-bg); color: var(--iln-ok-text); }
.badge-warn { background: var(--iln-warn-bg); color: var(--iln-warn-text); }
.badge-danger { background: var(--iln-danger-bg); color: var(--iln-danger-text); }
.badge-buy { background: var(--iln-info-bg); color: var(--iln-info-text); }
.badge-sell { background: var(--iln-danger-bg); color: var(--iln-danger-text); }
.badge-profit { background: var(--iln-ok-bg); color: var(--iln-ok-text); }
.badge-rebalance { background: var(--iln-info-bg); color: var(--iln-info-text); }

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
  background: var(--iln-surface);
  border-radius: 12px;
}
.cooldown-card.in-cooldown {
  background: var(--iln-warn-bg);
  border: 1px solid var(--iln-warn);
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
  color: var(--iln-warn-text);
  margin-top: 2px;
}
.cooldown-message {
  font-size: 12px;
  color: var(--iln-hint);
  margin-top: 2px;
}
.cooldown-detail {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--iln-hint);
  padding-top: 4px;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.detail-label { color: var(--iln-hint); }
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
  background: var(--iln-info-bg);
  border-radius: 12px;
  margin-top: 8px;
}
.next-label { font-size: 12px; color: var(--iln-hint); }
.next-score { font-weight: 600; color: var(--iln-info-text); }

/* Thresholds */
.thresholds-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* Budget */
.budget-card {
  background: var(--iln-surface);
  border-radius: 12px;
  padding: 16px;
}
.budget-card.limited {
  background: var(--iln-danger-bg);
  border: 1px solid var(--iln-danger);
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
.type-label { font-size: 12px; color: var(--iln-hint); }
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
  background: var(--iln-danger-bg);
  border-radius: 8px;
  color: var(--iln-danger-text);
  font-size: 12px;
}

/* Signal Card */
.signal-card {
  background: var(--iln-surface);
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
.badge-profit { background: var(--iln-ok-bg); color: var(--iln-ok-text); }
.badge-rebalance { background: var(--iln-info-bg); color: var(--iln-info-text); }
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
.detail-label { color: var(--iln-hint); }
.detail-value { font-weight: 500; }
.signal-direction.text-buy { color: var(--iln-ok-text); }
.signal-direction.text-sell { color: var(--iln-danger-text); }
.signal-direction.text-wait { color: var(--iln-brand); }

/* Lifecycle */
.lifecycle-card {
  background: var(--iln-surface);
  border-radius: 12px;
  padding: 16px;
}
.lifecycle-badge.badge-buy { background: var(--iln-ok-bg); color: var(--iln-ok-text); }
.lifecycle-badge.badge-wait { background: var(--iln-wait-bg); color: var(--iln-wait-text); }
.lifecycle-badge.badge-warn { background: var(--iln-warn-bg); color: var(--iln-warn-text); }
.lifecycle-badge.badge-danger { background: var(--iln-danger-bg); color: var(--iln-danger-text); }
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
  background: var(--iln-bg);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}
.budget-item .label, .lifecycle-item .label, .risk-item .label, .metric-item .label, .threshold-item .label {
  font-size: 11px;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.budget-item .value, .lifecycle-item .value, .risk-item .value, .metric-item .value, .threshold-item .value {
  font-size: 16px;
  font-weight: 700;
  color: var(--iln-text);
}
.budget-item .unit, .lifecycle-item .unit, .risk-item .unit, .metric-item .unit, .threshold-item .unit {
  font-size: 10px;
  color: var(--iln-hint);
  margin-left: 2px;
}

/* ── Segmented Control ── */
.segmented-control {
  display: flex;
  background: var(--tg-theme-secondary-bg-color, rgba(0, 0, 0, 0.05));
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 16px;
  gap: 4px;
}
.segmented-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-hint);
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.segmented-btn.active {
  background: var(--iln-bg);
  color: var(--iln-brand);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* Allocation Tier */
.allocation-tier {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--iln-surface);
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.3s;
}
.allocation-tier.is-current {
  background: var(--iln-info-bg);
  border-color: var(--iln-brand);
}
.allocation-tier.is-next {
  background: var(--iln-warn-bg);
  border-color: var(--iln-warn);
}
.tier-score {
  font-size: 12px;
  color: var(--iln-hint);
  min-width: 60px;
  text-align: right;
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
.tier-fill.current { background: var(--iln-brand); }
.tier-fill.next { background: var(--iln-warn); }
.tier-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 80px;
}
.tier-leverage { font-weight: 600; font-size: 14px; }
.tier-cash { font-size: 11px; color: var(--iln-hint); }
.tier-comment { font-size: 10px; color: var(--iln-hint); margin-top: 2px; }

/* Utility */
.text-buy { color: var(--iln-ok-text); }
.text-sell { color: var(--iln-danger-text); }
.text-wait { color: var(--iln-brand); }
.text-ok { color: var(--iln-ok-text); }
.text-warn { color: var(--iln-warn-text); }
.text-danger { color: var(--iln-danger-text); }
</style>