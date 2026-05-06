<template>
  <div class="view-container">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-title-row">
        <h2 class="dash-title">投資儀表板</h2>
        <span class="dash-date">{{ todayLabel }}</span>
      </div>
      
      <!-- Tab Navigation -->
      <div class="dash-tabs">
        <button class="tab-item" :class="{ active: currentTab === 'summary' }" @click="currentTab = 'summary'">總覽</button>
        <button class="tab-item" :class="{ active: currentTab === 'health' }" @click="currentTab = 'health'">
          健康度
          <span v-if="healthData?.status === 'RED'" class="tab-badge">!</span>
        </button>
        <button class="tab-item" :class="{ active: currentTab === 'analysis' }" @click="currentTab = 'analysis'">詳細分析</button>
      </div>
    </div>

    <!-- Tab Content: Summary -->
    <div v-if="currentTab === 'summary'" class="tab-pane fade-in">
      <!-- Market Snapshot -->
      <section class="section">
      <h3 class="section-title">市場快照</h3>
      <div v-if="statusLoading" class="snapshot-grid snapshot-grid--4">
        <div v-for="i in 4" :key="i" class="snapshot-card skeleton-card">
          <div class="sk sk-label"></div>
          <div class="sk sk-value"></div>
          <div class="sk sk-sub"></div>
        </div>
      </div>
      <div v-else-if="statusError" class="inline-error">⚠️ 快照載入失敗</div>
      <div v-else class="snapshot-grid snapshot-grid--4">
        <div class="snapshot-card" :class="vixLevel.cardClass">
          <span class="snap-label">VIX 恐慌</span>
          <span class="snap-value">{{
            status?.data?.rawUsMarket?.vix ?? "—"
          }}</span>
          <span class="snap-sub" :class="vixLevel.textClass">{{
            vixLevel.label
          }}</span>
        </div>
        <div class="snapshot-card" :class="pbPrLevel.cardClass">
          <span class="snap-label">PB 分位數</span>
          <span class="snap-value">{{ pbPrValue }}%</span>
          <span class="snap-sub" :class="pbPrLevel.textClass">{{
            pbPrLevel.label
          }}</span>
        </div>
        <div class="snapshot-card" :class="glLevel.cardClass">
          <span class="snap-label">總曝險 GL</span>
          <span class="snap-value">{{ glValue }}x</span>
          <span class="snap-sub" :class="glLevel.textClass">{{
            glLevel.label
          }}</span>
        </div>
        <div class="snapshot-card">
          <span class="snap-label">景氣燈號</span>
          <span class="snap-value snap-light">{{ lightEmoji }}</span>
          <span class="snap-sub snap-sub--neutral">{{ lightText }}</span>
        </div>
      </div>
    </section>

      </section>
      
      <!-- AI 教練建議 (移至總覽) -->
      <section class="section" v-if="latestReport?.ai">
        <h3 class="section-title">🤖 AI 教練建議</h3>
        <div class="ai-block" v-if="aiRiskWarnings.length">
          <button class="ai-block-header" @click="aiRiskExpanded = !aiRiskExpanded">
            <span>⚠️ 風險提示</span>
            <span class="ai-count">{{ aiRiskWarnings.length }} 項</span>
            <span class="expand-arrow">{{ aiRiskExpanded ? "▲" : "▼" }}</span>
          </button>
          <ul v-if="aiRiskExpanded" class="ai-list ai-list--risk">
            <li v-for="(item, i) in aiRiskWarnings" :key="i">{{ item }}</li>
          </ul>
        </div>
        <div class="ai-block" v-if="aiActionItems.length">
          <button class="ai-block-header" @click="aiActionExpanded = !aiActionExpanded">
            <span>📌 下一步觀察清單</span>
            <span class="ai-count">{{ aiActionItems.length }} 項</span>
            <span class="expand-arrow">{{ aiActionExpanded ? "▲" : "▼" }}</span>
          </button>
          <ul v-if="aiActionExpanded" class="ai-list ai-list--action">
            <li v-for="(item, i) in aiActionItems" :key="i">{{ item }}</li>
          </ul>
        </div>
      </section>
    </div>

    <!-- Tab Content: Health -->
    <div v-if="currentTab === 'health'" class="tab-pane fade-in">
      <!-- Portfolio Health Dashboard (Phase 1) -->
      <section class="section" v-if="!healthLoading">
        <div class="section-header">
          <h3 class="section-title">帳戶健康監控</h3>
          <span v-if="healthError" class="inline-error--small">載入失敗</span>
        </div>
        
        <div v-if="healthError" class="inline-error">⚠️ 健康度資料載入失敗</div>
        <div v-else-if="!healthData" class="inline-hint">📭 尚無健康度資料</div>
        <div v-else class="health-dashboard-v2">
          <!-- Health Score Hero Card -->
          <div class="health-hero-v2" :class="healthData.status.toLowerCase()">
            <div class="glass-overlay"></div>
            <div class="health-hero-content">
              <div class="health-hero-top">
                <div class="health-hero-status">
                  <span class="health-hero-emoji">{{ healthData.lightStatus.emoji }}</span>
                  <div class="health-hero-labels">
                    <span class="health-hero-title">帳戶健康評級</span>
                    <span class="health-hero-label">{{ healthData.lightStatus.label }}</span>
                  </div>
                </div>
                <div class="health-hero-score-wrapper">
                  <span class="health-hero-score">{{ healthData.score }}</span>
                  <span class="health-hero-score-unit">/100</span>
                </div>
              </div>
              <p class="health-hero-summary">{{ healthData.summary }}</p>
            </div>
          </div>

          <!-- Health Components Grid -->
          <div class="health-grid-v2">
            <div v-for="(comp, key) in healthData.components" :key="key" 
                 class="health-glass-card" :class="comp.status.toLowerCase()">
              <div class="comp-header">
                <span class="comp-icon">{{ getCompIcon(key) }}</span>
                <span class="comp-name">{{ getCompName(key) }}</span>
              </div>
              <div class="comp-body">
                <div class="comp-value">{{ getCompValue(comp) }}</div>
                <div class="comp-sub">{{ comp.details.message || comp.details.stage || '正常' }}</div>
              </div>
              <div class="comp-status-dot"></div>
            </div>
          </div>

          <!-- Recommendations -->
          <div class="health-action-v2" v-if="healthData.recommendations.length">
            <div class="action-header">
              <span class="action-icon">💡</span>
              <span class="action-title">策略建議行動</span>
            </div>
            <div class="action-list-v2">
              <div v-for="(rec, i) in healthData.recommendations" :key="i" class="action-item-v2">
                {{ rec }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Tab Content: Analysis -->
    <div v-if="currentTab === 'analysis'" class="tab-pane fade-in">
      <div class="tab-content" v-if="activeTab === 'offense'">
        <div class="offense-panel">
          <div class="offense-top">
             <div class="radar-verdict" :class="scoreOk ? 'verdict-ok' : 'verdict-wait'">
               {{ scoreOk ? "🟢 達標" : "⏸️ 觀望" }} ({{ scoreVal }} / {{ scoreMin }})
             </div>
             <button class="toggle-btn" @click="showScoreList = !showScoreList">
               {{ showScoreList ? "切換雷達圖" : "查看列表" }}
             </button>
          </div>
          
          <div v-if="!showScoreList" class="radar-wrapper">
            <v-chart :option="radarOption" autoresize class="radar-chart" />
          </div>
          <div v-else class="score-list">
            <div class="score-row" v-for="row in scoreRows" :key="row.label" :class="row.active ? 'score-row--active' : ''">
              <span class="score-icon">{{ row.active ? "⭐" : "➖" }}</span>
              <span class="score-label">{{ row.label }}</span>
              <span class="score-pt" :class="row.active ? 'score-pt--active' : ''">{{ row.pt }}</span>
              <span class="score-info">{{ row.info }}</span>
            </div>
            <div class="score-verdict" :class="scoreOk ? 'verdict-ok' : 'verdict-wait'">
              {{ scoreOk ? "🟢 條件達標，可評估入場" : "⏸️ 條件未滿，請維持觀望" }}
            </div>
          </div>
          
          <router-link to="/technical" class="nav-card mt-3">
            <div class="nav-card-icon">📈</div>
            <div class="nav-card-main">
              <p class="nav-card-title">查看詳細技術指標</p>
              <p class="nav-card-desc">RSI, KD, MACD 趨勢與訊號雷達</p>
            </div>
            <div class="nav-card-arrow">→</div>
          </router-link>
        </div>
      </div>

      <div class="tab-content" v-if="activeTab === 'defense'">
        <div class="defense-panel">
          <!-- Valuation Guard -->
          <div class="defense-item">
            <div class="defense-icon">⚖️</div>
            <div class="defense-main">
              <div class="defense-title">估值守衛 (Valuation Guard)</div>
              <div class="defense-status" :class="vgClass">{{ valuationGuardText }}</div>
              <div class="defense-desc">當前位階: PR{{ pbPrValue }}% | 動量補正: {{ momentumText || '無' }}</div>
            </div>
          </div>
          
          <!-- Gross Leverage -->
          <div class="defense-item">
            <div class="defense-icon">📊</div>
            <div class="defense-main">
              <div class="defense-title">槓桿天花板 (Gross Leverage)</div>
              <div class="defense-status" :class="glLevel.textClass">{{ glLevel.label }}</div>
              <div class="defense-desc">當前曝險: {{ glValue }}x</div>
            </div>
          </div>
          
          <!-- Maintenance Risk -->
          <div class="defense-item">
            <div class="defense-icon">🛡️</div>
            <div class="defense-main">
              <div class="defense-title">維持率安全 (Maintenance)</div>
              <div class="defense-status" :class="maintenanceClass">{{ maintenanceText }}</div>
              <div class="defense-desc">跌破警戒線將觸發降槓桿程序</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- AI 教練建議 -->
    <section class="section" v-if="latestReport?.ai">
      <h3 class="section-title">🤖 AI 教練建議</h3>

      <div class="ai-block" v-if="aiRiskWarnings.length">
        <button
          class="ai-block-header"
          @click="aiRiskExpanded = !aiRiskExpanded"
        >
          <span>⚠️ 風險提示</span>
          <span class="ai-count">{{ aiRiskWarnings.length }} 項</span>
          <span class="expand-arrow">{{ aiRiskExpanded ? "▲" : "▼" }}</span>
        </button>
        <ul v-if="aiRiskExpanded" class="ai-list ai-list--risk">
          <li v-for="(item, i) in aiRiskWarnings" :key="i">{{ item }}</li>
        </ul>
      </div>

      <div class="ai-block" v-if="aiActionItems.length">
        <button
          class="ai-block-header"
          @click="aiActionExpanded = !aiActionExpanded"
        >
          <span>📌 下一步觀察清單</span>
          <span class="ai-count">{{ aiActionItems.length }} 項</span>
          <span class="expand-arrow">{{ aiActionExpanded ? "▲" : "▼" }}</span>
        </button>
        <ul v-if="aiActionExpanded" class="ai-list ai-list--action">
          <li v-for="(item, i) in aiActionItems" :key="i">{{ item }}</li>
        </ul>
      </div>

      <div class="ai-block" v-if="aiMindsetAdvice.length">
        <button
          class="ai-block-header"
          @click="aiMindsetExpanded = !aiMindsetExpanded"
        >
          <span>💡 行動微調建議</span>
          <span class="ai-count">{{ aiMindsetAdvice.length }} 項</span>
          <span class="expand-arrow">{{ aiMindsetExpanded ? "▲" : "▼" }}</span>
        </button>
        <ul v-if="aiMindsetExpanded" class="ai-list ai-list--mindset">
          <li v-for="(item, i) in aiMindsetAdvice" :key="i">{{ item }}</li>
        </ul>
      </div>

      <div class="ai-block" v-if="aiInternalThinking">
        <button
          class="ai-block-header"
          @click="aiThinkingExpanded = !aiThinkingExpanded"
        >
          <span>🧠 教練內心推演</span>
          <span class="expand-arrow">{{ aiThinkingExpanded ? "▲" : "▼" }}</span>
        </button>
        <p v-if="aiThinkingExpanded" class="ai-thinking">
          {{ aiInternalThinking }}
        </p>
      </div>
    </section>

    <!-- News Preview -->
    <section class="section">
      <div class="section-header">
        <h3 class="section-title">最新消息</h3>
        <router-link to="/news" class="section-more">查看全部 →</router-link>
      </div>
      <div v-if="newsLoading" class="news-preview-list">
        <div v-for="i in 3" :key="i" class="news-preview-card skeleton-card">
          <div class="sk sk-label" style="width: 40%"></div>
          <div class="sk sk-title" style="margin-top: 6px"></div>
        </div>
      </div>
      <div v-else-if="newsError" class="inline-error">⚠️ 新聞載入失敗</div>
      <div v-else-if="topNews.length === 0" class="inline-hint">
        📭 目前無新聞
      </div>
      <div v-else class="news-preview-list">
        <div
          v-for="article in topNews"
          :key="article.id || article.url || article.title"
          class="news-preview-card"
          @click="openLink(article.url)"
        >
          <div class="news-preview-meta">
            <span
              class="news-age-dot"
              :class="ageDotClass(article.age_band)"
            ></span>
            <span class="news-preview-source">{{ article.source }}</span>
            <span class="news-preview-region">{{
              regionFlag(article._region)
            }}</span>
          </div>
          <p class="news-preview-title">{{ article.title }}</p>
        </div>
      </div>
    </section>

    <p v-if="status?._meta?.lastRun" class="update-time">
      資料更新：{{ formatUpdatedAt(status._meta.lastRun) }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus, fetchReports, fetchNews, fetchPortfolioHealth } from "../api/index.js";
import { useTelegram, waitReady } from "../composables/useTelegram.js";

// ECharts
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { RadarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  RadarComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([
  RadarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  RadarComponent,
  CanvasRenderer,
]);

const { openLink } = useTelegram();

// ── state ──
const status = ref(null);
const statusLoading = ref(true);
const statusError = ref(false);

const latestReport = ref(null);
const reportLoading = ref(true);
const reportError = ref(false);

const topNews = ref([]);
const newsLoading = ref(true);
const newsError = ref(false);

// ── Portfolio Health (Phase 1) ──
const healthData = ref(null);
const healthLoading = ref(true);
const healthError = ref(false);

// ── expand states ──
const strategyExpanded = ref(false);
const showScoreList = ref(false);
const aiRiskExpanded = ref(true);
const aiActionExpanded = ref(true);
const aiMindsetExpanded = ref(false);
const aiThinkingExpanded = ref(false);
const activeTab = ref("offense");

// ── Helper methods ──
const getCompIcon = (key) => {
  const icons = {
    margin: "🛡️",
    survival: "📉",
    decoupling: "💰",
    leverage: "📊",
    lifecycle: "📅",
    regime: "🌤️",
  };
  return icons[key] || "🔹";
};

const getCompName = (key) => {
  const names = {
    margin: "維持率",
    survival: "生存空間",
    decoupling: "資產解耦",
    leverage: "槓桿比例",
    lifecycle: "生命週期",
    regime: "市場環境",
  };
  return names[key] || key;
};

const getCompValue = (comp) => {
  const details = comp.details;
  if (details.margin) return `${details.margin}%`;
  // 支援後端傳回的 "N/A (無風險)" 或數值百分比
  if (details.dropPercent != null) {
    return typeof details.dropPercent === 'number' 
      ? `${details.dropPercent.toFixed(1)}%` 
      : details.dropPercent;
  }
  if (details.z2Ratio != null) return `${details.z2Ratio.toFixed(1)}%`;
  if (details.current != null) return `${details.current.toFixed(2)}x`;
  if (details.stage) return details.stage;
  if (details.vix) return `VIX ${details.vix}`;
  return "—";
};

// ── today label ──
const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

// ── AI computed ──
// 1. 先宣告 aiData 防呆，若 latestReport 或 ai 為空則回傳空物件
const aiData = computed(() => latestReport.value?.ai ?? {});

// 2. 接著對應 JSON 的 snake_case 欄位進行綁定
const aiRiskWarnings = computed(() => aiData.value.risk_warnings ?? []);
const aiActionItems = computed(() => aiData.value.action_items ?? []);
const aiMindsetAdvice = computed(() => aiData.value.mindset_advice ?? []);
const aiInternalThinking = computed(
  () => aiData.value.coach_internal_thinking ?? "",
);

// ── VIX level ──
const vixLevel = computed(() => {
  const statusVix = status.value?.data?.rawUsMarket?.vix;
  const v =
    statusVix != null
      ? parseFloat(statusVix)
      : latestReport.value?.marketState?.sentiment?.vix;
  if (v == null)
    return { label: "—", cardClass: "", textClass: "snap-sub--neutral" };
  if (v >= 30)
    return {
      label: "極度恐慌",
      cardClass: "card-danger",
      textClass: "snap-sub--danger",
    };
  if (v >= 20)
    return {
      label: "警戒",
      cardClass: "card-warn",
      textClass: "snap-sub--warn",
    };
  return { label: "平穩", cardClass: "card-ok", textClass: "snap-sub--ok" };
});

// ── PB PR level ──
const pbPrValue = computed(() => {
  const sigs = latestReport.value?.signals;
  // 檢查所有可能路徑：valuationGuardResult, marketState, 或直接在 signals 下
  const v = sigs?.valuationGuardResult?.currentPR ?? 
            sigs?.marketState?.valuation?.currentPR ??
            sigs?.currentPR;
  return v != null ? Math.round(v) : "—";
});

const pbPrLevel = computed(() => {
  const v = Number(pbPrValue.value);
  if (isNaN(v))
    return { label: "—", cardClass: "", textClass: "snap-sub--neutral" };
  if (v >= 90)
    return {
      label: "極度昂貴",
      cardClass: "card-danger",
      textClass: "snap-sub--danger",
    };
  if (v >= 80)
    return {
      label: "估值偏高",
      cardClass: "card-warn",
      textClass: "snap-sub--warn",
    };
  if (v <= 25)
    return {
      label: "極度便宜",
      cardClass: "card-ok",
      textClass: "snap-sub--ok",
    };
  return { label: "合理區間", cardClass: "", textClass: "snap-sub--neutral" };
});

// ── Gross Leverage level ──
const glValue = computed(() => {
  const v = latestReport.value?.signals?.grossLeverage;
  return v != null ? Number(v).toFixed(2) : "—";
});

const glLevel = computed(() => {
  const v = Number(glValue.value);
  if (isNaN(v))
    return { label: "—", cardClass: "", textClass: "snap-sub--neutral" };
  if (v >= 3.0)
    return {
      label: "強制砍倉",
      cardClass: "card-danger",
      textClass: "snap-sub--danger",
    };
  if (v >= 2.5)
    return {
      label: "暫停加碼",
      cardClass: "card-warn",
      textClass: "snap-sub--warn",
    };
  return { label: "安全水位", cardClass: "card-ok", textClass: "snap-sub--ok" };
});

// ── Business cycle emoji ──
// 統一使用 /api/status 的 rawNdc.light，確保與 MarketRadar 同步
const lightEmoji = computed(() => {
  const sig = status.value?.data?.rawNdc?.light ?? "";
  if (sig.includes("黃紅") || sig.includes("活絡") || sig.includes("yellow-red")) return "🟠";
  if (sig.includes("黃藍") || sig.includes("趨緩") || sig.includes("yellow-blue")) return "🟡";
  if (sig.includes("紅") || sig.includes("熱絡") || sig === "red") return "🔴";
  if (sig.includes("綠") || sig.includes("穩定") || sig === "green") return "🟢";
  if (sig.includes("藍") || sig.includes("低迷") || sig === "blue") return "🔵";
  return "⚪";
});

const lightText = computed(() => {
  const sig = status.value?.data?.rawNdc?.light ?? "";
  if (!sig) return "—";
  if (sig.includes("黃紅") || sig.includes("yellow-red")) return "黃紅燈";
  if (sig.includes("黃藍") || sig.includes("yellow-blue")) return "黃藍燈";
  if (sig.includes("紅") || sig === "red") return "紅燈";
  if (sig.includes("綠") || sig === "green") return "綠燈";
  if (sig.includes("藍") || sig === "blue") return "藍燈";
  return sig;
});

// ── Decision Helpers ──
const activePriority = computed(() => {
  const sigs = latestReport.value?.signals;
  if (sigs?.maintenanceRisk?.level === "Critical") return "P1 維持率危機";
  if (Number(sigs?.grossLeverage) >= 2.5) return "P2 槓桿上限";
  if (sigs?.panicBypassActive) return "P3 恐慌破冰";
  
  const vg = sigs?.valuationGuardResult;
  if (vg?.defenseLatchActive) return "P4 守衛鎖定";
  if (vg?.guardActive && vg?.hitTierIndex >= 0) {
    return `P5 估值防禦 T${vg.hitTierIndex + 1}`;
  }
  return null;
});

const statusEmoji = computed(() => {
  const s = latestReport.value?.signals?.marketStatus ?? "";
  if (s.includes("🚀") || s.includes("📈")) return "📈";
  if (s.includes("🎯") || s.includes("🛎️")) return "💰";
  if (s.includes("🔥") || s.includes("📡")) return "🚨";
  if (s.includes("⏰")) return "⏳";
  return "🌱";
});

const routingPath = computed(() => {
  const sigs = latestReport.value?.signals;
  const path = [];
  if (sigs?.maintenanceRisk) {
    path.push(sigs.maintenanceRisk.level === "Normal" ? "OK" : "⚠️追繳");
  }
  if (Number.isFinite(Number(sigs?.grossLeverage))) {
    path.push(`${Number(sigs.grossLeverage).toFixed(1)}x`);
  }
  if (sigs?.panicBypassActive) path.push("⚡破冰");

  const currentPR = sigs?.valuationGuardResult?.currentPR;
  if (Number.isFinite(Number(currentPR))) {
    path.push(`PR${Math.round(Number(currentPR))}`);
  }

  return path.join(" → ");
});

const valuationGuardText = computed(() => {
  const vg = latestReport.value?.signals?.valuationGuardResult;
  if (!vg) return null;
  if (vg.defenseLatchActive) return "🔒 防禦鎖定中 (跌破 MA20)";
  if (vg.guardActive && vg.hitTier) {
    return `${vg.hitTier.label || '防禦生效'} (${vg.multiplier}x)`;
  }
  return "🟢 估值安全 (無壓縮)";
});

const vgClass = computed(() => {
  const vg = latestReport.value?.signals?.valuationGuardResult;
  if (vg?.defenseLatchActive) return "text-danger";
  if (vg?.hitTierIndex >= 2) return "text-danger"; // 較高等級的防禦
  if (vg?.guardActive) return "text-warn";
  return "text-ok";
});

const momentumText = computed(() => {
  const vm = latestReport.value?.signals?.valuationMomentumResult;
  if (!vm || !vm.momentumLabel) return null;
  return vm.momentumLabel;
});

// ── Tab classes & formatting ──
const targetClass = computed(() => {
  const target = latestReport.value?.signals?.target || "";
  if (target.includes("加碼") || target.includes("買")) return "text-ok";
  if (target.includes("減碼") || target.includes("賣") || target.includes("平倉")) return "text-danger";
  return "text-warn";
});

const maintenanceText = computed(() => {
  const mr = latestReport.value?.signals?.maintenanceRisk;
  if (!mr) return "—";
  if (mr.level === "Critical") return "🚨 嚴重不足 (即將斷頭)";
  if (mr.level === "Warning") return "⚠️ 警戒區間";
  return "🟢 安全水位";
});

const maintenanceClass = computed(() => {
  const mr = latestReport.value?.signals?.maintenanceRisk;
  if (mr?.level === "Critical") return "text-danger";
  if (mr?.level === "Warning") return "text-warn";
  return "text-ok";
});

// ── Report badges ──
const pctClass = computed(() => {
  const p = Number(latestReport.value?.signals?.priceChangePercent);
  return p >= 0 ? "badge-pos" : "badge-neg";
});

const pctText = computed(() => {
  const r = latestReport.value;
  if (!r) return "";
  const p = Number(r.signals?.priceChangePercent);
  const text = r.signals?.priceChangePercentText ?? "—";
  return `${p >= 0 ? "+" : ""}${text}%`;
});

// ── 進場評分 ──
const w = computed(() => latestReport.value?.signals?.weightDetails ?? {});

const scoreVal = computed(() => {
  const v = latestReport.value?.signals?.score;
  return Number.isFinite(Number(v)) ? Number(v) : "--";
});

const scoreMin = computed(() => {
  const v =
    latestReport.value?.strategySnapshot?.indicator?.buy?.minWeightScoreToBuy;
  return v != null ? Number(v) : "--";
});

const scoreOk = computed(
  () =>
    typeof scoreVal.value === "number" &&
    typeof scoreMin.value === "number" &&
    scoreVal.value >= scoreMin.value,
);

const scoreRows = computed(() => [
  {
    label: "跌幅",
    pt: fmtPt(w.value.dropScore),
    info: w.value.dropInfo ?? "─",
    active: Number(w.value.dropScore) > 0,
  },
  {
    label: "RSI",
    pt: fmtPt(w.value.rsiScore),
    info: w.value.rsiInfo ?? "─",
    active: Number(w.value.rsiScore) > 0,
  },
  {
    label: "MACD",
    pt: fmtPt(w.value.macdScore),
    info: w.value.macdInfo ?? "─",
    active: Number(w.value.macdScore) > 0,
  },
  {
    label: "KD",
    pt: fmtPt(w.value.kdScore),
    info: w.value.kdInfo ?? "─",
    active: Number(w.value.kdScore) > 0,
  },
  {
    label: "情緒",
    pt: fmtPt(w.value.sentimentScore),
    info: w.value.sentimentInfo ?? "─",
    active: Number(w.value.sentimentScore) !== 0,
  },
]);

function fmtPt(v) {
  return Number.isFinite(Number(v)) ? `${Number(v)}pt` : "--";
}

// ── Radar Option ──
const radarOption = computed(() => {
  const details = latestReport.value?.signals?.weightDetails || {};
  const data = [
    Number(details.dropScore) || 0,
    Number(details.rsiScore) || 0,
    Number(details.macdScore) || 0,
    Number(details.kdScore) || 0,
    Math.abs(Number(details.sentimentScore) || 0),
  ];

  return {
    radar: {
      indicator: [
        { name: "跌幅", max: 5 },
        { name: "RSI", max: 3 },
        { name: "MACD", max: 3 },
        { name: "KD", max: 3 },
        { name: "情緒", max: 2 },
      ],
      shape: "polygon",
      axisName: { color: "var(--tg-theme-hint-color, #999)", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(0,0,0,0.05)" } },
      splitArea: {
        areaStyle: { color: ["rgba(0,0,0,0.01)", "rgba(0,0,0,0.03)"] },
      },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: data,
            name: "評分構成",
            areaStyle: { color: "rgba(36, 129, 204, 0.2)" },
            lineStyle: { color: "#2481cc", width: 2 },
            itemStyle: { color: "#2481cc" },
          },
        ],
        symbol: "none",
      },
    ],
  };
});

