<template>
    <GlobalErrorBoundary>
    <div class="strategy-config-editor" data-testid="strategy-config-editor">
    <!-- Header -->
    <div class="editor-header">
      <div class="header-left">
        <h2 class="editor-title">策略參數設定</h2>
        <span class="editor-subtitle">編輯並即時驗證策略參數</span>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="saveConfig" :loading="saving" :disabled="!hasChanges || !isValid" data-testid="btn-save">
          <el-icon><Checked /></el-icon> 儲存
        </el-button>
        <el-button @click="resetToDefault" :loading="resetting" :disabled="!hasChanges" data-testid="btn-reset">
          <el-icon><Refresh /></el-icon> 重置為預設
        </el-button>
        <el-button @click="validateOnly" :loading="validating" data-testid="btn-validate">
          <el-icon><Check /></el-icon> 僅驗證
        </el-button>
      </div>
    </div>

    <!-- Validation Status Bar -->
    <div class="validation-bar" :class="{ 'has-errors': validationErrors.length > 0 }" data-testid="validation-bar">
      <el-alert
        v-if="validationErrors.length > 0"
        title="設定驗證失敗"
        :description="validationErrors.join('；')"
        type="error"
        closable
        show-icon
        class="validation-alert"
        data-testid="alert-validation-error"
      />
      <el-alert
        v-else-if="validating"
        title="驗證中..."
        type="info"
        show-icon
        class="validation-alert"
        data-testid="alert-validating"
      />
      <el-alert
        v-else-if="isValid && hasChanges"
        title="設定有效，可儲存"
        type="success"
        show-icon
        class="validation-alert"
        data-testid="alert-valid"
      />
      <el-alert
        v-else-if="isValid && !hasChanges"
        title="未變更，無需儲存"
        type="info"
        show-icon
        class="validation-alert"
        data-testid="alert-no-changes"
      />
    </div>

    <!-- Section Tabs: Primary + Secondary 兩層（Phase 4 P0-4） -->
    <div class="section-tabs" data-testid="section-tabs">
      <!-- 大分類（Primary Tab） -->
      <div class="iln-tabs-primary" role="tablist">
        <button
          v-for="g in sectionGroups"
          :key="g.key"
          class="iln-tab"
          :class="{ 'is-active': activeGroup === g.key }"
          role="tab"
          :aria-selected="activeGroup === g.key"
          @click="activeGroup = g.key"
        >
          {{ g.label }}
        </button>
      </div>

      <!-- 該分類下的 section（Secondary Tab） -->
      <div class="iln-tabs-secondary" role="tablist" style="margin-top: var(--iln-space-3)">
        <button
          v-for="s in currentGroupSections"
          :key="s.key"
          class="iln-tab"
          :class="{ 'is-active': activeSection === s.key }"
          role="tab"
          :aria-selected="activeSection === s.key"
          @click="activeSection = s.key"
        >
          {{ s.label }}
        </button>
      </div>

      <!-- 表單內容（單一 section） -->
      <div style="margin-top: var(--iln-space-4)">
        <ConfigSectionEditor
          :section="currentSection"
          :config="editableConfig"
          :meta="configMeta"
          :errors="getSectionErrors(activeSection)"
          @update="handleFieldUpdate"
          data-testid="config-section-editor"
        />
      </div>
    </div>

    <!-- Raw JSON Viewer (Collapsible) -->
    <el-collapse v-model="jsonCollapse" class="json-collapse" data-testid="json-collapse">
      <el-collapse-item name="1" title="原始 JSON 檢視">
        <div class="json-viewer" data-testid="json-viewer">
          <pre>{{ formattedJson }}</pre>
        </div>
      </el-collapse-item>
    </el-collapse>

    <!-- Reset Confirm Dialog -->
    <el-dialog
      v-model="resetConfirmVisible"
      title="確定重置為預設?"
      :show-close="false"
      width="400"
      data-testid="reset-confirm-dialog"
    >
      <span>確定要重置為預設設定嗎？此操作將覆蓋所有未儲存的變更。</span>
      <template #footer>
        <el-button @click="resetConfirmVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmResetToDefault" data-testid="btn-confirm-reset">確定重置</el-button>
      </template>
    </el-dialog>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, Check, Checked } from "@element-plus/icons-vue";

import { apiFetch } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import { waitReady } from "../composables/useTelegram.js";

