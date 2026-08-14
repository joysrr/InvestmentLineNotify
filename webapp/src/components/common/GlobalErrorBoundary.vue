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
        @click="handleRetry"
        style="margin-top: 16px"
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
  // 自訂錯誤標題
  errorTitle: {
    type: String,
    default: "頁面載入失敗",
  },
  // 自訂錯誤描述
  errorDescription: {
    type: String,
    default: "發生未預期的錯誤，請重新整理頁面或聯絡管理員",
  },
  // 是否顯示重試按鈕
  showRetry: {
    type: Boolean,
    default: true,
  },
  // 自訂重試行為
  onRetry: {
    type: Function,
    default: null,
  },
});

const error = ref(null);

// 捕捉子元件錯誤
onErrorCaptured((err, instance, info) => {
  console.error("[GlobalErrorBoundary] Captured error:", err);
  console.error("[GlobalErrorBoundary] Component:", instance);
  console.error("[GlobalErrorBoundary] Error info:", info);

  error.value = {
    message: err.message,
    stack: err.stack,
    info,
  };

  // 阻止錯誤向上傳播
  return false;
});

const handleRetry = () => {
  error.value = null;
  if (props.onRetry) {
    props.onRetry();
  } else {
    // 預設行為：重新整理頁面
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
  padding: 40px;
  min-height: 300px;
}
</style>
