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
      <template v-if="hasAction" #default>
        <div class="empty-actions">
          <el-button
            v-if="actionHref"
            :type="actionType"
            :size="actionSize"
            native-type="button"
            @click="handleActionHref"
          >
            <el-icon v-if="actionIcon" :size="14"><component :is="actionIcon" /></el-icon>
            {{ actionText }}
          </el-button>
          <el-button
            v-else
            :type="actionType"
            :size="actionSize"
            @click="$emit('action')"
          >
            <el-icon v-if="actionIcon" :size="14"><component :is="actionIcon" /></el-icon>
            {{ actionText }}
          </el-button>
          <el-button
            v-if="secondaryActionText"
            :type="secondaryActionType"
            :size="actionSize"
            @click="$emit('secondary-action')"
            class="empty-secondary-btn"
          >
            {{ secondaryActionText }}
          </el-button>
        </div>
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
    validator: (v) => ["primary", "success", "warning", "danger", "info", "default"].includes(v),
  },
  // 行動按鈕尺寸
  actionSize: {
    type: String,
    default: "default",
    validator: (v) => ["large", "default", "small"].includes(v),
  },
  // 行動按鈕圖示
  actionIcon: {
    type: String,
    default: "",
  },
  // 行動按鈕連結（若提供則使用 <a> 行為）
  actionHref: {
    type: String,
    default: "",
  },
  // 次要動作按鈕文字
  secondaryActionText: {
    type: String,
    default: "",
  },
  // 次要動作按鈕類型
  secondaryActionType: {
    type: String,
    default: "default",
    validator: (v) => ["primary", "success", "warning", "danger", "info", "default"].includes(v),
  },
});

const emit = defineEmits(["action", "secondary-action"]);

const displayTitle = computed(() => props.title);
const displayMessage = computed(() => props.message);
const displayDescription = computed(() => {
  if (props.title) return "";
  return props.description;
});
const hasAction = computed(() => props.actionText || props.secondaryActionText);

const handleActionHref = () => {
  if (props.actionHref) {
    window.open(props.actionHref, "_blank");
    emit("action");
  }
};
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
.empty-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.empty-secondary-btn {
  /* secondary button styling handled by type="default" */
}
</style>