import ConfigSectionEditor from "../components/config/ConfigSectionEditor.vue";

// State
const configMeta = ref({});
const currentConfig = ref({});
const editableConfig = ref({});
const activeSection = ref("basic");
const saving = ref(false);
const resetting = ref(false);
const validating = ref(false);
const validationErrors = ref([]);
const jsonCollapse = ref([]);
const resetConfirmVisible = ref(false);

// Sections configuration
const sections = [
  { key: "basic", label: "基本資訊", fields: ["version", "description"] },
  { key: "maintenance", label: "維持率防禦", fields: ["protectTrigger", "protectTarget", "marginCallThreshold", "frozenZone"] },
  { key: "trading", label: "交易設定", fields: ["minAction", "cooldownDays", "transFee", "transFeeDiscount", "taxRate", "loanInterestRate", "budget"] },
  { key: "buy", label: "買入設定", fields: ["minDropPercentToConsider", "minWeightScoreToBuy", "dropScoreRules", "rsi", "macd", "kd", "panic", "entryGate"] },
  { key: "sell", label: "賣出設定", fields: ["minUpPercentToSell", "minSignalCountToSell", "rsi", "kd", "trailingStop"] },
  { key: "allocation", label: "資金分配", fields: ["allocation"] },
  { key: "threshold", label: "系統閾值", fields: Object.keys((currentConfig.value.threshold || {})) },
  { key: "valuationGuard", label: "估值守衛", fields: ["enabled", "minHistoryDays", "tiers", "trailingStop", "panicDrop", "latch"] },
  { key: "valuationMomentum", label: "估值動能", fields: ["enabled", "lookbackDays", "risingThreshold", "fallingThreshold", "risingPenaltyMultiplier", "fallingRelief", "extremePRThreshold"] },
  { key: "macroSentiment", label: "總經情緒", fields: ["enabled", "bullishBonus", "bearishPenalty", "bearishCooldownMultiplier", "vixOverrideTrigger", "vixAbsoluteOverride"] },
  { key: "grossLeverage", label: "總槓桿控制", fields: ["ceiling", "hardCap", "recoveryTarget"] },
  { key: "conversionGuard", label: "獲利轉化", fields: ["enabled", "tiers", "allocation"] },
  { key: "lifecycle", label: "生命週期", fields: ["currentAge", "monthlyDcaAmount", "payDay", "preInjectDays", "retirementAge", "profiles"] },
  { key: "reserve", label: "資產儲備", fields: ["tiers"] },
  { key: "leverage", label: "槓桿設定", fields: [] },
  { key: "conversionGuard", label: "獲利轉化", fields: ["enabled", "tiers", "allocation"] },
  { key: "overrideHierarchy", label: "覆寫層級", fields: ["panicBypassEnabled", "panicBypassDropPct", "panicVixThreshold"] },
  { key: "regime", label: "市場機制", fields: ["vixOverrideTrigger", "vixAbsoluteOverride", "cautiousLeverageReductionPct", "regimeProfiles"] },
  { key: "dynamicDeleverage", label: "動態去槓桿", fields: ["sellRatio", "triggerRatio", "targetRatio"] },
  { key: "scoringMatrix", label: "評分矩陣", fields: ["enabled", "categories", "thresholds", "normalization"] },
  { key: "valuationMomentum", label: "估值動能", fields: ["enabled", "lookbackDays", "risingThreshold", "fallingThreshold", "risingPenaltyMultiplier", "fallingRelief", "extremePRThreshold"] },
];

// Phase 4 P0-4：5 大分類分組
const sectionGroups = [
  {
    key: "basic",
    label: "基本",
    sections: ["basic"],
  },
  {
    key: "risk",
    label: "風控",
    sections: [
      "maintenance",
      "grossLeverage",
      "dynamicDeleverage",
      "valuationGuard",
      "valuationMomentum",
      "overrideHierarchy",
    ],
  },
  {
    key: "trading",
    label: "交易",
    sections: ["trading", "buy", "sell", "threshold", "scoringMatrix"],
  },
  {
    key: "macro",
    label: "總經",
    sections: ["macroSentiment", "regime"],
  },
  {
    key: "allocation",
    label: "配置",
    sections: ["allocation", "reserve", "conversionGuard", "lifecycle", "leverage"],
  },
];

const activeGroup = ref("basic");

