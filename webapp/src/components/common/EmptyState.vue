<template>
  <div class="empty-state">
    <el-empty :description="description" :image="imageUrl">
      <template v-if="icon" #image>
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
import { ElEmpty, ElButton, ElIcon } from "element-plus";
import {
  Document,
  Folder,
  Connection,
  Warning,
  Search as SearchIcon,
  Box,
} from "@element-plus/icons-vue";

defineProps({
  // 描述文字
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
  // 可選值: 'Document', 'Folder', 'Connection', 'Warning', 'Search', 'Box'
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
    default: "#909399",
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
</style>
