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
  padding: 32px 16px;
  text-align: center;
  color: var(--color-text-secondary);
}

.error-view__icon {
  color: var(--color-danger);
  margin-bottom: 12px;
}

.error-view__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.error-view__message {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
  word-break: break-word;
}

.error-view__retry {
  min-width: 96px;
}
</style>