const currentGroupSections = computed(() => {
  const group = sectionGroups.find((g) => g.key === activeGroup.value);
  return (group?.sections ?? [])
    .map((key) => sections.find((s) => s.key === key))
    .filter(Boolean);
});

const currentSection = computed(
  () => sections.find((s) => s.key === activeSection.value) || sections[0],
);

// 切換大分類時，自動跳到該分類的第一個 section
watch(activeGroup, () => {
  const first = currentGroupSections.value[0];
  if (first) activeSection.value = first.key;
});

// Load config and meta
async function loadAll() {
  try {
    const [metaRes, configRes] = await Promise.all([
      apiFetch("/api/strategy-config/meta"),
      apiFetch("/api/strategy-config"),
    ]);

    if (metaRes.success) {
      configMeta.value = metaRes.meta;
    }

    if (configRes.strategy?.content) {
      currentConfig.value = JSON.parse(JSON.stringify(configRes.strategy.content));
      editableConfig.value = JSON.parse(JSON.stringify(configRes.strategy.content));
    }

    validateCurrentConfig();
  } catch (err) {
    console.error("Load config failed:", err);
    ElMessage.error("載入設定失敗: " + err.message);
  }
}

// Validation
async function validateCurrentConfig() {
  if (!configMeta.value || Object.keys(configMeta.value).length === 0) return;

  try {
    const res = await apiFetch("/api/strategy-config/validate", {
      method: "POST",
      body: JSON.stringify(editableConfig.value),
    });
    validationErrors.value = res.errors || [];
  } catch (err) {
    validationErrors.value = ["驗證請求失敗: " + err.message];
  }
}

const isValid = computed(() => validationErrors.value.length === 0);
const hasChanges = computed(() => JSON.stringify(editableConfig.value) !== JSON.stringify(currentConfig.value));
const formattedJson = computed(() => JSON.stringify(editableConfig.value, null, 2));

function getSectionErrors(sectionKey) {
  return validationErrors.value.filter(e => e.startsWith(sectionKey + ".") || e.includes(sectionKey));
}

// Field update handler
function handleFieldUpdate({ path, value }) {
  setNestedValue(editableConfig.value, path, value);
  hasChanges.value = true;
  validateCurrentConfig();
}

function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// Actions
async function saveConfig() {
  if (!isValid.value) {
    ElMessage.warning("設定驗證失敗，請修正錯誤後再儲存");
    return;
  }

  saving.value = true;
  try {
    await apiFetch("/api/strategy-config", {
      method: "POST",
      body: JSON.stringify(editableConfig.value),
    });

    currentConfig.value = JSON.parse(JSON.stringify(editableConfig.value));
    // hasChanges 會自動重新計算為 false (currentConfig === editableConfig)
    ElMessage.success("策略設定已儲存");
  } catch (err) {
    ElMessage.error("儲存失敗: " + err.message);
  } finally {
    saving.value = false;
  }
}

async function resetToDefault() {
  resetConfirmVisible.value = true;
}

async function confirmResetToDefault() {
  resetting.value = true;
  try {
    const res = await apiFetch("/api/strategy-config/default");
    if (res.success) {
      currentConfig.value = JSON.parse(JSON.stringify(res.config));
      editableConfig.value = JSON.parse(JSON.stringify(res.config));
      validateCurrentConfig();
      ElMessage.success("已重置為預設設定");
    }
  } catch (err) {
    ElMessage.error("重置失敗: " + err.message);
  } finally {
    resetting.value = false;
    resetConfirmVisible.value = false;
  }
}

async function validateOnly() {
  validating.value = true;
  try {
    await validateCurrentConfig();
    if (isValid.value) {
      ElMessage.success("驗證通過，設定有效");
    } else {
      ElMessage.error("驗證失敗: " + validationErrors.value.join("；"));
    }
  } finally {
    validating.value = false;
  }
}

onMounted(async () => {
  await waitReady();
  await loadAll();
});
</script>

<style scoped>
.strategy-config-editor {
  padding: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.editor-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.editor-subtitle {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

.header-right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.validation-bar {
  margin-bottom: 16px;
}

.validation-alert {
  margin-bottom: 0 !important;
}

.json-collapse {
  margin-top: 24px;
}

.json-viewer {
  max-height: 400px;
  overflow: auto;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
}

.json-viewer pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>