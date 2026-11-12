<template>
  <div class="strategy-config-panel">
    <div v-if="loading" class="config-skeleton">
      <div v-for="i in 3" :key="i" class="sk-card"></div>
    </div>

    <div v-else-if="error" class="config-error">
      {{ error }}
      <p v-if="errorDetails" class="error-details">{{ errorDetails }}</p>
    </div>

    <div v-else class="config-sections">
      <div class="panel-header-controls">
        <div class="search-bar-container">
          <input
            type="search"
            v-model="searchQuery"
            class="search-input"
            placeholder="🔍 搜尋參數名稱或說明 (如: 維持率, VIX)..."
          />
        </div>
        <button
          class="tg-button mode-toggle-btn"
          @click="toggleEditMode"
          :class="{ 'is-editing': isEditing }"
        >
          {{ isEditing ? "❌ 取消編輯" : "📝 編輯配置" }}
        </button>
      </div>

      <!-- 遍歷各個模組區塊 -->
      <div
        v-for="(module, modKey) in filteredBlocks"
        :key="modKey"
        class="module-section"
      >
        <div class="module-header" @click="toggleModule(modKey)">
          <div class="module-info">
            <h3 class="module-title">{{ module.label }}</h3>
            <p v-if="module.desc" class="module-desc">{{ module.desc }}</p>
          </div>
          <span
            class="module-arrow"
            :class="{ 'is-expanded': isModuleExpanded(modKey) }"
            >▾</span
          >
        </div>

        <div v-if="isModuleExpanded(modKey)" class="params-list">
          <!-- 遞迴遍歷渲染所有參數 -->
          <div
            v-for="item in module.flats"
            :key="item.path"
            class="param-item"
            :class="{ 'is-editing': isEditing }"
          >
            <div
              class="param-main"
              :class="{ 'is-array': Array.isArray(item.value) }"
            >
              <div class="param-label-group">
                <span class="param-label">{{ item.label }}</span>
                <span class="param-path">{{ item.path }}</span>
              </div>
              <div class="param-value-box">
                <div class="array-container" v-if="Array.isArray(item.value)">
                  <!-- 陣列編輯過度複雜，目前僅開放唯讀 -->
                  <div
                    class="array-card"
                    v-for="(row, idx) in item.value"
                    :key="idx"
                  >
                    <div v-if="typeof row === 'object' && row !== null">
                      <div v-for="(v, k) in row" :key="k" class="array-row">
                        <span class="array-key">{{ k }}</span>
                        <span
                          class="array-val"
                          :class="{
                            'highlight-val': [
                              'note',
                              'comment',
                              'label',
                            ].includes(k),
                          }"
                          >{{ String(v) }}</span
                        >
                      </div>
                    </div>
                    <div v-else class="array-primitive">
                      {{ String(row) }}
                    </div>
                  </div>
                  <div v-if="isEditing" class="array-edit-warning">
                    陣列項目請至 JSON 原始檔修改
                  </div>
                </div>
                <div v-else class="scalar-value-box">
                  <template v-if="isEditing">
                    <input
                      v-if="typeof item.value === 'number'"
                      type="number"
                      class="edit-input"
                      :value="getEditedValue(modKey, item.path)"
                      @input="
                        setEditedValue(
                          modKey,
                          item.path,
                          Number($event.target.value),
                        )
                      "
                      step="any"
                    />
                    <select
                      v-else-if="typeof item.value === 'boolean'"
                      class="edit-select"
                      :value="getEditedValue(modKey, item.path).toString()"
                      @change="
                        setEditedValue(
                          modKey,
                          item.path,
                          $event.target.value === 'true',
                        )
                      "
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                    <input
                      v-else
                      type="text"
                      class="edit-input"
                      :value="getEditedValue(modKey, item.path)"
                      @input="
                        setEditedValue(modKey, item.path, $event.target.value)
                      "
                    />
                  </template>
                  <span v-else class="param-value">{{
                    String(item.value)
                  }}</span>
                  <span v-if="item.unit" class="param-unit">{{
                    item.unit
                  }}</span>
                </div>
              </div>
            </div>
            <p v-if="item.desc" class="param-desc">{{ item.desc }}</p>
          </div>

          <!-- 原有的 JSON 檢視 (折疊) -->
          <details class="raw-json-details" v-if="!searchQuery && !isEditing">
            <summary>查看原始 JSON</summary>
            <pre class="json-content">{{ formatJson(module.content) }}</pre>
          </details>
        </div>
      </div>

      <!-- 編輯模式浮動儲存條 -->
      <div v-if="isEditing" class="floating-save-bar">
        <div class="save-status">已修改 {{ diffCount }} 個參數</div>
        <button
          class="tg-button save-btn"
          :disabled="diffCount === 0 || saving"
          @click="saveConfig"
        >
          {{ saving ? "儲存中..." : "💾 儲存修改" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * @deprecated StrategyConfigPanel 已廢棄，請使用 StrategyConfigEditor.vue 做帶驗證的結構化策略編輯
 */
import { ref, computed, reactive, onMounted } from "vue";
import { fetchStrategyConfig, updateStrategyConfig } from "../api/index.js";

const config = ref(null);
const meta = ref({});
const loading = ref(true);
const error = ref(null);
const errorDetails = ref(null);
const expandedModules = reactive({});
const searchQuery = ref("");

const isEditing = ref(false);
const saving = ref(false);
const editedConfig = ref({});

// 工具：深度複製 JSON
const cloneJSON = (obj) => JSON.parse(JSON.stringify(obj));

const load = async () => {
  loading.value = true;
  error.value = null;
  errorDetails.value = null;
  try {
    const res = await fetchStrategyConfig();
    meta.value = res._meta || {};

    if (res.strategy && res.strategy.content) {
      const blocks = {};
      for (const [key, val] of Object.entries(res.strategy.content)) {
        const blockMeta = meta.value[key] || {};
        blocks[key] = {
          label: blockMeta.label || key,
          desc: blockMeta.desc || "",
          content: val,
        };
        expandedModules[key] = false;
      }
      config.value = blocks;
      editedConfig.value = cloneJSON(res.strategy.content);
    } else {
      const { _meta, ...modules } = res;
      config.value = modules;
      // 沒有上層 strategy.content 結構，容錯
      const contentOnly = {};
      for (const key of Object.keys(modules)) {
        expandedModules[key] = false;
        contentOnly[key] = modules[key].content;
      }
      editedConfig.value = cloneJSON(contentOnly);
    }
  } catch (e) {
    error.value = "無法載入策略參數";
    errorDetails.value = e.message;
  } finally {
    loading.value = false;
  }
};

// 根據 path 字串取得巢狀物件深層參考 (不含最後一層), 用於 update
const setNestedValue = (obj, path, value) => {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
};

// 根據 path 字串讀取巢狀物件深度值
const getNestedValue = (obj, path) => {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
};

const toggleEditMode = () => {
  if (isEditing.value) {
    // 捨棄修改：退回原 config
    const root = {};
    for (const key in config.value) {
      root[key] = config.value[key].content;
    }
    editedConfig.value = cloneJSON(root);
  }
  isEditing.value = !isEditing.value;
};

const getEditedValue = (modKey, localPath) => {
  const fullPath = localPath === modKey ? modKey : localPath;
  return getNestedValue(editedConfig.value, fullPath);
};

const setEditedValue = (modKey, localPath, newVal) => {
  const fullPath = localPath === modKey ? modKey : localPath;
  setNestedValue(editedConfig.value, fullPath, newVal);
};

const diffCount = computed(() => {
  if (!config.value || !editedConfig.value) return 0;
  let count = 0;
  const countDiffs = (orig, edited) => {
    if (orig === null || typeof orig !== "object") {
      if (orig !== edited) count++;
      return;
    }
    if (Array.isArray(orig)) return; // 略過陣列計算
    for (const key in orig) {
      if (edited[key] !== undefined) {
        countDiffs(orig[key], edited[key]);
      }
    }
  };

  for (const key in config.value) {
    countDiffs(config.value[key].content, editedConfig.value[key]);
  }
  return count;
});

const saveConfig = async () => {
  if (diffCount.value === 0) return;
  saving.value = true;
  error.value = null;
  errorDetails.value = null;

  try {
    await updateStrategyConfig(editedConfig.value);

    // 儲存成功，如果 Telegram SDK 有提供 haptic feedback 則震動
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
    }

    // 重新載入最新配置
    await load();
    isEditing.value = false;
  } catch (err) {
    error.value = "儲存失敗";
    errorDetails.value =
      err.response?.data?.details || err.message || "格式錯誤或網路異常";
  } finally {
    saving.value = false;
  }
};

const flattenConfig = (obj, prefix = "") => {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return [{ path: prefix, value: obj }];
  }
  let result = [];
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];

    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      result.push({ path, value: val });
    } else {
      result = result.concat(flattenConfig(val, path));
    }
  }
  return result;
};

