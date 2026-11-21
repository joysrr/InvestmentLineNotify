<template>
  <div
    v-if="isAuthExpired"
    class="auth-modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="auth-expired-title"
    data-testid="auth-expired-modal"
  >
    <div class="auth-modal-card">
      <div class="modal-icon" aria-hidden="true">
        <Icon name="warn" size="lg" color="var(--iln-viz-alert-text)" />
      </div>
      <h3 id="auth-expired-title" class="modal-title">登入憑證已過期</h3>
      <p class="modal-body">
        您在 Telegram Mini App 的操作憑證已超過安全時效（30 分鐘）。請點擊下方按鈕重新載入頁面以取得最新憑證。
      </p>
      <button
        type="button"
        class="modal-btn"
        @click="reloadPage"
        data-testid="btn-reload-page"
      >
        一鍵重新載入頁面
      </button>
    </div>
  </div>
</template>

<script setup>
import Icon from "@/components/common/Icon.vue";
import { useAuthExpired } from "../../composables/useAuthExpired.js";

const { isAuthExpired } = useAuthExpired();

const reloadPage = () => {
  window.location.reload();
};
</script>

<style scoped>
.auth-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: var(--iln-overlay-scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: var(--iln-space-5);
}

.auth-modal-card {
  background-color: var(--iln-bg);
  color: var(--iln-text);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-lg);
  padding: var(--iln-space-6);
  max-width: 320px;
  width: 100%;
  text-align: center;
  box-shadow: var(--iln-shadow-modal);
  animation: modal-pop var(--iln-duration-base, 250ms) cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modal-pop {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--iln-space-3);
}

.modal-title {
  font-size: var(--iln-font-lg);
  font-weight: 700;
  margin: 0 0 var(--iln-space-2);
  color: var(--iln-text);
}

.modal-body {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  line-height: 1.5;
  margin: 0 0 var(--iln-space-5);
}

.modal-btn {
  width: 100%;
  min-height: var(--iln-touch-min);
  padding: var(--iln-space-3);
  background-color: var(--iln-brand);
  color: var(--iln-text-on-brand);
  border: none;
  border-radius: var(--iln-radius-md);
  font-size: var(--iln-font-base);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.modal-btn:hover {
  opacity: 0.92;
}

.modal-btn:active {
  opacity: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .auth-modal-card,
  .modal-btn {
    animation: none;
    transition: none;
  }
}
</style>