// ── News helpers ──
function ageDotClass(band) {
  if (band === "fresh") return "dot-fresh";
  if (band === "recent") return "dot-recent";
  return "dot-old";
}

function regionFlag(region) {
  if (region === "TW") return "🇹🇼";
  if (region === "US") return "🇺🇸";
  return "🌐";
}

function formatUpdatedAt(iso) {
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Load ──
async function loadAll() {
  const [sRes, rRes, nRes, hRes] = await Promise.allSettled([
    fetchStatus(),
    fetchReports(5),
    fetchNews(),
    fetchPortfolioHealth(),
  ]);

  statusLoading.value = false;
  if (sRes.status === "fulfilled") {
    status.value = sRes.value;
  } else {
    statusError.value = true;
  }

  reportLoading.value = false;
  if (rRes.status === "fulfilled") {
    const raw = rRes.value;
    const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.reports ?? []);
    const sorted = [...list].sort(
      (a, b) =>
        String(b.date ?? "").localeCompare(String(a.date ?? "")) ||
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
    );
    latestReport.value = sorted[0] ?? null;
  } else {
    reportError.value = true;
  }

  newsLoading.value = false;
  if (nRes.status === "fulfilled") {
    const list = Array.isArray(nRes.value)
      ? nRes.value
      : (nRes.value?.articles ?? []);
    const order = { fresh: 0, recent: 1, old: 2 };
    topNews.value = [...list]
      .sort(
        (a, b) =>
          (order[a.age_band] ?? 2) - (order[b.age_band] ?? 2) ||
          new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
      )
      .slice(0, 3);
  } else {
    newsError.value = true;
  }

  healthLoading.value = false;
  if (hRes.status === "fulfilled") {
    healthData.value = hRes.value;
  } else {
    healthError.value = true;
    console.warn("Portfolio health API not available");
  }
}

