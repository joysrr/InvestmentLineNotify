<template>
  <div class="config-field-editor" :data-testid="'field-' + path">
    <label class="field-label" :for="path">
      <span class="label-text">{{ fieldMeta?.label || path }}</span>
      <span v-if="fieldMeta?.unit" class="label-unit">({{ fieldMeta.unit }})</span>
      <el-tooltip v-if="fieldMeta?.desc" :content="fieldMeta.desc" placement="top">
        <el-icon class="help-icon"><QuestionFilled /></el-icon>
      </el-tooltip>
    </label>

    <div class="field-input-wrapper">
      <!-- Number Input -->
      <el-input-number
        v-if="fieldType === 'number'"
        v-model="localValue"
        :min="fieldMeta?.min"
        :max="fieldMeta?.max"
        :step="getStep(fieldMeta)"
        :precision="getPrecision(fieldMeta)"
        controls-position="right"
        :placeholder="fieldMeta?.placeholder || '請輸入數值'"
        @change="handleChange"
        class="field-input"
      />

      <!-- Boolean Select -->
      <el-select
        v-else-if="fieldType === 'boolean'"
        v-model="localValue"
        :placeholder="fieldMeta?.placeholder || '請選擇'"
        style="width: 100%"
        @change="handleChange"
        class="field-input"
      >
        <el-option label="是 (true)" :value="true" />
        <el-option label="否 (false)" :value="false" />
      </el-select>

      <!-- String Input -->
      <el-input
        v-else-if="fieldType === 'string'"
        v-model="localValue"
        :placeholder="fieldMeta?.placeholder || '請輸入文字'"
        @change="handleChange"
        class="field-input"
      />

      <!-- Array Editor (JSON) -->
      <el-input
        v-else-if="fieldType === 'array'"
        v-model="localValueJson"
        type="textarea"
        :rows="4"
        :placeholder="fieldMeta?.placeholder || 'JSON 陣列格式'"
        @change="handleArrayChange"
        class="field-input json-input"
      />

      <!-- Object Editor (JSON) -->
      <el-input
        v-else-if="fieldType === 'object'"
        v-model="localValueJson"
        type="textarea"
        :rows="6"
        :placeholder="fieldMeta?.placeholder || 'JSON 物件格式'"
        @change="handleObjectChange"
        class="field-input json-input"
      />

      <!-- Enum Select -->
      <el-select
        v-else-if="fieldType === 'enum'"
        v-model="localValue"
        :placeholder="fieldMeta?.placeholder || '請選擇'"
        style="width: 100%"
        @change="handleChange"
        class="field-input"
      >
        <el-option
          v-for="opt in enumOptions"
          :key="opt"
          :label="opt"
          :value="opt"
        />
      </el-select>

      <!-- Fallback -->
      <div v-else class="unsupported-type">
        <span class="unsupported-label">不支援的型別: {{ fieldType }}</span>
        <pre class="raw-value">{{ JSON.stringify(localValue, null, 2) }}</pre>
      </div>
    </div>

    <!-- Validation Error -->
    <el-form-item
      v-if="error"
      :error="error"
      class="field-error"
    >
      {{ error }}
    </el-form-item>

    <!-- Min/Max Hint -->
    <div v-if="fieldMeta && (fieldMeta.min !== undefined || fieldMeta.max !== undefined)" class="range-hint">
      範圍:
      <span v-if="fieldMeta.min !== undefined">最小 {{ fieldMeta.min }}</span>
      <span v-if="fieldMeta.max !== undefined">最大 {{ fieldMeta.max }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { QuestionFilled } from "@element-plus/icons-vue";

const props = defineProps({
  path: {
    type: String,
    required: true,
  },
  config: {
    type: Object,
    required: true,
  },
  meta: {
    type: Object,
    default: () => ({}),
  },
  error: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update"]);

// Local value for controlled input
const localValue = ref(null);
const localValueJson = ref("");

// Get field meta from config meta
const fieldMeta = computed(() => {
  return props.meta[props.path] || null;
});

// Normalize meta.type (and non-standard aliases) into canonical editor type
function normalizeType(rawType) {
  switch (rawType) {
    case "integer":
    case "float":
    case "double":
    case "decimal":
    case "real":
    case "number":
      return "number";
    case "text":
    case "string":
    case "str":
      return "string";
    case "bool":
    case "boolean":
      return "boolean";
    case "list":
    case "array":
      return "array";
    case "json":
    case "object":
    case "dict":
    case "map":
      return "object";
    case "enum":
    case "select":
    case "choice":
      return "enum";
    default:
      return null;
  }
}

// Enum options resolved from meta.options or meta.enum
const enumOptions = computed(() => {
  const opts = fieldMeta.value?.options || fieldMeta.value?.enum;
  return Array.isArray(opts) ? opts : [];
});

// Determine field type
const fieldType = computed(() => {
  const metaType = normalizeType(fieldMeta.value?.type);
  if (metaType) {
    // enum without options degrades to string so it stays editable
    if (metaType === "enum" && enumOptions.value.length === 0) return "string";
    return metaType;
  }

  const val = currentValue.value;
  if (typeof val === "string") return "string";
  if (typeof val === "number") return "number";
  if (typeof val === "boolean") return "boolean";
  if (Array.isArray(val)) return "array";
  if (val !== null && typeof val === "object") return "object";
  // undefined/null -> fallback to string so every field stays editable
  return "string";
});

// Get current value from config using path
const currentValue = computed(() => {
  return getNestedValue(props.config, props.path);
});

// Initialize local value when config or path changes
watch(() => currentValue.value, (newVal) => {
  if (fieldType.value === "array" || fieldType.value === "object") {
    localValueJson.value = JSON.stringify(newVal, null, 2);
  } else {
    localValue.value = newVal;
  }
}, { immediate: true, deep: true });

// Handle number/boolean/string change
function handleChange(value) {
  localValue.value = value;
  emit("update", { path: props.path, value });
}

// Handle array JSON change
function handleArrayChange(value) {
  localValueJson.value = value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      emit("update", { path: props.path, value: parsed });
    } else {
      ElMessage.warning("請輸入有效的 JSON 陣列格式");
    }
  } catch (e) {
    // Ignore parse errors during typing
  }
}

// Handle object JSON change
function handleObjectChange(value) {
  localValueJson.value = value;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      emit("update", { path: props.path, value: parsed });
    } else {
      ElMessage.warning("請輸入有效的 JSON 物件格式");
    }
  } catch (e) {
    // Ignore parse errors during typing
  }
}

