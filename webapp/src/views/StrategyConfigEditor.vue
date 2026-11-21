<template>
  <GlobalErrorBoundary>
    <div class="strategy-config-editor iln-page" data-testid="strategy-config-editor">
      <!-- Load Error Banner -->
      <div v-if="loadError" class="load-error" role="alert" data-testid="load-error">
        <span class="load-error__text">{{ loadError }}</span>
        <el-button
          type="primary"
          @click="loadAll"
          :loading="loading"
          data-testid="btn-retry-load"
        >
          重新載入
        </el-button>
      </div>

      <!-- Header -->
      <header class="editor-header">
        <div class="header-left">
          <h2 class="editor-title">
            <Icon name="settings" size="sm" />
            <span>策略參數設定</span>
          </h2>
          <span class="editor-subtitle">編輯並即時驗證策略參數</span>
        </div>
        <div class="header-right">
          <el-button
            type="primary"
            @click="() => { saveConfig(); haptic('medium'); }"
            :loading="saving"
            :disabled="!hasChanges || !isValid"
            data-testid="btn-save"
          >
            <el-icon><Checked /></el-icon>
            <span>儲存</span>
          </el-button>
          <el-button
            @click="() => { resetToDefault(); haptic('medium'); }"
            :loading="resetting"
            :disabled="!hasChanges"
            data-testid="btn-reset"
          >
            <el-icon><Refresh /></el-icon>
            <span>重置為預設</span>
          </el-button>
          <el-button
            @click="() => { validateOnly(); haptic('medium'); }"
            :loading="validating"
            data-testid="btn-validate"
          >
            <el-icon><Check /></el-icon>
            <span>僅驗證</span>
          </el-button>
        </div>
      </header>

      <!-- Validation Status Bar -->
      <div
        class="validation-bar"
        :class="{ 'has-errors': validationErrors.length > 0 }"
        data-testid="validation-bar"
      >
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

      <!-- Section Groups: 單層分組 Chip（取代雙層 tablist） -->
      <div class="section-tabs" data-testid="section-groups">
        <div
          v-for="g in sectionGroups"
          :key="g.key"
          class="chip-group"
          :data-testid="`group-${g.key}`"
        >
          <h3 class="chip-group__title">{{ g.label }}</h3>
          <div class="chip-group__chips" role="radiogroup" :aria-label="g.label">
            <button
              v-for="sec in groupSections(g)"
              :key="sec.key"
              type="button"
              class="chip"
              :class="{ 'is-active': activeSection === sec.key }"
              role="radio"
              :aria-checked="activeSection === sec.key"
              :data-testid="`section-${sec.key}`"
              @click="() => { selectSection(g.key, sec.key); selectionChanged(); }"
            >
              {{ sec.label }}
            </button>
          </div>
        </div>

        <!-- 表單內容（單一 section） -->
        <div class="section-editor-panel">
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
            <pre class="tabular">{{ formattedJson }}</pre>
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
          <el-button
            type="danger"
            @click="confirmResetToDefault"
            data-testid="btn-confirm-reset"
          >
            確定重置
          </el-button>
        </template>
      </el-dialog>
    </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, Check, Checked } from "@element-plus/icons-vue";
import Icon from "@/components/common/Icon.vue";

import { apiFetch } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import { waitReady, haptic, selectionChanged } from "../composables/useTelegram.js";
import { useClosingConfirmation } from "../composables/useClosingConfirmation.js";

const { enableClosingConfirmation, disableClosingConfirmation } =
  useClosingConfirmation();

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
const loading = ref(false);
const loadError = ref("");

// Sections configuration
const sections = [
  { key: "basic", label: "基本資訊", fields: ["version", "description"] },
  { key: "maintenance", label: "維持率防禦", fields: ["protectTrigger", "protectTarget", "marginCallThreshold", "frozenZone"] },
  { key: "trading", label: "交易設定", fields: ["minAction", "cooldownDays", "transFee", "transFeeDiscount", "taxRate", "loanInterestRate", "budget"] },
  { key: "buy", label: "買入設定", fields: ["minDropPercentToConsider", "minWeightScoreToBuy", "dropScoreRules", "rsi", "macd", "kd", "panic", "entryGate"] },
  { key: "sell", label: "賣出設定", fields: ["minUpPercentToSell", "minSignalCountToSell", "rsi", "kd", "trailingStop"] },
  { key: "allocation", label: "資金分配", fields: ["allocation"] },
  { key: "threshold", label: "系統閾值", fields: [] },
  { key: "valuationGuard", label: "估值守衛", fields: ["enabled", "minHistoryDays", "tiers", "trailingStop", "panicDrop", "latch"] },
  { key: "valuationMomentum", label: "估值動能", fields: ["enabled", "lookbackDays", "risingThreshold", "fallingThreshold", "risingPenaltyMultiplier", "fallingRelief", "extremePRThreshold"] },
  { key: "macroSentiment", label: "總經情緒", fields: ["enabled", "bullishBonus", "bearishPenalty", "bearishCooldownMultiplier", "vixOverrideTrigger", "vixAbsoluteOverride"] },
  { key: "grossLeverage", label: "總槓桿控制", fields: ["ceiling", "hardCap", "recoveryTarget"] },
  { key: "conversionGuard", label: "獲利轉化", fields: ["enabled", "tiers", "allocation"] },
  { key: "lifecycle", label: "生命週期", fields: ["currentAge", "monthlyDcaAmount", "payDay", "preInjectDays", "retirementAge", "profiles"] },
  { key: "reserve", label: "資產儲備", fields: ["tiers"] },
  { key: "overrideHierarchy", label: "覆寫層級", fields: ["panicBypassEnabled", "panicBypassDropPct", "panicVixThreshold"] },
  { key: "regime", label: "市場機制", fields: ["vixOverrideTrigger", "vixAbsoluteOverride", "cautiousLeverageReductionPct", "regimeProfiles"] },
  { key: "dynamicDeleverage", label: "動態去槓桿", fields: ["sellRatio", "triggerRatio", "targetRatio"] },
  { key: "scoringMatrix", label: "評分矩陣", fields: ["enabled", "categories", "thresholds", "normalization"] },
];

