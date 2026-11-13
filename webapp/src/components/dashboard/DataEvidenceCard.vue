<template>
  <ContentCard
    variant="outlined"
    padding="md"
    radius="lg"
    data-testid="data-evidence-card"
  >
    <div class="card-header">
      <div>
        <h3 id="data-evidence-title">資料證據</h3>
        <p class="card-subtitle">供外部 Agent 核對已落地資料</p>
      </div>
      <el-button
        :loading="generating"
        type="primary"
        size="small"
        class="export-btn"
        data-testid="evidence-export"
        @click="handleGenerateAndExport"
      >
        <el-icon><Download /></el-icon>
        <span>{{ generating ? "產出中..." : "產出並匯出證據" }}</span>
      </el-button>
    </div>

    <p v-if="loading" class="status-text">讀取證據報告中...</p>
    <p v-else-if="error" class="status-text error-text">
      證據報告暫時無法取得
    </p>
    <template v-else-if="report">
      <p class="evidence-count">{{ itemCount }} 個核對項目</p>
      <p class="scope-text">{{ report.verificationScope }}</p>
      <p v-if="report.generatedAt" class="updated-text">
        產生時間：{{ report.generatedAt }}
      </p>
    </template>
  </ContentCard>
</template>

<script setup>
import { computed, onMounted, shallowRef } from "vue";
import { Download } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  fetchDataEvidenceReport,
  generateDataEvidenceReport,
} from "../../api/index.js";
import { useTelegram, waitReady } from "../../composables/useTelegram.js";
import { exportJSON } from "../../utils/exportUtility.js";

const { tg, openLink } = useTelegram();

const report = shallowRef(null);
const loading = shallowRef(true);
const generating = shallowRef(false);
const error = shallowRef(null);

const itemCount = computed(() => report.value?.items?.length ?? 0);

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
  generating.value = true;
  try {
    const freshReport = await generateDataEvidenceReport();
    report.value = freshReport;

    const dateLabel = freshReport.generatedAt
      ? freshReport.generatedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const filename = `${dateLabel}-data-evidence`;

    // 後端產出時已附帶 60 秒有效一次性 Ticket URL，直接使用
    const ticketDownloadUrl = freshReport.downloadUrl;

    if (tg && ticketDownloadUrl) {
      // Telegram WebApp：使用 Ticket URL 透過 openLink 打開外部瀏覽器下載
      // Ticket 由後端控管，外部瀏覽器不需 X-Telegram-Init-Data header
      openLink(ticketDownloadUrl);
      ElMessage.success("已即時產出最新驗證報告，正在開啟下載！");
    } else {
      // 外部瀏覽器：直接觸發前端 Blob 下載
      exportJSON(freshReport, filename);
      ElMessage.success(`已即時產出並下載: ${filename}.json`);
    }
  } catch (genError) {
    ElMessage.error(`產出失敗: ${genError.message || "未知錯誤"}`);
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
.data-evidence-card {
  /* 佈局由 ContentCard 提供，此處僅保留必要的自定義樣式 */
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-header h3 {
  margin: 0;
  color: var(--iln-text);
  font-size: var(--iln-font-base);
  font-weight: 600;
}

.card-subtitle,
.scope-text,
.updated-text,
.status-text {
  margin: 6px 0 0;
  color: var(--iln-hint);
  font-size: var(--iln-font-sm);
  line-height: 1.5;
}

.evidence-count {
  margin: 16px 0 0;
  color: var(--iln-brand);
  font-size: var(--iln-font-lg);
  font-weight: 700;
}

.error-text {
  color: var(--iln-danger-text);
}

@media (max-width: 480px) {
  .card-header {
    flex-wrap: wrap;
  }

  .card-header > div:first-child {
    min-width: 0;
    flex: 1 1 180px;
  }

  .card-header :deep(.export-btn) {
    flex: 0 0 auto;
  }
}
</style>
