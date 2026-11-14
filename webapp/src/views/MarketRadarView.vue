<template>
    <GlobalErrorBoundary>
    <div class="view-container">
    <div class="page-header">
      <h2 class="page-title"><Icon name="radar" size="sm" /> 市場雷達</h2>
      <span class="page-date">{{ todayLabel }}</span>
    </div>

    <!-- 長期防禦模式狀態欄 (Phase 4) -->
    <div
      v-if="isLongTermDefense"
      class="defense-mode-badge card-danger"
    >
      <span class="badge-icon"><Icon name="shield" /></span>
      <span class="badge-text">長期防禦模式中 — 嚴格控制槓桿與加碼</span>
    </div>

    <!-- 市場戰情子分頁切換列 -->
    <RadarSubtabs />

    <!-- 載入中 -->
    <div v-if="loading" class="radar-grid">
      <LoadingSkeleton variant="card" :rows="8" />
    </div>

    <!-- 錯誤 -->
    <div v-else-if="error" class="error-view">
      <ErrorView
        title="載入失敗"
        message="資料載入失敗，請稍後重試"
        @retry="loadData"
      />
    </div>

    <!-- 內容 -->
    <template v-else>
      <!-- 極端雷達與防禦層 (常態精簡/極端醒目) -->
      <ExtremeRadarPanel
        :leading-indicators="leadingIndicators"
      />

      <!-- 現金曝險分析（同步顯示於行動紀律下方） -->
      <CashExposureWidget
        v-if="leadingIndicators?.cashExposureAnalysis"
        :analysis="leadingIndicators.cashExposureAnalysis"
      />

      <!-- 美股區 -->
      <section class="section">
        <h3 class="section-title"><Icon name="radar" size="sm" /> 美股市場</h3>
        <div class="radar-grid">
          <!-- 美股 VIX -->
          <StatCard
            label="美股 VIX"
            :value="usVix ?? '—'"
            :status="cardClassToStatus(usVixCard.cls)"
            framed
          >
            <template #suffix>{{ usVixCard.label }}</template>
          </StatCard>
          <!-- S&P 500 -->
          <StatCard
            label="S&amp;P 500"
            :value="spxText"
            :status="cardClassToStatus(spxCard.cls)"
            framed
          >
            <template #suffix><Icon :name="spxCard.icon" size="sm" /> {{ spxCard.label }}</template>
          </StatCard>
          <!-- CNN 情緒 -->
          <StatCard
            label="CNN 情緒"
            :value="cnnScore ?? '—'"
            :status="cardClassToStatus(cnnCard.cls)"
            framed
          >
            <template #suffix>{{ cnnRating }}</template>
          </StatCard>
        </div>
      </section>

      <!-- 台股區 -->
      <section class="section">
        <h3 class="section-title"><Icon name="radar" size="sm" /> 台股市場</h3>
        <div class="radar-grid">
          <!-- 台股 VIX -->
          <StatCard
            label="台股 VIX"
            :value="twVix ?? '—'"
            :status="cardClassToStatus(twVixCard.cls)"
            framed
          >
            <template #suffix>{{ twVixCard.label }}</template>
          </StatCard>
          <!-- 景氣燈號 -->
          <StatCard
            label="景氣燈號"
            status="neutral"
            framed
          >
            <template #value><Icon :name="lightEmoji" /></template>
            <template #suffix>{{ lightText }}</template>
          </StatCard>
          <!-- 融資維持率 -->
          <StatCard
            label="融資維持率"
            :value="marginRatio ?? '—'"
            unit="%"
            :status="cardClassToStatus(marginCard.cls)"
            framed
          >
            <template #suffix>{{ marginCard.label }}</template>
          </StatCard>
          <!-- 大盤 PE -->
          <StatCard
            label="大盤 PE"
            :value="pe ?? '—'"
            :status="cardClassToStatus(peCard.cls)"
            framed
          >
            <template #suffix><Icon :name="peCard.icon" size="sm" /> {{ peCard.label }}</template>
          </StatCard>
          <!-- 大盤 PB -->
          <StatCard
            label="大盤 PB"
            :value="pb ?? '—'"
            :status="cardClassToStatus(pbCard.cls)"
            framed
          >
            <template #suffix><Icon :name="pbCard.icon" size="sm" /> {{ pbCard.label }}<code v-if="pbPR !== null">PR{{ pbPR }}</code></template>
          </StatCard>
          <!-- 匯率 -->
          <StatCard
            label="美元/台幣"
            :value="fxRate ?? '—'"
            :status="cardClassToStatus(fxCard.cls)"
            framed
          >
            <template #suffix><Icon :name="fxCard.icon" size="sm" /> {{ fxCard.label }}</template>
          </StatCard>
        </div>
      </section>

      <!-- 融資增減明細 -->
      <section v-if="marginChange !== null" class="section">
        <h3 class="section-title">融資餘額變化</h3>
        <div class="detail-row">
          <span class="dr-label">融資餘額</span>
          <span class="dr-value">{{ marginValue?.toFixed(1) }} 億</span>
        </div>
        <div class="detail-row">
          <span class="dr-label">單日增減</span>
          <span
            class="dr-value"
            :class="marginChange >= 0 ? 'text-green' : 'text-red'"
          >
            {{ marginChange >= 0 ? "+" : "" }}{{ marginChange?.toFixed(1) }} 億
          </span>
        </div>
        <div v-if="marginDate" class="detail-row">
          <span class="dr-label">資料日期</span>
          <span class="dr-value dr-value--muted">{{ marginDate }}</span>
        </div>
      </section>
    </template>

    <p v-if="statusMeta?.updatedAt" class="update-time">資料更新：{{ lastUpdatedText }}</p>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus, fetchReports } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import ExtremeRadarPanel from "@/components/radar/ExtremeRadarPanel.vue";