// Get step for number input
function getStep(meta) {
  if (!meta) return 1;
  if (meta.unit === "%") return 0.1;
  if (meta.unit === "x" || meta.unit === "pt") return 0.01;
  if (meta.min !== undefined && meta.max !== undefined) {
    const range = meta.max - meta.min;
    if (range < 1) return 0.01;
    if (range < 10) return 0.1;
    if (range < 100) return 1;
  }
  return 1;
}

// Get precision for number input
function getPrecision(meta) {
  if (!meta) return 0;
  if (meta.unit === "%") return 2;
  if (meta.unit === "x") return 2;
  if (meta.unit === "pt") return 1;
  return 0;
}

// Get nested value from object using dot path
function getNestedValue(obj, path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}
</script>

<style scoped>
.config-field-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-text);
}

.label-text {
  flex: 1;
}

.label-unit {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  background: var(--iln-surface);
  padding: 2px 6px;
  border-radius: var(--iln-radius-sm);
}

.help-icon {
  color: var(--iln-hint);
  cursor: help;
  font-size: 14px;
}

.help-icon:hover {
  color: var(--iln-brand);
}

.field-input-wrapper {
  position: relative;
}

.field-input {
  width: 100%;
}

.json-input {
  font-family: monospace;
  font-size: 12px;
}

.field-error {
  margin: 0 !important;
  padding: 0 !important;
}

.unsupported-type {
  padding: var(--iln-space-3);
  background: var(--iln-surface);
  border-radius: var(--iln-radius-sm);
  border: 1px dashed var(--iln-border-subtle);
}

.unsupported-label {
  display: block;
  color: var(--iln-hint);
  font-size: 12px;
  margin-bottom: 8px;
}

.raw-value {
  margin: 0;
  font-size: 11px;
  color: var(--iln-hint);
  white-space: pre-wrap;
  word-break: break-word;
}

.range-hint {
  font-size: 11px;
  color: var(--iln-hint);
  display: flex;
  gap: 12px;
}
</style>