/**
 * 全局 Auth 過期通知與 Modal 管理 Composable
 */
import { ref } from "vue";

const isAuthExpired = ref(false);

export function triggerAuthExpired() {
  isAuthExpired.value = true;
}

export function resetAuthExpired() {
  isAuthExpired.value = false;
}

export function useAuthExpired() {
  return {
    isAuthExpired,
    triggerAuthExpired,
    resetAuthExpired,
  };
}
