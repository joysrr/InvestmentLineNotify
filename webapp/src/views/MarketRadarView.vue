<template>
  <GlobalErrorBoundary>
    <div class="view-container iln-page">
      <div class="subview-meta">
        <span class="subview-heading">
          <Icon name="radar" size="sm" />
          <span>市場雷達</span>
        </span>
        <span class="page-date tabular">{{ todayLabel }}</span>
      </div>

      <!-- 長期防禦模式狀態欄 (Phase 4) -->
      <div
        v-if="isLongTermDefense"
        class="defense-mode-badge card-danger"
        role="status"
      >
        <span class="badge-icon"><Icon name="shield" /></span>
        <span class="badge-text">長期防禦模式中 — 嚴格控制槓桿與加碼</span>
      </div>

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
        <div class="iln-grid radar-overview">
          <!-- 極端雷達與防禦層 (常態精簡/極端醒目) -->
          <ExtremeRadarPanel
            :leading-indicators="leadingIndicators"
          />

          <!-- 現金曝險分析（同步顯示於行動紀律下方） -->
          <CashExposureWidget
            v-if="leadingIndicators?.cashExposureAnalysis"
            :analysis="leadingIndicators.cashExposureAnalysis"
          />
        </div>

        <!-- 掃描結論：N 項偏多、M 項偏空、K 項中性 -->
        <div class="scan-conclusion tabular">{{ scanConclusion }}</div>

        <!-- 美股區 -->
        <section class="section" aria-label="美股市場">
          <h3 class="section-title">
            <Icon name="radar" size="sm" />
            <span>美股市場</span>
          </h3>
          <div class="radar-grid tabular">
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
              <template #suffix>
                <Icon :name="spxCard.icon" size="sm" /> {{ spxCard.label }}
              </template>
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
        <section class="section" aria-label="台股市場">
          <h3 class="section-title">
            <Icon name="radar" size="sm" />
            <span>台股市場</span>
          </h3>
          <div class="radar-grid tabular">
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
              <template #suffix>
                <Icon :name="peCard.icon" size="sm" /> {{ peCard.label }}
              </template>
            </StatCard>
            <!-- 大盤 PB -->
            <StatCard
              label="大盤 PB"
              :value="pb ?? '—'"
              :status="cardClassToStatus(pbCard.cls)"
              framed
            >
              <template #suffix>
                <Icon :name="pbCard.icon" size="sm" /> {{ pbCard.label }}
                <code v-if="pbPR !== null" class="rc-pr">PR{{ pbPR }}</code>
              </template>
            </StatCard>
            <!-- 匯率 -->
            <StatCard
              label="美元/台幣"
              :value="fxRate ?? '—'"
              :status="cardClassToStatus(fxCard.cls)"
              framed
            >
              <template #suffix>
                <Icon :name="fxCard.icon" size="sm" /> {{ fxCard.label }}
              </template>
            </StatCard>
          </div>
        </section>

        <!-- 融資增減明細 -->
        <section v-if="marginChange !== null" class="section" aria-label="融資餘額變化">
          <h3 class="section-title">融資餘額變化</h3>
          <div class="detail-list">
            <div class="detail-row">
              <span class="dr-label">融資餘額</span>
              <span class="dr-value tabular">{{ fmtDecimal(marginValue, 1) ?? "—" }} 億</span>
            </div>
            <div class="detail-row">
              <span class="dr-label">單日增減</span>
              <span
                class="dr-value tabular"
                :class="
                  marginChange != null
                    ? marginChange >= 0
                      ? 'text-green'
                      : 'text-red'
                    : 'text-muted'
                "
              >
                {{ marginChange != null ? (marginChange >= 0 ? "+" : "") : "" }}{{ fmtDecimal(marginChange, 1) ?? "—" }} 億
              </span>
            </div>
            <div v-if="marginDate" class="detail-row">
              <span class="dr-label">資料日期</span>
              <span class="dr-value dr-value--muted tabular">{{ marginDate }}</span>
            </div>
          </div>
        </section>
      </template>

      <p v-if="resolveLastRun(statusMeta)" class="update-time tabular">
        資料更新：{{ lastUpdatedText }}
      </p>
    </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus, fetchReports } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import ExtremeRadarPanel from "@/components/radar/ExtremeRadarPanel.vue";
