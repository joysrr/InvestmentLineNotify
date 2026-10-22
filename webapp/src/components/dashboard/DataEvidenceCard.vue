<template>
  <section
    class="data-evidence-card"
    data-testid="data-evidence-card"
    aria-labelledby="data-evidence-title"
  >
    <div class="card-header">
      <div>
        <h3 id="data-evidence-title">資料證據</h3>
        <p class="card-subtitle">供外部 Agent 核對已落地資料</p>
      </div>
      <ExportButton
        v-if="report"
        :json-data="report"
        filename="data-evidence-report"
        button-text="匯出證據"
        direct-command="json"
        size="small"
      />
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
  </section>
</template>

<script setup>
import { computed, onMounted, shallowRef } from "vue";
import { fetchDataEvidenceReport } from "../../api/index.js";
import ExportButton from "../common/ExportButton.vue";

const report = shallowRef(null);
const loading = shallowRef(true);
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

onMounted(loadReport);
</script>

<style scoped>
.data-evidence-card {
  padding: 16px;
  border-radius: 12px;
  background: var(--tg-theme-bg-color, #fff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-header h3 {
  margin: 0;
  color: var(--tg-theme-text-color, #111);
  font-size: 16px;
  font-weight: 600;
}

.card-subtitle,
.scope-text,
.updated-text,
.status-text {
  margin: 6px 0 0;
  color: var(--tg-theme-hint-color, #888);
  font-size: 13px;
  line-height: 1.5;
}

.evidence-count {
  margin: 16px 0 0;
  color: var(--tg-theme-button-color, #2481cc);
  font-size: 20px;
  font-weight: 700;
}

.error-text {
  color: var(--tg-theme-destructive-text-color, #d93025);
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
