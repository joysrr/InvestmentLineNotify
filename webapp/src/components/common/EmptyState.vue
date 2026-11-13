<template>
  <div class="empty-state">
    <el-empty :description="displayDescription" :image="imageUrl">
      <template v-if="displayTitle" #description>
        <div class="empty-title">{{ displayTitle }}</div>
        <div v-if="displayMessage" class="empty-message">{{ displayMessage }}</div>
      </template>
      <template v-if="emoji" #image>
        <div class="empty-emoji">{{ emoji }}</div>
      </template>
      <template v-else-if="icon" #image>
        <el-icon :size="iconSize" :color="iconColor">
          <component :is="icon" />
        </el-icon>
      </template>
      <template v-if="actionText" #default>
        <el-button
          :type="actionType"
          :size="actionSize"
          @click="$emit('action')"
        >
          {{ actionText }}
        </el-button>
      </template>
    </el-empty>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { ElEmpty, ElButton, ElIcon } from "element-plus";
import {
  Document,
  Folder,
  Connection,
  Warning,
  Search as SearchIcon,
  Box,
} from "@element-plus/icons-vue";

const props = defineProps({
  // 支援 Task 1 規格 props: title, message
  title: {
    type: String,
    default: "",
  },
  message: {
    type: String,
    default: "",
  },
  // emoji 作為圖示（與 icon / imageUrl 互斥，優先於 icon）
  emoji: {
    type: String,
    default: "",
  },
  // 原有相容描述文字
  description: {
    type: String,
    default: "暫無資料",
  },
  // 自訂圖片 URL（與 icon 互斥）
  imageUrl: {
    type: String,
    default: "",
  },
  // 使用 Element Plus icon（與 imageUrl 互斥）
  icon: {
    type: String,
    default: "",
    validator: (v) =>
      !v ||
      ["Document", "Folder", "Connection", "Warning", "Search", "Box"].includes(
        v
      ),
  },
  // Icon 大小
  iconSize: {
    type: Number,
    default: 80,
  },
  // Icon 顏色
  iconColor: {
    type: String,
    default: "var(--iln-hint)",
  },
  // 行動按鈕文字
  actionText: {
    type: String,
    default: "",
  },
  // 行動按鈕類型
  actionType: {
    type: String,
    default: "primary",
  },
  // 行動按鈕尺寸
  actionSize: {
    type: String,
    default: "default",
  },
});

defineEmits(["action"]);

const displayTitle = computed(() => props.title);
const displayMessage = computed(() => props.message);
const displayDescription = computed(() => {
  if (props.title) return "";
  return props.description;
});
</script>

<script>
export default {
  components: {
    Document,
    Folder,
    Connection,
    Warning,
    SearchIcon,
    Box,
  },
};
</script>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 40px 20px;
}
.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}
.empty-message {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
.empty-emoji {
  font-size: 64px;
  line-height: 1;
}
</style>