import CashExposureWidget from "@/components/radar/CashExposureWidget.vue";
import Icon from "@/components/common/Icon.vue";
import { fmtDecimal } from "@/utils/formatters.js";
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
const statusData = ref(null);
const reportData = ref(null);
const statusMeta = ref(null);

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const leadingIndicators = computed(
  () =>
    reportData.value?.leadingIndicators ??
    statusData.value?.leadingIndicators ??
    null,
);

const lastUpdatedText = computed(() =>
  formatRelative(resolveLastRun(statusMeta.value)),
);

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

const isLongTermDefense = computed(() => {
  return (
    reportData.value?.leadingIndicators?.isLongTermDefense ??
    statusData.value?.leadingIndicators?.isLongTermDefense ??
    false
  );
});

const todayLabel = computed(() =>
  new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }),
);

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
  if (isNaN(n)) return { cls: "", sub: "rc-sub--neutral", label: "無數據", icon: "neutral" };
  if (n > 0) return { cls: "card-ok", sub: "rc-sub--ok", label: "上漲", icon: "chart" };
  if (n < 0) return { cls: "card-warn", sub: "rc-sub--warn", label: "下跌", icon: "chart" };
  return { cls: "", sub: "rc-sub--neutral", label: "持平", icon: "neutral" };
});

const cnnScore = computed(() => statusData.value?.rawCnn?.score ?? null);
const cnnRating = computed(() => statusData.value?.rawCnn?.rating ?? "—");
const cnnCard = computed(() => {
  const r = getCnnLevel(cnnScore.value);
  return { cls: r.cls, sub: r.subCls, label: r.label };
});

const twVix = computed(() => {
  const v = toFiniteNumber(reportData.value?.vixData?.value);
  return v != null ? fmtDecimal(v, 1) : null;
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
    return "neutral";
  if (sig.includes("紅") || sig.includes("熱絡") || sig === "red") return "danger";
  if (sig.includes("綠") || sig.includes("穩定") || sig === "green")
    return "ok";
  if (sig.includes("藍") || sig.includes("低迷") || sig === "blue") return "neutral";
  return "neutral";
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
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : null;
});
const marginRatio = computed(() => {
  const v =
    reportData.value?.macroData?.rawMargin?.maintenanceRatio ??
    statusData.value?.rawMargin?.maintenanceRatio;
  const number = toFiniteNumber(v);
  return number != null ? fmtDecimal(number, 1) : null;
});
const marginChange = computed(() => {
  const v =
    reportData.value?.macroData?.rawMargin?.marginBalanceChange100M ??
    statusData.value?.rawMargin?.marginBalanceChange100M;
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : null;
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
  return toFiniteNumber(v);
});
const peCard = computed(() => {
  const v = pe.value;
  if (v == null) return { cls: "", sub: "rc-sub--neutral", label: "—", icon: "neutral" };
  if (v < 12)
    return { cls: "card-blue", sub: "rc-sub--blue", label: "極度低估", icon: "chart" };
  if (v < 15) return { cls: "card-ok", sub: "rc-sub--ok", label: "低估", icon: "neutral" };
  if (v < 20) return { cls: "", sub: "rc-sub--neutral", label: "合理", icon: "neutral" };
  if (v < 25)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "偏高", icon: "warn" };
  return { cls: "card-danger", sub: "rc-sub--danger", label: "高估", icon: "danger" };
});

const pb = computed(() => {
  const v =
    reportData.value?.macroData?.rawValuation?.pb ??
    statusData.value?.rawValuation?.pb;
  return toFiniteNumber(v);
});
const pbCard = computed(() => {
  const v = pb.value;
  if (v == null) return { cls: "", sub: "rc-sub--neutral", label: "—", icon: "neutral" };
  if (v < 1.5)
    return { cls: "card-blue", sub: "rc-sub--blue", label: "極度低估", icon: "chart" };
  if (v < 2.0) return { cls: "card-ok", sub: "rc-sub--ok", label: "低估", icon: "neutral" };
  if (v < 3.0) return { cls: "", sub: "rc-sub--neutral", label: "合理", icon: "neutral" };
  if (v < 4.0)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "偏高", icon: "warn" };
  return { cls: "card-danger", sub: "rc-sub--danger", label: "高估", icon: "danger" };
});

const pbPR = computed(() => {
  const pr = reportData.value?.valuationGuardResult?.currentPR;
  const n = Number(pr);
  return pr != null && Number.isFinite(n) ? fmtDecimal(n, 1) : null;
});

