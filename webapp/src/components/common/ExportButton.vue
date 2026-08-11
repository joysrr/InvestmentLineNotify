<template>
  <div class="export-button-wrapper">
    <el-dropdown @command="handleCommand" trigger="click">
      <el-button
        :type="type"
        :size="size"
        :disabled="disabled"
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
            <el-tag v-if="csvCount" size="small" type="info">{{ csvCount }} 筆</el-tag>
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

const props = defineProps({
  // 資料來源
  csvData: { type: Array, default: () => [] },
  jsonData: { type: Object, default: () => ({}) },
  chartInstance: { type: Object, default: null },
  
  // 檔名設定
  filename: { type: String, default: "export" },
  csvFilename: { type: String, default: null },
  jsonFilename: { type: String, default: null },
  pngFilename: { type: String, default: null },
  
  // 外觀
  type: { type: String, default: "primary" },
  size: { type: String, default: "default" },
  buttonText: { type: String, default: "匯出" },
  disabled: { type: Boolean, default: false },
  
  // CSV 選項
  csvOptions: { type: Object, default: () => ({}) },
  
  // 圖片選項
  pngOptions: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["export-start", "export-complete", "export-error"]);

const exporting = ref(false);

// Computed
const hasCSVData = computed(() => props.csvData && props.csvData.length > 0);
const hasJSONData = computed(() => props.jsonData && Object.keys(props.jsonData).length > 0);
const hasChart = computed(() => props.chartInstance != null);

const csvCount = computed(() => props.csvData?.length ?? 0);

const baseFilename = computed(() => {
  const base = props.filename || "export";
  return base;
});

const csvFilename = computed(() => props.csvFilename || baseFilename.value);
const jsonFilename = computed(() => props.jsonFilename || baseFilename.value);
const pngFilename = computed(() => props.pngFilename || baseFilename.value);

// Methods
async function handleCommand(command) {
  if (exporting.value) return;
  
  exporting.value = true;
  emit("export-start", command);

  try {
    let result = null;
    
    switch (command) {
      case "csv":
        if (!hasCSVData.value) {
          ElMessage.warning("無 CSV 資料可匯出");
          return;
        }
        exportCSV(props.csvData, csvFilename.value, props.csvOptions);
        ElMessage.success(`CSV 已匯出: ${csvFilename.value}.csv`);
        break;
        
      case "json":
        if (!hasJSONData.value) {
          ElMessage.warning("無 JSON 資料可匯出");
          return;
        }
        exportJSON(props.jsonData, jsonFilename.value);
        ElMessage.success(`JSON 已匯出: ${jsonFilename.value}.json`);
        break;
        
      case "png":
        if (!hasChart.value) {
          ElMessage.warning("無圖表可匯出");
          return;
        }
        await exportChartAsImage(props.chartInstance, pngFilename.value, props.pngOptions);
        ElMessage.success(`PNG 已匯出: ${pngFilename.value}.png`);
        break;
        
      case "all":
        const availableFormats = [];
        if (hasCSVData.value) availableFormats.push("csv");
        if (hasJSONData.value) availableFormats.push("json");
        if (hasChart.value) availableFormats.push("png");
        
        if (availableFormats.length === 0) {
          ElMessage.warning("無可匯出資料");
          return;
        }
        
        await exportAllFormats(
          { csv: props.csvData, json: props.jsonData },
          baseFilename.value,
          availableFormats,
          props.chartInstance
        );
        ElMessage.success(`已匯出: ${availableFormats.join(", ").toUpperCase()}`);
        break;
    }
    
    emit("export-complete", command, result);
  } catch (err) {
    console.error("Export error:", err);
    ElMessage.error("匯出失敗: " + err.message);
    emit("export-error", command, err);
  } finally {
    exporting.value = false;
  }
}

// 暴露方法供父組件呼叫
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

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

.export-btn .el-icon--right {
  font-size: 12px;
  margin-left: 4px;
}

.el-dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.el-dropdown-menu__item .el-tag {
  margin-left: auto;
}
</style>