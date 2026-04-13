<template>
  <div class="account-view">
    <!-- ── Header ── -->
    <div class="page-header">
      <h1 class="page-title">系統狀態</h1>
      <p class="page-subtitle">資料來源健康度 ＆ 總經快照</p>
    </div>

    <!-- ── Skeleton ── -->
    <template v-if="loading">
      <div class="section">
        <div class="sk sk-title"></div>
        <div class="sk sk-row"></div>
        <div class="sk sk-row"></div>
        <div class="sk sk-row short"></div>
      </div>
      <div class="section">
        <div class="sk sk-title"></div>
        <div class="source-grid">
          <div v-for="n in 6" :key="n" class="sk sk-card"></div>
        </div>
      </div>
    </template>

    <!-- ── Error ── -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="load">重試</button>
    </div>

    <!-- ── Content ── -->
    <template v-else-if="status">
      <!-- 1. 總經快照 -->
      <div class="section">
        <h2 class="section-title">🌐 總經快照</h2>
        <div class="macro-grid">
          <div class="macro-card">
            <div class="macro-label">CNN 恐懼貪婪</div>
            <div class="macro-value" :class="fngClass">{{ fngValue }}</div>
            <div class="macro-sub">{{ fngRating }}</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">USD / TWD</div>
            <div class="macro-value">{{ fxValue }}</div>
            <div class="macro-sub" :class="fxChangeClass">
              {{ fxChangeSub }}
            </div>
          </div>
          <div class="macro-card">
            <div class="macro-label">大盤 P/B</div>
            <div class="macro-value">{{ pbValue }}</div>
            <div class="macro-sub">淨值比</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">大盤 P/E</div>
            <div class="macro-value">{{ peValue }}</div>
            <div class="macro-sub">本益比</div>
          </div>
        </div>
      </div>

      <!-- 2. 帳戶快照 -->
      <div class="section">
        <h2 class="section-title">💼 帳戶快照</h2>

        <!-- 2a. 加密金鑰未設定 -->
        <div v-if="!snapshotEncryption" class="notice-block">
          <span class="notice-icon">🔐</span>
          <div class="notice-content">
            <p class="notice-title">尚未啟用帳戶快照</p>
            <p class="notice-desc">
              請在伺服器設定 SNAPSHOT_ENCRYPT_KEY 環境變數以啟用加密快照功能。
            </p>
          </div>
        </div>

        <!-- 2b. 有加密但尚無歷史資料 -->
        <div
          v-else-if="snapshotEncryption && !latestSnapshot"
          class="notice-block notice-empty"
        >
          <span class="notice-icon">📭</span>
          <div class="notice-content">
            <p class="notice-title">尚無快照資料</p>
            <p class="notice-desc">快照將從下一次每日執行後開始累積。</p>
          </div>
        </div>

        <!-- 2c. 顯示最新快照 -->
        <template v-else>
          <div class="snapshot-date">📅 {{ latestSnapshot.date }} 快照</div>
          <div class="snapshot-grid">
            <div class="snapshot-card">
              <div class="snapshot-label">0050 股數</div>
              <div class="snapshot-value">
                {{ latestSnapshot.qty0050.toLocaleString() }}
              </div>
              <div class="snapshot-sub">股</div>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-label">00675L 股數</div>
              <div class="snapshot-value">
                {{ latestSnapshot.qtyZ2.toLocaleString() }}
              </div>
              <div class="snapshot-sub">股</div>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-label">融資餘額</div>
              <div class="snapshot-value">
                {{ formatMoney(latestSnapshot.totalLoan) }}
              </div>
              <div class="snapshot-sub">元</div>
            </div>
            <div class="snapshot-card">
              <div class="snapshot-label">現金儲備</div>
              <div class="snapshot-value">
                {{ formatMoney(latestSnapshot.cash) }}
              </div>
              <div class="snapshot-sub">元</div>
            </div>
            <div
              class="snapshot-card"
              v-if="latestSnapshot.avgCost0050 != null"
            >
              <div class="snapshot-label">0050 均價</div>
              <div class="snapshot-value">
                {{ Number(latestSnapshot.avgCost0050).toFixed(2) }}
              </div>
              <div class="snapshot-sub">元/股</div>
            </div>
            <div class="snapshot-card" v-if="latestSnapshot.avgCostZ2 != null">
              <div class="snapshot-label">00675L 均價</div>
              <div class="snapshot-value">
                {{ Number(latestSnapshot.avgCostZ2).toFixed(2) }}
              </div>
              <div class="snapshot-sub">元/股</div>
            </div>
          </div>
          <div v-if="latestSnapshot.lastBuyDate" class="snapshot-buyday">
            最後買進日：{{ latestSnapshot.lastBuyDate }}
          </div>
        </template>
      </div>

      <!-- 3. 系統最後更新時間 -->
      <div class="section">
        <h2 class="section-title">🕐 系統狀態</h2>
        <div class="info-row">
          <span class="info-label">資料最後更新</span>
          <span class="info-value">{{ lastRunLabel }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">資料來源數量</span>
          <span class="info-value">{{ sourceCount }} 個</span>
        </div>
        <div class="info-row">
          <span class="info-label">來源健康度</span>
          <span
            class="info-value"
            :class="allHealthy ? 'text-ok' : 'text-warn'"
          >
            {{ healthyCount }}/{{ sourceCount }} 正常
          </span>
        </div>
      </div>

      <!-- 4. 資料來源健康度 -->
      <div class="section">
        <h2 class="section-title">📡 資料來源</h2>
        <div class="source-grid">
          <div
            v-for="(info, key) in sourcesDisplay"
            :key="key"
            class="source-card"
            :class="info.ok ? 'source-ok' : 'source-fail'"
          >
            <div class="source-header">
              <span class="source-name">{{ info.label }}</span>
              <span
                class="source-badge"
                :class="info.ok ? 'badge-ok' : 'badge-fail'"
              >
                {{ info.ok ? "OK" : "FAIL" }}
              </span>
            </div>
            <div class="source-time">{{ info.lastFetch }}</div>
            <div v-if="!info.ok && info.error" class="source-error">
              {{ info.error }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { fetchStatus } from "../api/index.js";
import { usePortfolioSnapshots } from "../composables/usePortfolioSnapshots.js";

// ── 系統狀態 ──────────────────────────────────────────
const status = ref(null);
const loading = ref(true);
const error = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    status.value = await fetchStatus();
  } catch (e) {
    error.value = "無法載入系統狀態，請稍後再試";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  loadSnapshots();
});

