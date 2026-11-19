import { computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTelegramMainButton } from "./useTelegramMainButton.js";
import { useTelegram } from "./useTelegram.js";

/**
 * 智慧 MainButton 控制器。
 * 依目前路由自動顯示對應文字與導向目標，點擊時給予輕微觸覺回饋。
 * 在非 Telegram 環境（dev browser）中所有操作皆為 no-op，不會拋錯。
 *
 * 各頁面預設配置（PAGE_CONFIGS）：
 *   - /dashboard   → 「查看報表」   → /insights?tab=radar
 *   - /insights    → 「查看雷達」    → /insights?tab=radar
 *   - /chart       → 「分析圖表」    → /chart
 *   - /account     → 「帳戶設定」    → /account
 *
 * 使用方式（在頁面 setup 呼叫即可自行掛載/卸載）：
 *   const { config } = useSmartMainButton();
 */
const PAGE_CONFIGS = {
  "/dashboard": {
    text: "查看報表",
    to: "/insights?tab=radar",
    aria: "開啟完整市場洞察頁面",
  },
  "/insights": {
    text: "查看雷達",
    to: "/insights?tab=radar",
    aria: "開啟市場雷達",
  },
  "/chart": {
    text: "分析圖表",
    to: "/chart",
    aria: "開啟技術圖表",
  },
  "/account": {
    text: "帳戶設定",
    to: "/account",
    aria: "開啟帳戶頁面",
  },
};

export function useSmartMainButton() {
  const route = useRoute();
  const router = useRouter();
  const { show, hide, onClick, offClick } = useTelegramMainButton();
  const { haptic } = useTelegram();

  const config = computed(() => {
    const key = Object.keys(PAGE_CONFIGS).find((path) =>
      route.path.startsWith(path),
    );
    return PAGE_CONFIGS[key ?? "/dashboard"];
  });

  const handler = () => {
    haptic("light");
    router.push(config.value.to);
  };

  onMounted(() => {
    show(config.value);
    onClick(handler);
  });

  // 路由切換時同步更新 MainButton 文字並重新顯示
  watch(
    () => route.path,
    () => {
      show(config.value);
    },
  );

  onUnmounted(() => {
    hide();
    offClick(handler);
  });

  return { config };
}
