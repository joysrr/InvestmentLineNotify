<template>
  <div class="subtabs-bar">
    <router-link to="/radar" class="subtab-btn" active-class="active">
      🌐 市場雷達
    </router-link>
    <router-link to="/macro" class="subtab-btn" active-class="active">
      ⚖️ 多空對決
    </router-link>
    <router-link to="/technical" class="subtab-btn" active-class="active">
      📊 技術指標
    </router-link>
  </div>
</template>

<script setup>
// 純展示組件，透過 router-link 自動處理 active class
</script>

<style scoped>
.subtabs-bar {
  display: flex;
  background: var(--tg-theme-secondary-bg-color, rgba(0, 0, 0, 0.05));
  padding: 3px;
  border-radius: 10px;
  margin-bottom: 14px;
  gap: 4px;
}

.subtab-btn {
  flex: 1;
  text-align: center;
  padding: 7px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #777);
  border-radius: 7px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.subtab-btn.active {
  background: var(--tg-theme-bg-color, #ffffff);
  color: var(--tg-theme-button-color, #2481cc);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
</style>
