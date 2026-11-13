<template>
  <div class="skeleton-loader">
    <div v-if="linesCount > 0" class="skeleton-lines">
      <div
        v-for="i in linesCount"
        :key="i"
        class="skeleton-line"
        :style="{ height: lineStyleHeight, marginBottom: '8px' }"
      />
    </div>
    <el-skeleton
      v-else
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
import { computed } from "vue";
import { ElSkeleton, ElSkeletonItem } from "element-plus";

const props = defineProps({
  // 支援 lines (Task 1 規格)
  lines: {
    type: Number,
    default: 0,
  },
  // 支援 height (Task 1 規格)
  height: {
    type: String,
    default: "",
  },
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
  variant: {
    type: String,
    default: "default",
    validator: (v) => ["default", "card", "list", "chart", "table"].includes(v),
  },
});

const linesCount = computed(() => props.lines);

const lineStyleHeight = computed(() => {
  if (props.height) {
    return typeof props.height === "number" ? `${props.height}px` : props.height;
  }
  return "16px";
});
</script>

<style scoped>
.skeleton-loader {
  width: 100%;
}
.skeleton-line {
  background: var(--el-skeleton-color);
  border-radius: 4px;
  animation: skeleton-loading 1.4s ease infinite;
}
@keyframes skeleton-loading {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>
