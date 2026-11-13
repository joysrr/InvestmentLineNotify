<template>
  <div class="iln-tabs-primary" role="tablist" aria-label="市場分析標籤頁">
    <router-link
      to="/radar"
      class="iln-tab"
      active-class="is-active"
      role="tab"
      aria-selected="false"
    >      <Icon name="neutral" size="sm" color="var(--iln-hint)" /> 市場雷達
    </router-link>
    <router-link
      to="/macro"
      class="iln-tab"
      active-class="is-active"
      role="tab"
      aria-selected="false"
    >      <Icon name="neutral" size="sm" color="var(--iln-hint)" /> 多空對決
    </router-link>
    <router-link
      to="/technical"
      class="iln-tab"
      active-class="is-active"
      role="tab"
      aria-selected="false"
    >      <Icon name="chart" size="sm" color="var(--iln-text)" /> 技術指標
    </router-link>
  </div>
</template>

<script setup>
// 純展示組件，透過 router-link 自動處理 active class
// 樣式採全域 design tokens (webapp/src/styles/tokens.css .iln-tabs-primary / .iln-tab)
</script>

<style scoped>
/* 刻意保留空：樣式由 tokens.css 全域 .iln-tabs-primary / .iln-tab 統一提供 */
</style>
