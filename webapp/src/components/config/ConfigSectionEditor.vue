<template>
  <div class="config-section-editor">
    <div v-for="fieldKey in section.fields" :key="fieldKey" class="config-field-wrapper">
      <ConfigFieldEditor
        :path="section.key + '.' + fieldKey"
        :config="config"
        :meta="meta"
        :error="fieldErrors[fieldKey]"
        @update="handleFieldUpdate"
      />
    </div>

    <!-- Empty state for sections without predefined fields -->
    <div v-if="section.fields.length === 0" class="empty-section">
      <p class="empty-hint">此區塊暫無可編輯欄位，或需透過原始 JSON 編輯</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";

import ConfigFieldEditor from "./ConfigFieldEditor.vue";

const props = defineProps({
  section: {
    type: Object,
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
  errors: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update"]);

// Computed: field-level errors
const fieldErrors = computed(() => {
  const map = {};
  props.errors.forEach((err) => {
    // Extract field path from error message
    const match = err.match(/^([^.]+\.[^.]+)/);
    if (match) {
      const fieldPath = match[1];
      if (!map[fieldPath]) map[fieldPath] = [];
      map[fieldPath].push(err);
    }
  });
  return map;
});

// Handle nested field update
function handleFieldUpdate({ path, value }) {
  // Convert relative path (e.g., "maintenance.protectTrigger") to full path
  emit("update", { path, value });
}
</script>

<style scoped>
.config-section-editor {
  padding: 16px 0;
}

.config-field-wrapper {
  margin-bottom: 16px;
}

.empty-section {
  padding: 32px;
  text-align: center;
  background: #fafafa;
  border-radius: 8px;
  border: 1px dashed #e0e0e0;
}

.empty-hint {
  margin: 0;
  color: #999;
  font-size: 13px;
}
</style>