// 5 大分類分組
// threshold 欄位動態化（避免模組載入時 currentConfig 為 {} 導致永遠空陣列）
const thresholdFields = computed(() => {
  const threshold = currentConfig.value?.threshold;
  return threshold && typeof threshold === "object" ? Object.keys(threshold) : [];
});

const resolvedSections = computed(() =>
  sections.map((s) =>
    s.key === "threshold" ? { ...s, fields: thresholdFields.value } : s
  )
);

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
    sections: ["allocation", "reserve", "conversionGuard", "lifecycle"],
  },
];

const activeGroup = ref("basic");

// 取某分組的 section 物件清單
const groupSections = (group) =>
  (group.sections ?? [])
    .map((key) => resolvedSections.value.find((x) => x.key === key))
    .filter(Boolean);

// 單層 Chip：一次點擊同時決定 group 與 section
const selectSection = (groupKey, sectionKey) => {
  activeGroup.value = groupKey;
  activeSection.value = sectionKey;
};

const currentSection = computed(
  () =>
    resolvedSections.value.find((s) => s.key === activeSection.value) ||
    resolvedSections.value[0],
);

// Load config and meta
async function loadAll() {
  loading.value = true;
  loadError.value = "";
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
    loadError.value = err.message || "載入設定失敗";
    ElMessage.error("載入設定失敗: " + err.message);
  } finally {
    loading.value = false;
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
  enableClosingConfirmation();
});

onUnmounted(() => {
  disableClosingConfirmation();
});
</script>

<style scoped>
.strategy-config-editor {
  padding: var(--iln-space-4) var(--iln-space-4) calc(var(--iln-space-6) + env(safe-area-inset-bottom, 0px));
  max-width: var(--iln-content-max);
  margin: 0 auto;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-3);
  flex-wrap: wrap;
  padding: var(--iln-space-3) var(--iln-space-4);
  margin-bottom: var(--iln-space-4);
  border-radius: var(--iln-radius-md);
  border: 1px solid var(--iln-viz-bear-border);
  background: var(--iln-viz-bear-bg);
  color: var(--iln-viz-bear-text);
  font-size: var(--iln-font-sm);
  font-weight: 600;
}

.load-error__text {
  flex: 1;
  min-width: 180px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--iln-space-4);
  flex-wrap: wrap;
  gap: var(--iln-space-3);
}

.header-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.editor-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-2);
  font-size: var(--iln-font-2xl, 22px);
  font-weight: 800;
  margin: 0;
  color: var(--iln-text);
  line-height: 1.25;
}

.editor-subtitle {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.header-right {
  display: flex;
  gap: var(--iln-space-2);
  flex-wrap: wrap;
}

.validation-bar {
  margin-bottom: var(--iln-space-4);
}

.validation-alert {
  margin-bottom: 0 !important;
}

.json-collapse {
  margin-top: var(--iln-space-6);
}

.json-viewer {
  max-height: 400px;
  overflow: auto;
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-4);
}

.json-viewer pre {
  margin: 0;
  font-size: var(--iln-font-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--iln-text);
}

/* 分區標籤容器（單層分組 Chip） */
.section-tabs {
  margin-bottom: var(--iln-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-4);
}

.chip-group__title {
  margin: 0 0 var(--iln-space-2);
  font-size: var(--iln-font-xs);
  font-weight: 700;
  color: var(--iln-hint);
  letter-spacing: 0.04em;
}

.chip-group__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--iln-space-2);
}

.chip {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 var(--iln-space-4);
  border-radius: var(--iln-radius-full, 999px);
  border: 1px solid var(--iln-border-subtle);
  background: var(--iln-surface-alt, var(--iln-surface));
  color: var(--iln-text);
  font-size: var(--iln-font-sm);
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    transform 0.12s ease;
}

.chip:hover {
  border-color: var(--iln-brand);
}

.chip:active {
  transform: scale(0.97);
}

.chip.is-active {
  background: var(--iln-brand);
  border-color: var(--iln-brand);
  color: var(--iln-text-on-brand);
  font-weight: 700;
}

.chip:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.section-editor-panel {
  margin-top: var(--iln-space-2);
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .chip,
  .chip:active {
    transition: none;
    transform: none;
  }
}
</style>