// ── 帳戶快照 ──────────────────────────────────────────
const {
  latestSnapshot,
  hasEncryption: snapshotEncryption,
  load: loadSnapshots,
} = usePortfolioSnapshots(1); // AccountView 只需最新一筆

// ── 金額格式化 ────────────────────────────────────────
function formatMoney(val) {
  if (val == null) return "N/A";
  return Math.round(val).toLocaleString();
}

// ── _meta.lastRun ──
const lastRunLabel = computed(() => {
  const ts = status.value?._meta?.lastRun;
  if (!ts) return "N/A";
  return new Date(ts).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
});

// ── Sources ──
const SOURCE_LABELS = {
  ndcProvider: "國發會景氣燈號",
  kgiProvider: "台股融資餘額",
  cnnProvider: "CNN 恐懼貪婪",
  usMarketProvider: "美股 FRED",
  valuationProvider: "大盤 PB/PE",
  yahooProvider: "USD/TWD 匯率",
};

const sourcesDisplay = computed(() => {
  const raw = status.value?._meta?.sources || {};
  const result = {};
  for (const [key, label] of Object.entries(SOURCE_LABELS)) {
    const src = raw[key] || {};
    const ok = src.status === "SUCCESS";
    const ts = src.lastFetch;
    result[key] = {
      label,
      ok,
      error: src.error || null,
      lastFetch: ts
        ? new Date(ts).toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "尚無資料",
    };
  }
  return result;
});

const sourceCount = computed(() => Object.keys(sourcesDisplay.value).length);
const healthyCount = computed(
  () => Object.values(sourcesDisplay.value).filter((s) => s.ok).length,
);
const allHealthy = computed(() => healthyCount.value === sourceCount.value);

// ── CNN Fear & Greed ──
const fngRaw = computed(() => {
  const d = status.value?.data?.rawCnn;
  return d?.score ?? d?.value ?? null;
});
const fngValue = computed(() =>
  fngRaw.value != null ? String(fngRaw.value) : "N/A",
);
const fngRating = computed(() => {
  const d = status.value?.data?.rawCnn;
  return d?.rating ?? d?.classification ?? "";
});
const fngClass = computed(() => {
  const v = fngRaw.value;
  if (v == null) return "";
  if (v <= 25) return "text-danger";
  if (v <= 45) return "text-warn";
  if (v >= 75) return "text-ok";
  return "";
});

// ── FX ──
const fxValue = computed(() => {
  const v = status.value?.data?.rawFx?.currentRate ?? null;
  return v != null ? Number(v).toFixed(3) : "N/A";
});
const fxChangeSub = computed(() => {
  const chg = status.value?.data?.rawFx?.changePercent ?? null;
  if (chg == null) return "匯率";
  const sign = chg >= 0 ? "+" : "";
  return `${sign}${chg.toFixed(2)}%`;
});
const fxChangeClass = computed(() => {
  const chg = status.value?.data?.rawFx?.changePercent ?? null;
  if (chg == null) return "";
  if (chg > 0.2) return "text-warn";
  if (chg < -0.2) return "text-ok";
  return "";
});