onMounted(async () => {
  await waitReady();
  await loadAll();
});
</script>

<style scoped>
.view-container {
  padding: 16px 16px 24px;
}
.dash-header {
  margin-bottom: 20px;
}
.dash-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.dash-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
}
.dash-date {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}

.section {
  margin-bottom: 24px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 10px;
}
.section-header .section-title {
  margin-bottom: 0;
}
.section-more {
  font-size: 12px;
  color: var(--tg-theme-button-color, #2481cc);
  text-decoration: none;
}
.toggle-btn {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 99px;
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
  color: var(--tg-theme-button-color, #2481cc);
  border: none;
  font-weight: 500;
}

.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.snapshot-grid--4 {
  grid-template-columns: repeat(2, 1fr);
}
@media (min-width: 360px) {
  .snapshot-grid--4 {
    grid-template-columns: repeat(4, 1fr);
  }
}

.snapshot-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}
.card-danger {
  background: rgba(232, 72, 85, 0.1);
}
.card-warn {
  background: rgba(212, 172, 13, 0.1);
}
.card-ok {
  background: rgba(38, 161, 123, 0.1);
}
.snap-label {
  font-size: 9px;
  color: var(--tg-theme-hint-color, #999);
  white-space: nowrap;
}
.snap-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  line-height: 1.2;
}
.snap-light {
  font-size: 20px;
}
.snap-sub {
  font-size: 10px;
  font-weight: 600;
}
.snap-sub--neutral {
  color: var(--tg-theme-hint-color, #999);
}
.snap-sub--danger {
  color: #e84855;
}
.snap-sub--warn {
  color: #d4ac0d;
}
.snap-sub--ok {
  color: #26a17b;
}

.decision-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 14px;
  overflow: hidden;
}
.decision-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 4px;
}
.decision-date {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  font-weight: 500;
}
.priority-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: #222;
  color: #fff;
}
.decision-main {
  padding: 4px 14px 12px;
}
.decision-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.decision-status-icon {
  font-size: 20px;
}
.decision-status-text {
  font-size: 17px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
}
.decision-suggestion {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.5;
  margin-bottom: 12px;
}
.decision-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 14px 14px;
}
.badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
}
.badge-pos {
  background: rgba(38, 161, 123, 0.15);
  color: #26a17b;
}
.badge-neg {
  background: rgba(232, 72, 85, 0.12);
  color: #e84855;
}
.badge-score {
  background: rgba(0, 0, 0, 0.06);
  color: #666;
}
.badge-target {
  background: rgba(36, 129, 204, 0.12);
  color: var(--tg-theme-button-color, #2481cc);
}

.strategy-details {
  background: rgba(0, 0, 0, 0.02);
}
.border-top {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}
.details-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
}
.details-content {
  padding: 4px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.detail-label {
  color: var(--tg-theme-hint-color, #999);
}
.detail-value {
  font-weight: 600;
  color: var(--tg-theme-text-color, #333);
}

.radar-wrapper {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 16px;
  padding: 12px 0 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.radar-chart {
  height: 200px;
  width: 100%;
}
.radar-verdict {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 16px;
  border-radius: 20px;
}

.nav-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--tg-theme-button-color, #2481cc);
  border-radius: 14px;
  text-decoration: none;
  color: #fff;
  transition: transform 0.15s;
}
.nav-card:active {
  transform: scale(0.98);
  opacity: 0.9;
}
.nav-card-icon {
  font-size: 22px;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-card-main {
  flex: 1;
}
.nav-card-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 2px;
}
.nav-card-desc {
  font-size: 11px;
  opacity: 0.85;
}
.nav-card-arrow {
  font-size: 18px;
  font-weight: 700;
  opacity: 0.7;
}

.score-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.score-row {
  display: grid;
  grid-template-columns: 20px 48px 48px 1fr;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
  font-size: 13px;
  opacity: 0.55;
}
.score-row--active {
  opacity: 1;
}
.score-pt--active {
  color: var(--tg-theme-button-color, #2481cc);
  font-weight: 700;
}
.score-verdict {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}
.verdict-ok {
  background: rgba(38, 161, 123, 0.12);
  color: #26a17b;
}
.verdict-wait {
  background: rgba(212, 172, 13, 0.1);
  color: #a07a00;
}

.ai-block {
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.07);
}
.ai-block-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  border: none;
  gap: 6px;
}
.ai-list {
  list-style: none;
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.ai-list li {
  font-size: 13px;
  line-height: 1.5;
  padding-left: 14px;
  position: relative;
}
.ai-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  font-weight: 700;
  color: var(--tg-theme-button-color, #2481cc);
}
.ai-thinking {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  font-style: italic;
}

.news-preview-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.news-preview-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  padding: 10px 12px;
}
.news-preview-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
}
.news-age-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot-fresh {
  background: #e84855;
}
.dot-recent {
  background: #d4ac0d;
}
.dot-old {
  background: #bbb;
}
.news-preview-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
}

