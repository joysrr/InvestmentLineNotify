<template>
  <div class="target-selector">
    <label class="selector-label">選擇目標類型</label>
    <select
      class="selector-field"
      v-model="targetType"
      @change="$emit('update:targetType', $event.target.value)"
    >
      <option
        v-for="t in targetTypes"
        :key="t.value"
        :value="t.value"
      >
        {{ t.label }}
      </option>
    </select>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  targetTypes: {
    type: Array,
    required: true,
  },
});

defineEmits(["update:targetType"]);

const targetType = ref("maintenanceRatio");

watch(targetType, (val) => {
  emit("update:targetType", val);
});
</script>

<style scoped>
.target-selector {
  margin-bottom: 8px;
}

.selector-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.selector-field {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  background: #fff;
  transition: all 0.2s;
}

.selector-field:focus {
  outline: none;
  border-color: #2481cc;
  box-shadow: 0 0 0 3px rgba(36, 129, 204, 0.15);
}
</style>