<template>
  <ContentCard
    variant="outlined"
    padding="md"
    radius="lg"
    class="evidence-card"
    data-testid="data-evidence-card"
  >
    <div class="card-header">
      <div class="card-title-group">
        <h3 id="data-evidence-title">資料證據</h3>
        <p class="card-subtitle">供外部 Agent 核對已落地資料</p>
      </div>
      <button
        type="button"
        :disabled="generating || loading"
        class="evidence-action-btn"
        data-testid="evidence-export"
        @click="handleGenerateAndExport"
      >
        <el-icon v-if="generating" class="is-loading"><Loading /></el-icon>
        <el-icon v-else><Download /></el-icon>
        <span>{{ generating ? "產出中..." : "產出並匯出證據" }}</span>
      </button>
    </div>

    <p v-if="loading" class="status-text">讀取證據報告中...</p>
    <p v-else-if="error" class="status-text error-text">
      證據報告暫時無法取得
    </p>
    <template v-else-if="report">
      <p class="evidence-count tabular">{{ itemCount }} 個核對項目</p>
      <p class="scope-text">{{ report.verificationScope }}</p>
      <p v-if="report.generatedAt" class="updated-text tabular">
        產生時間：{{ generatedAtDisplay }}
      </p>
    </template>
  </ContentCard>
</template>

<script setup>
import { computed, onMounted, shallowRef } from "vue";
import { Download, Loading } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import ContentCard from "../common/ContentCard.vue";
import {
  fetchDataEvidenceReport,
  generateDataEvidenceReport,
} from "../../api/index.js";
import { formatDateTimeInTaipei } from "../../utils/formatDate.js";
import { useTelegram, waitReady } from "../../composables/useTelegram.js";
import { exportJSON } from "../../utils/exportUtility.js";

const { tg, openLink } = useTelegram();

const report = shallowRef(null);
const loading = shallowRef(true);
const generating = shallowRef(false);
const error = shallowRef(null);

const itemCount = computed(() => report.value?.items?.length ?? 0);
const generatedAtDisplay = computed(() =>
  report.value?.generatedAt
    ? formatDateTimeInTaipei(report.value.generatedAt)
    : "—",
);

async function loadReport() {
  loading.value = true;
  error.value = null;
  try {
    report.value = await fetchDataEvidenceReport();
  } catch (requestError) {
    error.value = requestError;
  } finally {
    loading.value = false;
  }
}

async function handleGenerateAndExport() {
  if (generating.value || loading.value) return;
  generating.value = true;
  try {
    const freshReport = await generateDataEvidenceReport();
    report.value = freshReport;

    const dateLabel = freshReport.generatedAt
      ? freshReport.generatedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const filename = `${dateLabel}-data-evidence`;

    const ticketDownloadUrl = freshReport.downloadUrl;

    if (tg && ticketDownloadUrl) {
      openLink(ticketDownloadUrl);
      ElMessage.success("已即時產出最新驗證報告，正在開啟下載！");
    } else {
      exportJSON(freshReport, filename);
      ElMessage.success(`已即時產出並下載: ${filename}.json`);
    }
  } catch (genError) {
    ElMessage.error(`產出失敗: ${genError?.message || "未知錯誤"}`);
  } finally {
    generating.value = false;
  }
}

onMounted(async () => {
  await waitReady();
  await loadReport();
});
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.evidence-card {
  --btn-evidence-bg: #2563eb;
  --btn-evidence-bg-hover: #1d4ed8;
  --btn-evidence-border: rgba(96, 165, 250, 0.5);
  --btn-evidence-text: #ffffff;

  background: var(--iln-surface-elevated, var(--iln-surface, #161b22));
  border-color: var(--iln-border-subtle, rgba(148, 163, 184, 0.2));
  color: var(--iln-text, #f3f4f6);
}

:global(:root[data-theme="dark"]) .evidence-card,
:global(.dark) .evidence-card,
:global([data-theme="dark"]) .evidence-card {
  --btn-evidence-bg: #2563eb;
  --btn-evidence-bg-hover: #3b82f6;
  --btn-evidence-border: rgba(147, 197, 253, 0.5);
  --btn-evidence-text: #ffffff;
}

.card-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--iln-space-3, 12px);
}

.card-title-group {
  min-width: 0;
}

.card-header h3 {
  margin: 0;
  color: var(--iln-text, #f3f4f6);
  font-size: var(--iln-font-base, 15px);
  font-weight: 700;
}

.card-subtitle,
.scope-text,
.updated-text,
.status-text {
  margin: 6px 0 0;
  color: var(--iln-hint, #9ca3af);
  font-size: var(--iln-font-xs, 12px);
  line-height: 1.5;
}

.evidence-count {
  margin: var(--iln-space-4, 16px) 0 0;
  color: var(--iln-brand, #60a5fa);
  font-size: var(--iln-font-lg, 18px);
  font-weight: 800;
}

.error-text {
  color: var(--iln-viz-bear-text, #f87171);
  font-weight: 600;
}

.evidence-action-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--iln-space-1-5, 6px);
  min-height: var(--iln-touch-min, 38px);
  padding: 8px 14px;
  border: 1px solid var(--btn-evidence-border);
  border-radius: var(--iln-radius-md, 10px);
  background-color: var(--btn-evidence-bg) !important;
  color: var(--btn-evidence-text) !important;
  font-size: var(--iln-font-xs, 12px);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  transition:
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    opacity var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    transform var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.evidence-action-btn:hover:not(:disabled) {
  background-color: var(--btn-evidence-bg-hover) !important;
}

.evidence-action-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.evidence-action-btn:focus-visible {
  outline: 2px solid var(--iln-brand, #60a5fa);
  outline-offset: 2px;
}

.evidence-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.is-loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .evidence-action-btn,
  .is-loading {
    animation: none;
    transition: none;
  }

  .evidence-action-btn:active:not(:disabled) {
    transform: none;
  }
}
</style>
