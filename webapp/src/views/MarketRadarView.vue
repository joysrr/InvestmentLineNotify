<template>
  <div class="view-container">
    <div class="page-header">
      <h2 class="page-title">🌐 市場雷達</h2>
      <span class="page-date">{{ todayLabel }}</span>
    </div>

    <!-- 載入中 -->
    <div v-if="loading" class="radar-grid">
      <div v-for="i in 8" :key="i" class="radar-card skeleton-card">
        <div class="sk sk-label"></div>
        <div class="sk sk-value"></div>
        <div class="sk sk-sub"></div>
      </div>
    </div>

    <!-- 錯誤 -->
    <div v-else-if="error" class="inline-error">
      ⚠️ 資料載入失敗，請稍後重試
    </div>

    <!-- 內容 -->
    <template v-else>
      <!-- 美股區 -->
      <section class="section">
        <h3 class="section-title">🇺🇸 美股市場</h3>
        <div class="radar-grid">
          <!-- 美股 VIX -->
          <div class="radar-card" :class="usVixCard.cls">
            <span class="rc-label">美股 VIX</span>
            <span class="rc-value">{{ usVix ?? "—" }}</span>
            <span class="rc-sub" :class="usVixCard.sub">{{
              usVixCard.label
            }}</span>
          </div>
          <!-- S&P 500 -->
          <div class="radar-card" :class="spxCard.cls">
            <span class="rc-label">S&amp;P 500</span>
            <span class="rc-value rc-value--md">{{ spxText }}</span>
            <span class="rc-sub" :class="spxCard.sub">{{ spxCard.label }}</span>
          </div>
          <!-- CNN 情緒 -->
          <div class="radar-card" :class="cnnCard.cls">
            <span class="rc-label">CNN 情緒</span>
            <span class="rc-value">{{ cnnScore ?? "—" }}</span>
            <span class="rc-sub" :class="cnnCard.sub">{{ cnnRating }}</span>
          </div>
        </div>
      </section>

      <!-- 台股區 -->
      <section class="section">
        <h3 class="section-title">🇹🇼 台股市場</h3>
        <div class="radar-grid">
          <!-- 台股 VIX -->
          <div class="radar-card" :class="twVixCard.cls">
            <span class="rc-label">台股 VIX</span>
            <span class="rc-value">{{ twVix ?? "—" }}</span>
            <span class="rc-sub" :class="twVixCard.sub">{{
              twVixCard.label
            }}</span>
          </div>
          <!-- 景氣燈號 -->
          <div class="radar-card">
            <span class="rc-label">景氣燈號</span>
            <span class="rc-value rc-value--emoji">{{ lightEmoji }}</span>
            <span class="rc-sub rc-sub--neutral">{{ lightText }}</span>
          </div>
          <!-- 融資維持率 -->
          <div class="radar-card" :class="marginCard.cls">
            <span class="rc-label">融資維持率</span>
            <span class="rc-value rc-value--md"
              >{{ marginRatio ?? "—"
              }}<span v-if="marginRatio" class="rc-unit">%</span></span
            >
            <span class="rc-sub" :class="marginCard.sub">{{
              marginCard.label
            }}</span>
          </div>
          <!-- 大盤 PE -->
          <div class="radar-card" :class="peCard.cls">
            <span class="rc-label">大盤 PE</span>
            <span class="rc-value rc-value--md">{{ pe ?? "—" }}</span>
            <span class="rc-sub" :class="peCard.sub">{{ peCard.label }}</span>
          </div>
          <!-- 大盤 PB -->
          <div class="radar-card" :class="pbCard.cls">
            <span class="rc-label">大盤 PB</span>
            <span class="rc-value rc-value--md">{{ pb ?? "—" }}</span>
            <span class="rc-sub" :class="pbCard.sub">
              {{ pbCard.label }}
              <code v-if="pbPR !== null" class="rc-pr">PR{{ pbPR }}</code>
            </span>
          </div>
          <!-- 匯率 -->
          <div class="radar-card" :class="fxCard.cls">
            <span class="rc-label">美元/台幣</span>
            <span class="rc-value rc-value--md">{{ fxRate ?? "—" }}</span>
            <span class="rc-sub" :class="fxCard.sub">{{ fxCard.label }}</span>
          </div>
        </div>
      </section>

      <!-- 融資增減明細 -->
      <section v-if="marginChange !== null" class="section">
        <h3 class="section-title">💳 融資餘額變化</h3>
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

    <p v-if="updatedAt" class="update-time">資料更新：{{ updatedAt }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus, fetchReports } from "../api/index.js";
