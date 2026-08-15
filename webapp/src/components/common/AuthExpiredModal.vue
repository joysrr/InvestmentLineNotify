<template>
  <div v-if="isAuthExpired" class="auth-modal-overlay" data-testid="auth-expired-modal">
    <div class="auth-modal-card">
      <div class="modal-icon">🔐</div>
      <h3 class="modal-title">登入憑證已過期</h3>
      <p class="modal-body">
        您在 Telegram Mini App 的操作憑證已超過安全時效（30 分鐘）。請點擊下方按鈕重新載入頁面以取得最新憑證。
      </p>
      <button class="modal-btn" @click="reloadPage" data-testid="btn-reload-page">
        一鍵重新載入頁面
      </button>
    </div>
  </div>
</template>

<script setup>
import { useAuthExpired } from "../../composables/useAuthExpired.js";

const { isAuthExpired } = useAuthExpired();

const reloadPage = () => {
  window.location.reload();
};
</script>

<style scoped>
.auth-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  padding: 20px;
}

.auth-modal-card {
  background-color: var(--tg-theme-bg-color, #ffffff);
  color: var(--tg-theme-text-color, #222222);
  border-radius: 16px;
  padding: 24px;
  max-width: 320px;
  width: 100%;
  text-align: center;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  animation: modal-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modal-pop {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.modal-body {
  font-size: 14px;
  color: var(--tg-theme-hint-color, #666666);
  line-height: 1.5;
  margin-bottom: 20px;
}

.modal-btn {
  width: 100%;
  padding: 12px;
  background-color: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #ffffff);
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.modal-btn:active {
  opacity: 0.8;
}
</style>
