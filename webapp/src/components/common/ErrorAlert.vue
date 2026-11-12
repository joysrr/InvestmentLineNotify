<template>
  <div v-if="visible" class="error-alert">
    <el-alert
      :title="title"
      :type="type"
      :description="description"
      :closable="closable"
      :show-icon="showIcon"
      @close="handleClose"
    >
      <template v-if="showRetry || showDetail" #default>
        <div class="error-alert-actions">
          <el-button
            v-if="showRetry"
            type="primary"
            size="small"
            @click="$emit('retry')"
          >
            {{ retryText }}
          </el-button>
          <el-button
            v-if="showDetail && errorDetail"
            type="info"
            size="small"
            @click="detailVisible = !detailVisible"
          >
            {{ detailVisible ? "隱藏詳情" : "查看詳情" }}
          </el-button>
        </div>
        <el-collapse-transition>
          <div v-show="detailVisible" class="error-detail">
            <pre>{{ errorDetail }}</pre>
          </div>
        </el-collapse-transition>
      </template>
    </el-alert>
  </div>
</template>

<script setup>
/**
 * @available 此元件備用供未來頁面使用
 * ErrorAlert 適用場景 (非全頁錯誤，由 GlobalErrorBoundary 處理):
 * - 表單驗證失敗 inline 提示
 * - 區塊級 API 失敗 (如圖表載入失敗、局部資料刷新失敗)
 * - 使用者操作回饋 (刪除失敗、儲存失敗)
 * 
 * 輕量級 inline 錯誤條，支援 dismiss/retry/action
 */
import { ref } from "vue";
import { ElAlert, ElButton, ElCollapseTransition } from "element-plus";

defineProps({
  // 是否顯示
  visible: {
    type: Boolean,
    default: true,
  },
  // 標題
  title: {
    type: String,
    default: "操作失敗",
  },
  // 描述
  description: {
    type: String,
    default: "請稍後再試，或聯絡管理員",
  },
  // 類型
  type: {
    type: String,
    default: "error",
    validator: (v) => ["success", "warning", "info", "error"].includes(v),
  },
  // 是否可關閉
  closable: {
    type: Boolean,
    default: true,
  },
  // 是否顯示圖示
  showIcon: {
    type: Boolean,
    default: true,
  },
  // 是否顯示重試按鈕
  showRetry: {
    type: Boolean,
    default: false,
  },
  // 重試按鈕文字
  retryText: {
    type: String,
    default: "重試",
  },
  // 是否顯示詳情按鈕
  showDetail: {
    type: Boolean,
    default: false,
  },
  // 錯誤詳情（技術訊息/stack trace）
  errorDetail: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close", "retry"]);

const detailVisible = ref(false);

const handleClose = () => {
  emit("close");
};
</script>

<style scoped>
.error-alert {
  margin-bottom: 16px;
}

.error-alert-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.error-detail {
  margin-top: var(--iln-space-3);
  padding: var(--iln-space-3);
  background-color: var(--iln-surface);
  border-radius: var(--iln-radius-sm);
  max-height: 200px;
  overflow-y: auto;
}

.error-detail pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
