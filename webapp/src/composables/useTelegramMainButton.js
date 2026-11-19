import { useTelegram } from "./useTelegram.js";

/**
 * Telegram WebApp MainButton 抽象。
 * 在非 Telegram 環境（dev browser）中所有方法皆為 no-op，不會拋錯。
 *
 * 回傳：
 *   show(params)   - 顯示 MainButton，可設 text / color / textColor / isActive / progress
 *   hide()         - 隱藏 MainButton
 *   onClick(handler)  - 註冊點擊事件（多次註冊會累加，需自行 offClick）
 *   offClick(handler) - 移除點擊事件
 *   setParams(params) - 設定 MainButton 參數
 *   mainButton      - 原始 MainButton 物件（非 Telegram 環境為 undefined）
 */
export function useTelegramMainButton() {
  const { tg } = useTelegram();
  const mainButton = tg?.MainButton;

  const show = (params = {}) => {
    const { text, color, textColor, isActive, progress } = params;
    try {
      if (text !== undefined) mainButton?.setText(text);
      if (color !== undefined) mainButton?.setColor?.(color);
      if (textColor !== undefined) mainButton?.setTextColor?.(textColor);
      if (isActive !== undefined) {
        if (isActive) mainButton?.show();
        else mainButton?.hide();
      }
      if (progress !== undefined) {
        // Telegram SDK 不直接支援 progress 開關，僅記錄於 visible 狀態下無動作
        void progress;
      }
      if (text || color || textColor || isActive) {
        mainButton?.show();
      }
    } catch (_e) {
      void _e;
    }
  };

  const hide = () => {
    try {
      mainButton?.hide();
    } catch (_e) {
      void _e;
    }
  };

  const onClick = (handler) => {
    try {
      mainButton?.onClick?.(handler);
    } catch (_e) {
      void _e;
    }
  };

  const offClick = (handler) => {
    try {
      mainButton?.offClick?.(handler);
    } catch (_e) {
      void _e;
    }
  };

  const setParams = (params = {}) => {
    try {
      mainButton?.setParams?.(params);
    } catch (_e) {
      void _e;
    }
  };

  return { show, hide, onClick, offClick, setParams, mainButton };
}