import { useTelegram, waitReady } from "../composables/useTelegram.js";

const loading = ref(true);
const error = ref(false);
const statusData = ref(null); // /api/status  data 欄位
const reportData = ref(null); // 最新 report（含 vixData / usRisk）
const updatedAt = ref("");

// ── 載入 ──────────────────────────────────────────────
onMounted(async () => {
  await waitReady();
  const [sRes, rRes] = await Promise.allSettled([
    fetchStatus(),
    fetchReports(3),
  ]);
  loading.value = false;

  if (sRes.status === "fulfilled") {
    statusData.value = sRes.value?.data ?? null;
    if (sRes.value?.updatedAt) {
      updatedAt.value = new Date(sRes.value.updatedAt).toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } else {
    error.value = true;
  }

  if (rRes.status === "fulfilled") {
    const sorted = [...(rRes.value ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    reportData.value = sorted[0] ?? null;
  }
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
const usVixCard = computed(() => {
  const v = parseFloat(usVix.value);
  if (isNaN(v)) return { cls: "", sub: "rc-sub--neutral", label: "—" };
  if (v >= 30)
    return { cls: "card-danger", sub: "rc-sub--danger", label: "極度恐慌 🔥" };
  if (v >= 20)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "警戒 ⚠️" };
  if (v < 13.5)
    return { cls: "card-blue", sub: "rc-sub--blue", label: "過度安逸 ❄️" };
  return { cls: "card-ok", sub: "rc-sub--ok", label: "平穩 ✅" };
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
  if (isNaN(n)) return { cls: "", sub: "rc-sub--neutral", label: "無數據" };
  if (n > 0) return { cls: "card-ok", sub: "rc-sub--ok", label: "上漲 📈" };
  if (n < 0) return { cls: "card-warn", sub: "rc-sub--warn", label: "下跌 📉" };
  return { cls: "", sub: "rc-sub--neutral", label: "持平" };
});

const cnnScore = computed(() => statusData.value?.rawCnn?.score ?? null);
const cnnRating = computed(() => statusData.value?.rawCnn?.rating ?? "—");
const cnnCard = computed(() => {
  const v = parseFloat(cnnScore.value);
  if (isNaN(v)) return { cls: "", sub: "rc-sub--neutral", label: "—" };
  if (v <= 25)
    return { cls: "card-danger", sub: "rc-sub--danger", label: "極度恐懼 😱" };
  if (v <= 45)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "恐懼 😰" };
  if (v >= 75)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "極度貪婪 🤑" };
  return { cls: "card-ok", sub: "rc-sub--ok", label: "中性 😐" };
});

// ── 台股 ──────────────────────────────────────────────
const twVix = computed(() => {
  const v = reportData.value?.vixData?.value;
  return v != null ? Number(v).toFixed(1) : null;
});
const twVixCard = computed(() => {
  const v = parseFloat(twVix.value);
  if (isNaN(v)) return { cls: "", sub: "rc-sub--neutral", label: "—" };
  if (v >= 30)
    return { cls: "card-danger", sub: "rc-sub--danger", label: "極度恐慌 🔥" };
  if (v >= 20)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "警戒 ⚠️" };
  return { cls: "card-ok", sub: "rc-sub--ok", label: "平穩 ✅" };
});

const lightEmoji = computed(() => {
  const sig = statusData.value?.rawNdc?.light ?? "";
  if (
    sig.includes("黃紅") ||
    sig.includes("活絡") ||
    sig.includes("yellow-red")
  )
    return "🟠";
  if (
    sig.includes("黃藍") ||
    sig.includes("趨緩") ||
    sig.includes("yellow-blue")
  )
    return "🟡";
  if (sig.includes("紅") || sig.includes("熱絡") || sig === "red") return "🔴";
  if (sig.includes("綠") || sig.includes("穩定") || sig === "green")
    return "🟢";
  if (sig.includes("藍") || sig.includes("低迷") || sig === "blue") return "🔵";
  return "⚪";
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
  const v = parseFloat(marginRatio.value);
  if (isNaN(v)) return { cls: "", sub: "rc-sub--neutral", label: "—" };
  if (v < 145)
    return { cls: "card-danger", sub: "rc-sub--danger", label: "危險 🚨" };
  if (v < 155)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "警戒 ⚠️" };
  return { cls: "card-ok", sub: "rc-sub--ok", label: "健康 ✅" };
});