.text-danger {
  color: #e84855;
}
.text-warn {
  color: #d4ac0d;
}
.text-ok {
  color: #26a17b;
}
.update-time {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #bbb);
  text-align: center;
  margin-top: 12px;
}
.inline-error {
  font-size: 13px;
  color: #e84855;
  padding: 10px 0;
}
.inline-hint {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
  padding: 10px 0;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
.sk {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--tg-theme-secondary-bg-color, #e8e8e8) 25%,
    rgba(255, 255, 255, 0.35) 50%,
    var(--tg-theme-secondary-bg-color, #e8e8e8) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.sk-label {
  height: 10px;
  width: 70%;
}
.sk-value {
  height: 20px;
  width: 50%;
  margin-top: 8px;
}
.sk-sub {
  height: 10px;
  width: 55%;
  margin-top: 6px;
}
.sk-title {
  height: 14px;
  width: 90%;
}
.ai-fallback {
  padding: 4px 0;
}
.ai-summary {
  font-size: 13px;
  font-weight: 500;
  color: var(--tg-theme-text-color, #333);
  line-height: 1.55;
  margin-bottom: 8px;
}
.ai-reasoning {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.55;
}

/* ── Hero Section ── */
.hero-card {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  text-align: center;
  border: 1px solid var(--tg-theme-secondary-bg-color, #f0f0f0);
}
.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.hero-date {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}
.hero-target {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 12px;
}
.target-buy { color: #26a17b; }
.target-sell { color: #e84855; }
.target-wait { color: #d4ac0d; }

.hero-suggestion {
  font-size: 15px;
  color: var(--tg-theme-text-color, #333);
  margin-bottom: 20px;
  line-height: 1.5;
}
.hero-badges {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}
.hero-route {
  padding-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.route-label {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}
.route-path {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #111);
}

/* ── Top Nav Tabs ── */
.dash-tabs {
  display: flex;
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
  border-radius: 12px;
  padding: 4px;
  margin-top: 16px;
  gap: 4px;
}
.tab-item {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
  border-radius: 9px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.tab-item.active {
  background: var(--tg-theme-bg-color, #fff);
  color: var(--tg-theme-text-color, #111);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.tab-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  background: #e74c3c;
  color: #fff;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.tab-pane {
  display: block;
}
.fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Tabs (Inner) ── */
.tab-header {
  display: flex;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
}
.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #999);
  border-radius: 8px;
  transition: all 0.2s ease;
}
.tab-btn.active {
  background: var(--tg-theme-bg-color, #fff);
  color: var(--tg-theme-text-color, #111);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.tab-content {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--tg-theme-secondary-bg-color, #f0f0f0);
}

/* ── Offense Panel ── */
.offense-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.mt-3 {
  margin-top: 16px;
}

/* ── Defense Panel ── */
.defense-item {
  display: flex;
  align-items: flex-start;
  padding: 16px 0;
  border-bottom: 1px solid var(--tg-theme-secondary-bg-color, #f0f0f0);
}
.defense-item:first-child {
  padding-top: 0;
}
.defense-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.defense-icon {
  font-size: 24px;
  margin-right: 16px;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  padding: 10px;
  border-radius: 12px;
}
.defense-main {
  flex: 1;
}
.defense-title {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 4px;
}
.defense-status {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}
.defense-desc {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #888);
}

/* ── Portfolio Health Dashboard v2 (Premium Glassmorphism) ── */
.health-dashboard-v2 {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.health-hero-v2 {
  position: relative;
  border-radius: 24px;
  padding: 24px;
  min-height: 140px;
  display: flex;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(36, 129, 204, 0.25);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.health-hero-v2:active {
  transform: scale(0.98);
}

.health-hero-v2.green {
  background: linear-gradient(135deg, #2481cc 0%, #1c639e 100%);
}

.health-hero-v2.yellow {
  background: linear-gradient(135deg, #f39c12 0%, #d35400 100%);
  box-shadow: 0 12px 32px rgba(243, 156, 18, 0.25);
}

.health-hero-v2.red {
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
  box-shadow: 0 12px 32px rgba(231, 76, 60, 0.25);
}

.glass-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  backdrop-filter: blur(4px);
  z-index: 1;
}

.health-hero-content {
  position: relative;
  z-index: 2;
  width: 100%;
  color: #fff;
}

.health-hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.health-hero-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.health-hero-emoji {
  font-size: 40px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.health-hero-labels {
  display: flex;
  flex-direction: column;
}

.health-hero-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.8;
  margin-bottom: 2px;
}

.health-hero-label {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.health-hero-score-wrapper {
  text-align: right;
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.health-hero-score {
  font-size: 44px;
  font-weight: 900;
  line-height: 1;
  font-family: "Outfit", "Inter", sans-serif;
}

.health-hero-score-unit {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.7;
}

.health-hero-summary {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
  opacity: 0.95;
  margin: 0;
}

/* Health Grid v2 */
.health-grid-v2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.health-glass-card {
  position: relative;
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.health-glass-card:active {
  transform: translateY(2px);
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
}

.comp-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comp-icon {
  font-size: 18px;
}

.comp-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
}

.comp-body {
  display: flex;
  flex-direction: column;
}

.comp-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  margin-bottom: 2px;
}

.comp-sub {
  font-size: 11px;
  font-weight: 500;
  color: var(--tg-theme-hint-color, #999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comp-status-dot {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.health-glass-card.green .comp-status-dot { background: #2ecc71; box-shadow: 0 0 8px rgba(46, 204, 113, 0.5); }
.health-glass-card.yellow .comp-status-dot { background: #f39c12; box-shadow: 0 0 8px rgba(243, 156, 18, 0.5); }
.health-glass-card.red .comp-status-dot { background: #e74c3c; box-shadow: 0 0 8px rgba(231, 76, 60, 0.5); }

/* Action List v2 */
.health-action-v2 {
  background: var(--tg-theme-secondary-bg-color, #f5f8fa);
  border-radius: 20px;
  padding: 16px;
  border: 1px dashed rgba(36, 129, 204, 0.3);
}

.action-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.action-icon { font-size: 18px; }
.action-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--tg-theme-button-color, #2481cc);
}

.action-list-v2 {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-item-v2 {
  font-size: 13px;
  font-weight: 500;
  color: var(--tg-theme-text-color, #333);
  padding: 10px 12px;
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  line-height: 1.4;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

/* Inline error style */
.inline-error {
  font-size: 13px;
  color: var(--tg-theme-text-color, #333);
  background: rgba(231, 76, 60, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid #e74c3c;
}

.inline-error--small {
  font-size: 11px;
  color: #e74c3c;
}

.inline-hint {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
  padding: 12px;
  text-align: center;
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
}
</style>
