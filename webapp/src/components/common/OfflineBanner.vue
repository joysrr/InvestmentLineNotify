<template>
  <el-notification
    v-if="visible"
    :title="title"
    :message="message"
    type="warning"
    icon-component="Warning"
    :duration="0"
    :offset="40"
    class="offline-banner"
    @close="handleClose"
  >
    <template #default>
      <div class="offline-banner-actions">
        <el-button size="small" type="primary" @click="handleRetry">
          {{ retryText }}
        </el-button>
      </div>
    </template>
  </el-notification>
</template>

<script setup>
/**
 * 離線／弱網提醒橫條。
 * 單例掛載於 App.vue，根據 useNetworkStatus 的 status 顯示／隱藏。
 */
import { ref, watch, nextTick } from "vue";
import { ElNotification, ElButton } from "element-plus";
import { networkStatus } from "../../composables/useNetworkStatus.js";

const emit = defineEmits(["retry"]);

const visible = ref(false);
const message = ref("");
const title = ref("網路連線中斷");
const retryText = ref("重試");

const statusText = (s) => {
  switch (s) {
    case "offline":
      return { title: "網路已離線", message: "目前無網路連線，部分資料無法更新" };
    case "weak":
      return { title: "網路較慢", message: "偵測到弱網環境，頁面載入可能較慢" };
    default:
      return null;
  }
};

const updateBanner = () => {
  const info = statusText(networkStatus.status.value);
  if (!info) {
    visible.value = false;
    return;
  }
  title.value = info.title;
  message.value = info.message;
  visible.value = true;
};

watch(
  () => networkStatus.status.value,
  () => {
    nextTick(() => updateBanner());
  },
  { immediate: true },
);

const handleClose = () => {
  visible.value = false;
};

const handleRetry = () => {
  emit("retry");
  visible.value = false;
};

defineExpose({ handleRetry });
</script>

<style scoped>
.offline-banner {
  z-index: 2000;
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: min(92vw, 520px);
  box-sizing: border-box;
}

.offline-banner-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--iln-space-2);
}
</style>
