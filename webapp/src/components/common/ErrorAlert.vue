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
      <template v-if="showRetry || showDetail || actionText" #default>
        <div class="error-alert-actions">
          <el-button
            v-if="showRetry"
            type="primary"
            :size="buttonSize"
            @click="$emit('retry')"
          >
            {{ retryText }}
          </el-button>
          <el-button
            v-if="showDetail && errorDetail"
            type="info"
            :size="buttonSize"
            @click="detailVisible = !detailVisible"
          >
            {{ detailVisible ? "隱藏詳情" : "查看詳情" }}
          </el-button>
          <el-button
            v-if="actionText"
            :type="actionType"
            :size="buttonSize"
            :href="actionHref || undefined"
            @click="$emit('action')"
          >
            <el-icon v-if="actionIcon" :size="14"><component :is="actionIcon" /></el-icon>
            <span>{{ actionText }}</span>
          </el-button>
        </div>
        <el-collapse-transition>
          <div v-show="detailVisible" class="error-detail">
            <pre class="tabular">{{ errorDetail }}</pre>
          </div>
        </el-collapse-transition>
      </template>
    </el-alert>
  </div>
</template>

<script setup>
/**
 * ErrorAlert 適用場景（非全頁錯誤，由 GlobalErrorBoundary 處理）：
 * - 表單驗證失敗 inline 提示
 * - 區塊級 API 失敗（如圖表載入失敗、局部資料刷新失敗）
 * - 使用者操作回饋（刪除失敗、儲存失敗）
 */
import { ref } from "vue";
import { ElAlert, ElButton, ElCollapseTransition, ElIcon } from "element-plus";

defineProps({
  visible: {
    type: Boolean,
    default: true,
  },
  title: {
    type: String,
    default: "操作失敗",
  },
  description: {
    type: String,
    default: "請稍後再試，或聯絡管理員",
  },
  type: {
    type: String,
    default: "error",
    validator: (v) => ["success", "warning", "info", "error"].includes(v),
  },
  closable: {
    type: Boolean,
    default: true,
  },
  showIcon: {
    type: Boolean,
    default: true,
  },
  showRetry: {
    type: Boolean,
    default: false,
  },
  retryText: {
    type: String,
    default: "重試",
  },
  showDetail: {
    type: Boolean,
    default: false,
  },
  errorDetail: {
    type: String,
    default: "",
  },
  actionText: {
    type: String,
    default: "",
  },
  actionType: {
    type: String,
    default: "primary",
    validator: (v) => ["primary", "success", "warning", "danger", "info", "default"].includes(v),
  },
  buttonSize: {
    type: String,
    default: "small",
    validator: (v) => ["large", "default", "small"].includes(v),
  },
  actionIcon: {
    type: String,
    default: "",
  },
  actionHref: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close", "retry", "action"]);

const detailVisible = ref(false);

const handleClose = () => {
  emit("close");
};
</script>

<style scoped>
.error-alert {
  margin-bottom: var(--iln-space-4);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.error-alert-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--iln-space-2);
  margin-top: var(--iln-space-3);
}

.error-detail {
  margin-top: var(--iln-space-3);
  padding: var(--iln-space-3);
  background-color: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-sm);
  max-height: 200px;
  overflow-y: auto;
}

.error-detail pre {
  margin: 0;
  font-size: var(--iln-font-xs);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--iln-text);
}
</style>
