<template>
  <div class="skeleton-loader">
    <el-skeleton
      :rows="rows"
      :animated="animated"
      :loading="true"
    >
      <template v-if="variant === 'card'" #template>
        <el-skeleton-item variant="image" style="width: 100%; height: 240px" />
        <div style="padding: 14px">
          <el-skeleton-item variant="h3" style="width: 50%" />
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-top: 16px;
            "
          >
            <el-skeleton-item variant="text" style="margin-right: 16px" />
            <el-skeleton-item variant="text" style="width: 30%" />
          </div>
        </div>
      </template>

      <template v-else-if="variant === 'list'" #template>
        <div v-for="i in rows" :key="i" style="margin-bottom: 16px">
          <div style="display: flex; align-items: center">
            <el-skeleton-item
              variant="circle"
              style="width: 40px; height: 40px; margin-right: 12px"
            />
            <div style="flex: 1">
              <el-skeleton-item variant="text" style="width: 60%" />
              <el-skeleton-item
                variant="text"
                style="width: 40%; margin-top: 8px"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="variant === 'chart'" #template>
        <el-skeleton-item variant="rect" style="width: 100%; height: 400px" />
        <div style="margin-top: 16px; display: flex; gap: 16px">
          <el-skeleton-item variant="button" style="width: 100px" />
          <el-skeleton-item variant="button" style="width: 100px" />
          <el-skeleton-item variant="button" style="width: 100px" />
        </div>
      </template>

      <template v-else-if="variant === 'table'" #template>
        <div style="display: flex; margin-bottom: 16px">
          <el-skeleton-item
            v-for="i in 4"
            :key="i"
            variant="text"
            style="flex: 1; margin-right: 8px; height: 40px"
          />
        </div>
        <div v-for="i in rows" :key="i" style="display: flex; margin-bottom: 12px">
          <el-skeleton-item
            v-for="j in 4"
            :key="j"
            variant="text"
            style="flex: 1; margin-right: 8px"
          />
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup>
import { ElSkeleton, ElSkeletonItem } from "element-plus";

defineProps({
  // 骨架屏行數（variant=default 時有效）
  rows: {
    type: Number,
    default: 5,
  },
  // 是否顯示動畫
  animated: {
    type: Boolean,
    default: true,
  },
  // 骨架屏變體
  // default: 純文字行
  // card: 卡片（圖片 + 標題 + 描述）
  // list: 列表（頭像 + 兩行文字）
  // chart: 圖表（大矩形 + 按鈕組）
  // table: 表格（表頭 + 多行）
  variant: {
    type: String,
    default: "default",
    validator: (v) => ["default", "card", "list", "chart", "table"].includes(v),
  },
});
</script>

<style scoped>
.skeleton-loader {
  width: 100%;
}
</style>