const pe = computed(() => {
  const v =
    reportData.value?.macroData?.rawValuation?.pe ??
    statusData.value?.rawValuation?.pe;
  return v != null ? Number(v) : null;
});
const peCard = computed(() => {
  const v = pe.value;
  if (v == null) return { cls: "", sub: "rc-sub--neutral", label: "—" };
  if (v < 12)
    return { cls: "card-blue", sub: "rc-sub--blue", label: "極度低估 🧊" };
  if (v < 15) return { cls: "card-ok", sub: "rc-sub--ok", label: "低估 ❄️" };
  if (v < 20) return { cls: "", sub: "rc-sub--neutral", label: "合理 ⚖️" };
  if (v < 25)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "偏高 🔶" };
  return { cls: "card-danger", sub: "rc-sub--danger", label: "高估 🔥" };
});

const pb = computed(() => {
  const v =
    reportData.value?.macroData?.rawValuation?.pb ??
    statusData.value?.rawValuation?.pb;
  return v != null ? Number(v) : null;
});
const pbCard = computed(() => {
  const v = pb.value;
  if (v == null) return { cls: "", sub: "rc-sub--neutral", label: "—" };
  if (v < 1.5)
    return { cls: "card-blue", sub: "rc-sub--blue", label: "極度低估 🧊" };
  if (v < 2.0) return { cls: "card-ok", sub: "rc-sub--ok", label: "低估 ❄️" };
  if (v < 3.0) return { cls: "", sub: "rc-sub--neutral", label: "合理 ⚖️" };
  if (v < 4.0)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "偏高 🔶" };
  return { cls: "card-danger", sub: "rc-sub--danger", label: "高估 🔥" };
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
  if (c == null) return { cls: "", sub: "rc-sub--neutral", label: "—" };
  if (c > 0.1)
    return { cls: "card-warn", sub: "rc-sub--warn", label: "台幣貶值 📉" };
  if (c < -0.1)
    return { cls: "card-ok", sub: "rc-sub--ok", label: "台幣升值 📈" };
  return { cls: "", sub: "rc-sub--neutral", label: "持平 ➖" };
});
</script>

<style scoped>
.view-container {
  padding: 16px 16px 32px;
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
  color: var(--tg-theme-text-color, #111);
}
.page-date {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 10px;
}

/* ── Radar 3-col grid ── */
.radar-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.radar-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
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
  color: var(--tg-theme-hint-color, #999);
  white-space: nowrap;
}
.rc-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
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
  color: var(--tg-theme-hint-color, #999);
}
.rc-sub--danger {
  color: #e84855;
}
.rc-sub--warn {
  color: #d4ac0d;
}
.rc-sub--ok {
  color: #26a17b;
}
.rc-sub--blue {
  color: #2481cc;
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
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  margin-bottom: 6px;
}
.dr-label {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #999);
}
.dr-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.dr-value--muted {
  font-weight: 400;
  color: var(--tg-theme-hint-color, #999);
}
.text-green {
  color: #26a17b;
}
.text-red {
  color: #e84855;
}

.update-time {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #bbb);
  text-align: center;
  margin-top: 12px;
}
.inline-error {
  font-size: 13px;
  color: #e84855;
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
</style>