import CashExposureWidget from "@/components/radar/CashExposureWidget.vue";
import RadarSubtabs from "@/components/radar/RadarSubtabs.vue";
import { waitReady } from "../composables/useTelegram.js";
import { formatRelative, resolveLastRun } from "@/utils/formatDate.js";
import ErrorView from "@/components/common/ErrorView.vue";
import LoadingSkeleton from "@/components/common/LoadingSkeleton.vue";
import StatCard from "@/components/common/StatCard.vue";

import {
  getVixLevel,
  getCnnLevel,
  getMaintenanceLevel,
} from "@/utils/metricThresholds.js";

const loading = ref(true);
const error = ref(false);
const statusData = ref(null); // /api/status  data 欄位
const reportData = ref(null); // 最新 report（含 vixData / usRisk）
const statusMeta = ref(null); // /api/status 原始回應（含 updatedAt）

const leadingIndicators = computed(
  () =>
    reportData.value?.leadingIndicators ??
    statusData.value?.leadingIndicators ??
    null,
);

const lastUpdatedText = computed(() =>
  formatRelative(resolveLastRun(statusMeta.value)),
);

// ── 載入 ──────────────────────────────────────────────
const loadData = async () => {
  loading.value = true;
  error.value = false;
  await waitReady();
  const [sRes, rRes] = await Promise.allSettled([
    fetchStatus(),
    fetchReports(3),
  ]);
  loading.value = false;

  if (sRes.status === "fulfilled") {
    statusData.value = sRes.value?.data ?? null;
    statusMeta.value = sRes.value;
  } else {
    error.value = true;
  }

  if (rRes.status === "fulfilled") {
    const sorted = [...(rRes.value ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    reportData.value = sorted[0] ?? null;
  }
};

onMounted(() => loadData());

// ── 長期防禦模式 ────────────────────────────────────────
const isLongTermDefense = computed(() => {
  return (
    reportData.value?.leadingIndicators?.isLongTermDefense ??
    statusData.value?.leadingIndicators?.isLongTermDefense ??
    false
  );
});

// ── 今日標籤 ──────────────────────────────────────────
const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

// ── 美股 ──────────────────────────────────────────────
const usVix = computed(() => {
  const v = reportData.value?.usRisk?.vix ?? statusData.value?.rawUsMarket?.vix;
  return v ?? null;
});
function cardClassToStatus(cls) {
  const map = {
    "card-danger": "danger",
    "card-warn": "warn",
    "card-ok": "ok",
    "card-blue": null,
  };
  return map[cls] ?? null;
}

const usVixCard = computed(() => {
  const r = getVixLevel(usVix.value, "us");
  return { cls: r.cls, sub: r.subCls, label: r.label };
});

const spxRaw = computed(
  () =>
    reportData.value?.usRisk?.spxChg ??
    statusData.value?.rawUsMarket?.spxChg ??
    null,
);
const spxText = computed(() => {
  const v = spxRaw.value;
  if (v == null) return "—";
  const n = parseFloat(v);
  return !isNaN(n) && n > 0 ? `+${v}` : String(v);
});
const spxCard = computed(() => {
  const n = parseFloat(spxRaw.value);
  if (isNaN(n)) return { cls: "", sub: "rc-sub--neutral", label: "無數據", icon: "default" };
  if (n > 0) return { cls: "card-ok", sub: "rc-sub--ok", label: "上漲", icon: "chart" };
  if (n < 0) return { cls: "card-warn", sub: "rc-sub--warn", label: "下跌", icon: "chart" };
  return { cls: "", sub: "rc-sub--neutral", label: "持平", icon: "default" };
});

const cnnScore = computed(() => statusData.value?.rawCnn?.score ?? null);
const cnnRating = computed(() => statusData.value?.rawCnn?.rating ?? "—");
const cnnCard = computed(() => {
  const r = getCnnLevel(cnnScore.value);
  return { cls: r.cls, sub: r.subCls, label: r.label };
});

// ── 台股 ──────────────────────────────────────────────
const twVix = computed(() => {
  const v = reportData.value?.vixData?.value;
  return v != null ? Number(v).toFixed(1) : null;
});
const twVixCard = computed(() => {
  const r = getVixLevel(twVix.value, "tw");
  return { cls: r.cls, sub: r.subCls, label: r.label };
});

const lightEmoji = computed(() => {
  const sig = statusData.value?.rawNdc?.light ?? "";
  if (
    sig.includes("黃紅") ||
    sig.includes("活絡") ||
    sig.includes("yellow-red")
  )
    return "warn";
  if (
    sig.includes("黃藍") ||
    sig.includes("趨緩") ||
    sig.includes("yellow-blue")
  )
    return "default";
  if (sig.includes("紅") || sig.includes("熱絡") || sig === "red") return "danger";
  if (sig.includes("綠") || sig.includes("穩定") || sig === "green")
    return "ok";
  if (sig.includes("藍") || sig.includes("低迷") || sig === "blue") return "default";
  return "default";
});
const lightText = computed(() => {
  const sig = statusData.value?.rawNdc?.light ?? "";
  if (!sig) return "—";
  if (sig.includes("黃紅") || sig.includes("yellow-red")) return "黃紅燈";
  if (sig.includes("黃藍") || sig.includes("yellow-blue")) return "黃藍燈";
  if (sig.includes("紅") || sig === "red") return "紅燈";
  if (sig.includes("綠") || sig === "green") return "綠燈";
  if (sig.includes("藍") || sig === "blue") return "藍燈";
  return sig;
});

const marginValue = computed(() => {
  const v =
    reportData.value?.macroData?.rawMargin?.marginBalance100M ??
    statusData.value?.rawMargin?.marginBalance100M;
  return v != null ? Number(v) : null;
});
const marginRatio = computed(() => {
  const v =
    reportData.value?.macroData?.rawMargin?.maintenanceRatio ??
    statusData.value?.rawMargin?.maintenanceRatio;
  return v != null ? Number(v).toFixed(1) : null;
});
const marginChange = computed(() => {
  const v =
    reportData.value?.macroData?.rawMargin?.marginBalanceChange100M ??
    statusData.value?.rawMargin?.marginBalanceChange100M;
  return v != null ? Number(v) : null;
});
const marginDate = computed(
  () =>
    reportData.value?.macroData?.rawMargin?.date ??
    statusData.value?.rawMargin?.date ??
    null,
);
const marginCard = computed(() => {
  const r = getMaintenanceLevel(marginRatio.value);
  return { cls: r.cls, sub: r.subCls, label: r.label };
});

const pe = computed(() => {
  const v =
    reportData.value?.macroData?.rawValuation?.pe ??
    statusData.value?.rawValuation?.pe;
  return v != null ? Number(v) : null;
});
const peCard = computed(() => {
  const v = pe.value;
  if (v == null) return { cls: "", sub: "rc-sub--neutral", label: "—", icon: "default" };
  if (v < 12)
    return { cls: "card-blue", sub: "rc-sub--blue", label: "極度低估", icon: "chart" };
  if (v < 15) return { cls: "card-ok", sub: "rc-sub--ok", label: "低估", icon: "default" };
  if (v < 20) return { cls: "", sub: "rc-sub--neutral", label: "合理", icon: "default" };
  if (v < 25)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "偏高", icon: "warn" };
  return { cls: "card-danger", sub: "rc-sub--danger", label: "高估", icon: "danger" };
});

const pb = computed(() => {
  const v =
    reportData.value?.macroData?.rawValuation?.pb ??
    statusData.value?.rawValuation?.pb;
  return v != null ? Number(v) : null;
});
// ⚠️ 本卡片的顏色依 PB 絕對值判定（1.5/2.0/3.0/4.0），與 DashboardView.pbPrLevel 的 PR 歷史分位判定（25/80/90）為不同維度。
const pbCard = computed(() => {
  const v = pb.value;
  if (v == null) return { cls: "", sub: "rc-sub--neutral", label: "—", icon: "default" };
  if (v < 1.5)
    return { cls: "card-blue", sub: "rc-sub--blue", label: "極度低估", icon: "chart" };
  if (v < 2.0) return { cls: "card-ok", sub: "rc-sub--ok", label: "低估", icon: "default" };
  if (v < 3.0) return { cls: "", sub: "rc-sub--neutral", label: "合理", icon: "default" };
  if (v < 4.0)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "偏高", icon: "warn" };
  return { cls: "card-danger", sub: "rc-sub--danger", label: "高估", icon: "danger" };
});