const fxRate = computed(() => {
  const v =
    reportData.value?.macroData?.rawFx?.currentRate ??
    reportData.value?.macroData?.rawFx?.exchangeRate ??
    statusData.value?.rawFx?.currentRate ??
    statusData.value?.rawFx?.exchangeRate;
  const number = toFiniteNumber(v);
  return number != null ? fmtDecimal(number, 2) : null;
});
const fxChange = computed(() => {
  const v =
    reportData.value?.macroData?.rawFx?.changePercent ??
    statusData.value?.rawFx?.changePercent;
  return toFiniteNumber(v);
});
const fxCard = computed(() => {
  const c = fxChange.value;
  if (c == null) return { cls: "", sub: "rc-sub--neutral", label: "—", icon: "neutral" };
  if (c > 0.1)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "台幣貶值", icon: "chart" };
  if (c < -0.1)
    return { cls: "card-ok", sub: "rc-sub--ok", label: "台幣升值", icon: "chart" };
  return { cls: "", sub: "rc-sub--neutral", label: "持平", icon: "neutral" };
});

const scanConclusion = computed(() => {
  const statuses = [
    cardClassToStatus(usVixCard.value.cls),
    cardClassToStatus(spxCard.value.cls),
    cardClassToStatus(cnnCard.value.cls),
    cardClassToStatus(twVixCard.value.cls),
    null,
    cardClassToStatus(marginCard.value.cls),
    cardClassToStatus(peCard.value.cls),
    cardClassToStatus(pbCard.value.cls),
    cardClassToStatus(fxCard.value.cls),
  ];

  const bullish = statuses.filter((s) => s === "ok").length;
  const bearish = statuses.filter((s) => s === "danger").length;
  const neutral = statuses.length - bullish - bearish;

  return `${bullish} 項偏多、${bearish} 項偏空、${neutral} 項中性`;
});
</script>

<style scoped>
.view-container {
  padding: 0 0 calc(var(--iln-space-4) + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.subview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-3);
}

.subview-heading {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-text);
}

.page-date {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  white-space: nowrap;
}

.section {
  margin-bottom: var(--iln-space-5);
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-sm);
  font-weight: 700;
  letter-spacing: 0.4px;
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-2);
}

.radar-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--iln-space-2);
}

.scan-conclusion {
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-text);
  padding: var(--iln-space-3);
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-left: 3px solid var(--iln-brand);
  border-radius: var(--iln-radius-md);
  margin-bottom: var(--iln-space-4);
}

.card-danger {
  background: var(--iln-viz-bear-bg);
}

.card-warn {
  background: var(--iln-viz-alert-bg);
}

.card-ok {
  background: var(--iln-viz-bull-bg);
}

.card-blue {
  background: var(--iln-viz-neutral-bg);
}

.rc-pr {
  font-family: inherit;
  font-weight: 700;
  margin-left: var(--iln-space-1);
  opacity: 0.85;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--iln-space-3);
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
}

.dr-label {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.dr-value {
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-text);
}

.dr-value--muted {
  font-weight: 500;
  color: var(--iln-hint);
}

.text-green {
  color: var(--iln-viz-bull-text);
}

.text-red {
  color: var(--iln-viz-bear-text);
}

.text-muted {
  color: var(--iln-hint);
}

.update-time {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-align: center;
  margin-top: var(--iln-space-4);
}

.defense-mode-badge {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  padding: var(--iln-space-3);
  border-radius: var(--iln-radius-md);
  margin: 0 0 var(--iln-space-3);
  font-size: var(--iln-font-sm);
  font-weight: 700;
  animation: pulse-border 2s infinite;
}

.defense-mode-badge.card-danger {
  background: var(--iln-viz-bear-bg);
  border: 1px solid var(--iln-viz-bear-border);
  color: var(--iln-viz-bear-text);
}

.defense-mode-badge .badge-icon {
  display: inline-flex;
  align-items: center;
  font-size: var(--iln-font-md);
}

.defense-mode-badge .badge-text {
  letter-spacing: 0.2px;
}

@keyframes pulse-border {
  0%,
  100% {
    box-shadow: var(--iln-viz-bear-shadow, none);
  }
  50% {
    box-shadow: var(--iln-viz-bear-shadow-focus, none);
  }
}

@media (prefers-reduced-motion: reduce) {
  .defense-mode-badge {
    animation: none;
  }
}

.error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--iln-space-6, 24px);
  text-align: center;
  color: var(--iln-hint);
}

.radar-overview {
  margin-bottom: var(--iln-space-3);
}

@media (min-width: 768px) {
  .radar-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