// ── Valuation PB / PE ──
const pbValue = computed(() => {
  const d = status.value?.data?.rawValuation;
  const v = d?.pb ?? d?.priceToBook ?? null;
  return v != null ? Number(v).toFixed(2) : "N/A";
});
const peValue = computed(() => {
  const d = status.value?.data?.rawValuation;
  const v = d?.pe ?? d?.priceToEarnings ?? null;
  return v != null ? Number(v).toFixed(2) : "N/A";
});
</script>

<style scoped>
.account-view {
  padding: 0 0 32px;
  min-height: 100%;
  background: var(--tg-theme-bg-color, #f5f5f5);
}

/* ── Header ── */
.page-header {
  padding: 20px 16px 12px;
  background: var(--tg-theme-bg-color, #fff);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--tg-theme-text-color, #111);
}
.page-subtitle {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  margin: 0;
}

/* ── Section ── */
.section {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  margin: 0 12px 12px;
  padding: 14px 14px 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #777);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Info rows ── */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 14px;
}
.info-row:last-child {
  border-bottom: none;
}
.info-label {
  color: var(--tg-theme-hint-color, #888);
}
.info-value {
  font-weight: 600;
  color: var(--tg-theme-text-color, #111);
}

/* ── Source grid ── */
.source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.source-card {
  border-radius: 8px;
  padding: 9px 10px;
  border: 1px solid transparent;
}
.source-ok {
  background: rgba(52, 199, 89, 0.08);
  border-color: rgba(52, 199, 89, 0.2);
}
.source-fail {
  background: rgba(255, 59, 48, 0.08);
  border-color: rgba(255, 59, 48, 0.2);
}
.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.source-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #111);
}
.source-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.3px;
}
.badge-ok {
  background: rgba(52, 199, 89, 0.18);
  color: #1a7a3a;
}
.badge-fail {
  background: rgba(255, 59, 48, 0.18);
  color: #c0392b;
}
.source-time {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #aaa);
}
.source-error {
  font-size: 10px;
  color: #c0392b;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Macro grid ── */
.macro-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.macro-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
  padding: 10px 10px 8px;
  text-align: center;
}
.macro-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 4px;
}
.macro-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  line-height: 1;
}
.macro-sub {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-top: 3px;
}

/* ── Notice block ── */
.notice-block {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 12px;
  background: rgba(36, 129, 204, 0.06);
  border-radius: 10px;
  border: 1px solid rgba(36, 129, 204, 0.15);
}
.notice-empty {
  background: rgba(180, 180, 180, 0.06);
  border-color: rgba(180, 180, 180, 0.2);
}
.notice-icon {
  font-size: 22px;
  flex-shrink: 0;
  margin-top: 1px;
}
.notice-content {
  flex: 1;
}
.notice-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 4px;
}
.notice-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.5;
  margin: 0;
}

/* ── Snapshot ── */
.snapshot-date {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 10px;
}
.snapshot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.snapshot-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 8px;
  padding: 10px 10px 8px;
  text-align: center;
}
.snapshot-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 4px;
}
.snapshot-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
  line-height: 1;
}
.snapshot-sub {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-top: 3px;
}
.snapshot-buyday {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  text-align: right;
  margin-top: 4px;
}

/* ── About ── */
.about-block {
  text-align: center;
  padding: 4px 0 6px;
}
.about-name {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--tg-theme-text-color, #111);
}
.about-version {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 12px;
}
.about-features {
  list-style: none;
  margin: 0;
  padding: 0;
  text-align: left;
  display: inline-block;
}
.about-features li {
  font-size: 13px;
  color: var(--tg-theme-text-color, #333);
  padding: 4px 0;
  padding-left: 18px;
  position: relative;
}
.about-features li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--tg-theme-button-color, #2481cc);
  font-weight: 700;
}

/* ── Color helpers ── */
.text-ok {
  color: #1a7a3a !important;
}
.text-warn {
  color: #b8860b !important;
}
.text-danger {
  color: #c0392b !important;
}

/* ── Skeleton ── */
.sk {
  background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
}
.sk-title {
  height: 14px;
  width: 40%;
  margin-bottom: 12px;
}
.sk-row {
  height: 38px;
  margin-bottom: 6px;
  border-radius: 8px;
}
.sk-row.short {
  width: 60%;
}
.sk-card {
  height: 64px;
  border-radius: 8px;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

/* ── Error ── */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 16px;
  gap: 10px;
  color: var(--tg-theme-hint-color, #888);
  font-size: 14px;
}
.error-icon {
  font-size: 32px;
}
.retry-btn {
  margin-top: 6px;
  padding: 8px 20px;
  border-radius: 20px;
  border: none;
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  font-size: 14px;
  cursor: pointer;
}
</style>
