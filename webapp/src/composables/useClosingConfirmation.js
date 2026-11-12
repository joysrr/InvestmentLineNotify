import { useTelegram } from "./useTelegram.js";

export function useClosingConfirmation() {
  const { enableClosingConfirmation, disableClosingConfirmation } =
    useTelegram();

  return {
    enableClosingConfirmation,
    disableClosingConfirmation,
  };
}