const pbPR = computed(() => {
  const pr = reportData.value?.valuationGuardResult?.currentPR;
  return pr != null ? Number(pr).toFixed(1) : null;
});

const fxRate = computed(() => {
  const v =
    reportData.value?.macroData?.rawFx?.currentRate ??
    reportData.value?.macroData?.rawFx?.exchangeRate ??
    statusData.value?.rawFx?.currentRate ??
    statusData.value?.rawFx?.exchangeRate;
  return v != null ? Number(v).toFixed(2) : null;
});
const fxChange = computed(() => {
  const v =
    reportData.value?.macroData?.rawFx?.changePercent ??
    statusData.value?.rawFx?.changePercent;
  return v != null ? Number(v) : null;
});
const fxCard = computed(() => {
  const c = fxChange.value;
  if (c == null) return { cls: "", sub: "rc-sub--neutral", label: "—", icon: "default" };
  if (c > 0.1)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "台幣貶值", icon: "chart" };
  if (c < -0.1)
    return { cls: "card-ok", sub: "rc-sub--ok", label: "台幣升值", icon: "chart" };
  return { cls: "", sub: "rc-sub--neutral", label: "持平", icon: "default" };
});
</script>

<style scoped>
.view-container {
  padding: 16px 16px calc(112px + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--iln-text);
}
.page-date {
  font-size: 12px;
  color: var(--iln-hint);
}

