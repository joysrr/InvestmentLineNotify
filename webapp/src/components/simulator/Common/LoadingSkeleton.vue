<template>
  <div class="loading-skeleton">
    <div class="skeleton-header">
      <div class="skeleton-bar w-75"></div>
      <div class="skeleton-bar w-25"></div>
    </div>
    <div class="skeleton-tabs">
      <div class="skeleton-bar w-33"></div>
      <div class="skeleton-bar w-33"></div>
    </div>
    <div class="skeleton-input">
      <div class="skeleton-bar"></div>
      <div class="skeleton-bar"></div>
      <div class="skeleton-bar"></div>
    </div>
    <div class="skeleton-buttons">
      <div class="skeleton-bar w-50"></div>
      <div class="skeleton-bar w-50"></div>
    </div>
    <div class="skeleton-result">
      <div class="skeleton-card">
        <div class="skeleton-bar w-100 h-12"></div>
        <div class="skeleton-bar w-100 h-8"></div>
        <div class="skeleton-bar w-75 h-6"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar w-100 h-8"></div>
        <div class="skeleton-bar w-66 h-6"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-bar w-100 h-10"></div>
        <div class="skeleton-bar w-50 h-6"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-skeleton {
  padding: 16px;
}

.skeleton-header {
  margin-bottom: 24px;
}

.skeleton-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.skeleton-input {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.skeleton-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.skeleton-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-card {
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
}

.skeleton-bar {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

.skeleton-bar.w-75 { width: 75%; }
.skeleton-bar.w-25 { width: 25%; }
.skeleton-bar.w-33 { width: 33.33%; }
.skeleton-bar.w-50 { width: 50%; }
.skeleton-bar.w-66 { width: 66.66%; }
.skeleton-bar.w-100 { width: 100%; }
.skeleton-bar.h-6 { height: 24px; }
.skeleton-bar.h-8 { height: 32px; }
.skeleton-bar.h-10 { height: 40px; }
.skeleton-bar.h-12 { height: 48px; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>