const getFlatParamsForModule = (modKey) => {
  const module = config.value[modKey];
  if (!module || module.content === undefined) return [];

  // 渲染時改用 original 結構，但編輯時會綁定 editedConfig 的對應節點
  const flats = flattenConfig(module.content, modKey);
  return flats.map((item) => {
    const metaInfo = meta.value[item.path] || {};
    return {
      path: item.path,
      value: item.value,
      label: metaInfo.label || item.path.split(".").pop(),
      desc: metaInfo.description || metaInfo.desc || "",
      unit: metaInfo.unit || "",
    };
  });
};

const filteredBlocks = computed(() => {
  if (!config.value) return {};
  const query = searchQuery.value.toLowerCase().trim();
  const result = {};

  for (const [modKey, module] of Object.entries(config.value)) {
    const flats = getFlatParamsForModule(modKey);

    if (!query) {
      result[modKey] = { ...module, flats };
      continue;
    }

    const matchedFlats = flats.filter((item) => {
      return (
        (item.label && item.label.toLowerCase().includes(query)) ||
        (item.path && item.path.toLowerCase().includes(query)) ||
        (item.desc && item.desc.toLowerCase().includes(query))
      );
    });

    if (matchedFlats.length > 0) {
      result[modKey] = { ...module, flats: matchedFlats };
    }
  }
  return result;
});

