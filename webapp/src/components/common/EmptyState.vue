<template>
  <div class="empty-state">
    <el-empty :description="displayDescription" :image="imageUrl">
      <template v-if="displayTitle" #description>
        <div class="empty-title">{{ displayTitle }}</div>
        <div v-if="displayMessage" class="empty-message">{{ displayMessage }}</div>
      </template>
      <template v-if="emoji" #image>
        <div class="empty-emoji" aria-hidden="true">{{ emoji }}</div>
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
            <span>{{ actionText }}</span>
          </el-button>
          <el-button
            v-else
            :type="actionType"
            :size="actionSize"
            @click="$emit('action')"
          >
            <el-icon v-if="actionIcon" :size="14"><component :is="actionIcon" /></el-icon>
            <span>{{ actionText }}</span>
          </el-button>
          <el-button
            v-if="secondaryActionText"
            :type="secondaryActionType"
            :size="actionSize"
            @click="$emit('secondary-action')"
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
  title: {
    type: String,
    default: "",
  },
  message: {
    type: String,
    default: "",
  },
  emoji: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "暫無資料",
  },
  imageUrl: {
    type: String,
    default: "",
  },
  icon: {
    type: String,
    default: "",
    validator: (v) =>
      !v ||
      ["Document", "Folder", "Connection", "Warning", "Search", "Box"].includes(
        v
      ),
  },
  iconSize: {
    type: Number,
    default: 80,
  },
  iconColor: {
    type: String,
    default: "var(--iln-hint)",
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
  actionSize: {
    type: String,
    default: "default",
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
  secondaryActionText: {
    type: String,
    default: "",
  },
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
    window.open(props.actionHref, "_blank", "noopener,noreferrer");
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
  padding: var(--iln-space-10) var(--iln-space-5);
}

.empty-title {
  font-size: var(--iln-font-lg);
  font-weight: 700;
  color: var(--iln-text);
  margin-bottom: var(--iln-space-1);
}

.empty-message {
  font-size: var(--iln-font-base);
  color: var(--iln-hint);
  line-height: 1.5;
}

.empty-emoji {
  font-size: 64px;
  line-height: 1;
}

.empty-actions {
  display: flex;
  gap: var(--iln-space-3);
  flex-wrap: wrap;
  justify-content: center;
}
</style>
