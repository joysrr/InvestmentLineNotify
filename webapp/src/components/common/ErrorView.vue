<script setup>
import { WarningFilled } from "@element-plus/icons-vue";

defineProps({
  title: { type: String, default: "發生錯誤" },
  message: { type: String, default: "" },
  retryable: { type: Boolean, default: true },
  retryText: { type: String, default: "重試" },
});

const emit = defineEmits(["retry"]);
</script>

<template>
  <div class="error-view" role="alert">
    <el-icon class="error-view__icon" :size="40">
      <WarningFilled />
    </el-icon>
    <div class="error-view__title">{{ title }}</div>
    <div v-if="message" class="error-view__message">{{ message }}</div>
    <el-button
      v-if="retryable"
      type="primary"
      size="small"
      class="error-view__retry"
      @click="emit('retry')"
    >
      {{ retryText }}
    </el-button>
  </div>
</template>

<style scoped>
.error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--iln-space-8) var(--iln-space-4);
  text-align: center;
  color: var(--iln-hint);
}

.error-view__icon {
  color: var(--iln-viz-bear);
  margin-bottom: var(--iln-space-3);
}

.error-view__title {
  font-size: var(--iln-font-md);
  font-weight: 700;
  color: var(--iln-text);
  margin-bottom: var(--iln-space-1-5, 6px);
}

.error-view__message {
  font-size: var(--iln-font-sm);
  line-height: 1.5;
  margin-bottom: var(--iln-space-4);
  word-break: break-word;
  color: var(--iln-hint);
}

.error-view__retry {
  min-width: 96px;
}
</style>