const isModuleExpanded = (key) => {
  if (searchQuery.value.trim() !== "") return true;
  // 編輯模式全開，方便確認
  if (isEditing.value) return true;
  return !!expandedModules[key];
};

const toggleModule = (key) => {
  expandedModules[key] = !expandedModules[key];
};

const formatJson = (obj) => JSON.stringify(obj, null, 2);

onMounted(load);
</script>

<style scoped>
.panel-header-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.search-bar-container {
  flex: 1;
}

.mode-toggle-btn {
  padding: 0 16px;
  border-radius: 12px;
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.mode-toggle-btn.is-editing {
  background: var(--tg-theme-destructive-text-color, #ff3b30);
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: var(--tg-theme-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
  font-size: 14px;
  transition: border-color 0.3s;
}
.search-input:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.search-input:focus {
  border-color: var(--tg-theme-button-color, #2481cc);
}

.strategy-config-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 80px; /* 給懸浮儲存條的空間 */
}

.module-section {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.module-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--tg-theme-secondary-bg-color, #f9f9f9);
  cursor: pointer;
}

.module-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--tg-theme-text-color, #222);
}

.module-desc {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  margin: 0;
}

.module-arrow {
  font-size: 20px;
  color: var(--tg-theme-hint-color, #ccc);
  transition: transform 0.3s;
}
.module-arrow.is-expanded {
  transform: rotate(180deg);
}

.params-list {
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.param-item {
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  transition: background-color 0.2s;
}
.param-item:first-child {
  border-top: none;
}
.param-item.is-editing {
  padding-bottom: 8px;
}

.param-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.param-label-group {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.param-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #333);
}

.param-path {
  font-size: 10px;
  font-family: monospace;
  color: var(--tg-theme-hint-color, #aaa);
}

.param-value-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 100px;
}

.param-main.is-array {
  flex-direction: column;
}

.param-main.is-array .param-value-box {
  align-items: stretch;
  max-width: 100%;
  width: 100%;
}

.scalar-value-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.param-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-button-color, #2481cc);
}

.param-unit {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #888);
}

.edit-input,
.edit-select {
  width: 100%;
  max-width: 140px;
  text-align: right;
  padding: 8px 10px;
  border: 1px solid var(--tg-theme-button-color, #2481cc);
  border-radius: 8px;
  background: var(--tg-theme-bg-color, #fff);
  color: var(--tg-theme-text-color, #000);
  font-size: 14px;
  font-weight: 600;
}
.edit-input:focus-visible,
.edit-select:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.edit-input:focus,
.edit-select:focus {
  box-shadow: 0 0 0 2px rgba(36, 129, 204, 0.2);
}

.array-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.array-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.array-edit-warning {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  text-align: center;
  margin-top: 4px;
}

.array-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.4;
  gap: 12px;
}
.array-row:last-child {
  margin-bottom: 0;
}

.array-key {
  color: var(--tg-theme-hint-color, #888);
  font-family: monospace;
  font-size: 11px;
}

.array-val {
  color: var(--tg-theme-text-color, #333);
  font-weight: 500;
  text-align: right;
  word-break: break-word;
}

.highlight-val {
  color: var(--iln-danger-text);
  font-weight: 600;
  background: rgba(217, 83, 79, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
}

.array-primitive {
  font-size: 13px;
  color: var(--tg-theme-text-color, #333);
  font-family: monospace;
}

.param-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--tg-theme-hint-color, #666);
  margin: 0;
}

.raw-json-details {
  margin-top: 20px;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
  padding-top: 12px;
}

.raw-json-details summary {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
  cursor: pointer;
}
.raw-json-details summary:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.json-content {
  font-family: "SF Mono", monospace;
  font-size: 10px;
  background: var(--iln-surface);
  padding: 10px;
  border-radius: 8px;
  margin-top: 8px;
  overflow-x: auto;
}

.config-error {
  color: var(--iln-danger-text);
  background: var(--iln-danger-bg);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--iln-danger-bg, #f2dede);
  font-weight: bold;
}

.error-details {
  margin-top: 8px;
  font-size: 12px;
  font-weight: normal;
  color: var(--iln-danger-text);
  white-space: pre-wrap;
}

.floating-save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px 30px;
  background: var(--tg-theme-bg-color, #fff);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  animation: slideUp 0.3s ease-out;
}

.save-status {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #333);
}

.save-btn {
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 15px;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sk-card {
  height: 80px;
  background: var(--iln-surface);
  border-radius: 16px;
  margin-bottom: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