.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--iln-hint);
  margin-bottom: 10px;
}

/* ── Radar 3-col grid ── */
.radar-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.radar-card {
  background: var(--iln-surface);
  border-radius: 12px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
  transition: background 0.2s;
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
.card-blue {
  background: rgba(36, 129, 204, 0.1);
}

.rc-label {
  font-size: 10px;
  color: var(--iln-hint);
  white-space: nowrap;
}
.rc-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--iln-text);
  line-height: 1.2;
}
.rc-value--md {
  font-size: 16px;
}
.rc-value--emoji {
  font-size: 24px;
}
.rc-unit {
  font-size: 11px;
  font-weight: 500;
  margin-left: 1px;
}
.rc-sub {
  font-size: 10px;
  font-weight: 500;
}
.rc-sub--neutral {
  color: var(--iln-hint);
}
.rc-sub--danger {
  color: var(--iln-danger-text);
}
.rc-sub--warn {
  color: var(--iln-warn-text);
}
.rc-sub--ok {
  color: var(--iln-ok-text);
}
.rc-sub--blue {
  color: var(--iln-brand);
}
.rc-pr {
  font-family: inherit;
  font-weight: 700;
  margin-left: 2px;
  opacity: 0.8;
}

/* ── Detail row ── */
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--iln-surface);
  border-radius: 10px;
  margin-bottom: 6px;
}
.dr-label {
  font-size: 13px;
  color: var(--iln-hint);
}
.dr-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-text);
}
.dr-value--muted {
  font-weight: 400;
  color: var(--iln-hint);
}
.text-green {
  color: var(--iln-ok-text);
}
.text-red {
  color: var(--iln-danger-text);
}

.update-time {
  font-size: 11px;
  color: var(--iln-hint);
  text-align: center;
  margin-top: 12px;
}
.inline-error {
  font-size: 13px;
  color: var(--iln-danger-text);
  padding: 12px;
}

/* ── Skeleton ── */
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
    var(--iln-surface) 25%,
    rgba(255, 255, 255, 0.35) 50%,
    var(--iln-surface) 75%
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
  width: 60%;
  margin-top: 6px;
}

/* Phase 4: 長期防禦模式狀態欄 */
.defense-mode-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  margin: 0 16px 12px 16px;
  font-size: 13px;
  font-weight: 600;
  animation: pulse-border 2s infinite;
}

.defense-mode-badge.card-danger {
  background: rgba(244, 67, 54, 0.12);
  border: 1px solid rgba(244, 67, 54, 0.35);
  color: var(--iln-danger-text);
}

.defense-mode-badge .badge-icon {
  font-size: 16px;
}

.defense-mode-badge .badge-text {
  letter-spacing: 0.2px;
}

@keyframes pulse-border {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(198, 40, 40, 0.2);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(198, 40, 40, 0.1);
  }
}
</style>
