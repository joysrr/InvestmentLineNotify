<template>
  <div class="error-boundary">
    <slot v-if="!error" />
    <div v-else class="error-fallback">
      <el-alert
        :title="errorTitle"
        type="error"
        :description="errorDescription"
        show-icon
        :closable="false"
      />
      <el-button
        v-if="showRetry"
        type="primary"
        size="small"
        class="error-fallback__retry"
        @click="handleRetry"
      >
        重新載入
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured } from "vue";
import { ElAlert, ElButton } from "element-plus";

const props = defineProps({
  errorTitle: {
    type: String,
    default: "頁面載入失敗",
  },
  errorDescription: {
    type: String,
    default: "發生未預期的錯誤，請重新整理頁面或聯絡管理員",
  },
  showRetry: {
    type: Boolean,
    default: true,
  },
  onRetry: {
    type: Function,
    default: null,
  },
});

const error = ref(null);

onErrorCaptured((err, instance, info) => {
  console.error("[GlobalErrorBoundary] Captured error:", err);
  console.error("[GlobalErrorBoundary] Component:", instance);
  console.error("[GlobalErrorBoundary] Error info:", info);

  error.value = {
    message: err.message,
    stack: err.stack,
    info,
  };

  return false;
});

const handleRetry = () => {
  error.value = null;
  if (props.onRetry) {
    props.onRetry();
  } else {
    window.location.reload();
  }
};
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--iln-space-10) var(--iln-space-4);
  min-height: 300px;
}

.error-fallback__retry {
  margin-top: var(--iln-space-4);
}
</style>
