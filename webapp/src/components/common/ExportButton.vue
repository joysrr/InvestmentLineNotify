<template>
  <div class="export-button-wrapper">
    <el-button
      v-if="directCommand"
      :type="type"
      :size="size"
      :disabled="disabled || exporting"
      :loading="exporting"
      class="export-btn"
      @click="handleCommand(directCommand)"
    >
      <el-icon><Download /></el-icon>
      <span v-if="!exporting">{{ buttonText }}</span>
      <span v-else>匯出中...</span>
    </el-button>

    <el-dropdown v-else @command="handleCommand" trigger="click">
      <el-button
        :type="type"
        :size="size"
        :disabled="disabled || exporting"
        :loading="exporting"
        class="export-btn"
      >
        <el-icon><Download /></el-icon>
        <span v-if="!exporting">{{ buttonText }}</span>
        <span v-else>匯出中...</span>
        <el-icon class="el-icon--right"><ArrowDown /></el-icon>
      </el-button>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item :disabled="!hasCSVData" command="csv">
            <el-icon><Document /></el-icon>
            <span>匯出 CSV</span>
            <el-tag v-if="csvCount" size="small" type="info" class="tabular">{{ csvCount }} 筆</el-tag>
          </el-dropdown-item>
          <el-dropdown-item :disabled="!hasJSONData" command="json">
            <el-icon><Document /></el-icon>
            <span>匯出 JSON</span>
          </el-dropdown-item>
          <el-dropdown-item :disabled="!hasChart" command="png" divided>
            <el-icon><Picture /></el-icon>
            <span>匯出圖片 (PNG)</span>
          </el-dropdown-item>
          <el-dropdown-item command="all" divided>
            <el-icon><Download /></el-icon>
            <span>全部匯出 (CSV + JSON + PNG)</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { Download, Document, Picture, ArrowDown } from "@element-plus/icons-vue";
import { exportCSV, exportJSON, exportChartAsImage, exportAllFormats } from "@/utils/exportUtility.js";
import { haptic } from "@/composables/useTelegram.js";

const props = defineProps({
  csvData: { type: Array, default: () => [] },
  jsonData: { type: Object, default: () => ({}) },
  chartInstance: { type: Object, default: null },
  filename: { type: String, default: "export" },
  csvFilename: { type: String, default: null },
  jsonFilename: { type: String, default: null },
  pngFilename: { type: String, default: null },
  type: { type: String, default: "primary" },
  size: { type: String, default: "default" },
  buttonText: { type: String, default: "匯出" },
  directCommand: { type: String, default: null },
  disabled: { type: Boolean, default: false },
  csvOptions: { type: Object, default: () => ({}) },
  pngOptions: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["export-start", "export-complete", "export-error"]);

const exporting = ref(false);

const hasCSVData = computed(() => Array.isArray(props.csvData) && props.csvData.length > 0);
const hasJSONData = computed(
  () => props.jsonData && typeof props.jsonData === "object" && Object.keys(props.jsonData).length > 0,
);
const hasChart = computed(() => props.chartInstance != null);
const csvCount = computed(() => (Array.isArray(props.csvData) ? props.csvData.length : 0));

const baseFilename = computed(() => props.filename || "export");
const csvFilename = computed(() => props.csvFilename || baseFilename.value);
const jsonFilename = computed(() => props.jsonFilename || baseFilename.value);
const pngFilename = computed(() => props.pngFilename || baseFilename.value);

async function handleCommand(command) {
  haptic("medium");
  if (exporting.value) return;

  exporting.value = true;
  emit("export-start", command);

  try {
    let result = null;

    switch (command) {
      case "csv": {
        if (!hasCSVData.value) {
          ElMessage.warning("無 CSV 資料可匯出");
          return;
        }
        result = exportCSV(props.csvData, csvFilename.value, props.csvOptions);
        ElMessage.success(`CSV 已匯出: ${csvFilename.value}.csv`);
        break;
      }
      case "json": {
        if (!hasJSONData.value) {
          ElMessage.warning("無 JSON 資料可匯出");
          return;
        }
        result = exportJSON(props.jsonData, jsonFilename.value);
        ElMessage.success(`JSON 已匯出: ${jsonFilename.value}.json`);
        break;
      }
      case "png": {
        if (!hasChart.value) {
          ElMessage.warning("無圖表可匯出");
          return;
        }
        result = await exportChartAsImage(props.chartInstance, pngFilename.value, props.pngOptions);
        ElMessage.success(`PNG 已匯出: ${pngFilename.value}.png`);
        break;
      }
      case "all": {
        const availableFormats = [];
        if (hasCSVData.value) availableFormats.push("csv");
        if (hasJSONData.value) availableFormats.push("json");
        if (hasChart.value) availableFormats.push("png");

        if (availableFormats.length === 0) {
          ElMessage.warning("無可匯出資料");
          return;
        }

        result = await exportAllFormats(
          { csv: props.csvData, json: props.jsonData },
          baseFilename.value,
          availableFormats,
          props.chartInstance,
        );
        ElMessage.success(`已匯出: ${availableFormats.join(", ").toUpperCase()}`);
        break;
      }
      default:
        break;
    }

    emit("export-complete", command, result);
  } catch (err) {
    console.error("[ExportButton] Export error:", err);
    ElMessage.error("匯出失敗: " + (err?.message || "未知錯誤"));
    emit("export-error", command, err);
  } finally {
    exporting.value = false;
  }
}

defineExpose({
  exportCSV: () => handleCommand("csv"),
  exportJSON: () => handleCommand("json"),
  exportPNG: () => handleCommand("png"),
  exportAll: () => handleCommand("all"),
});
</script>

<style scoped>
.export-button-wrapper {
  position: relative;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.export-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
}

.export-btn .el-icon--right {
  font-size: var(--iln-font-xs);
  margin-left: var(--iln-space-1);
}

.el-dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
}

.el-dropdown-menu__item .el-tag {
  margin-left: auto;
}
</style>
