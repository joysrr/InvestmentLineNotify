/**
 * Mock Notifier Factory
 * 建立符合 INotifier 介面的 Mock 物件
 */

import { vi } from "vitest";

/**
 * 建立 Mock Notifier
 * @param overrides 覆蓋預設行為的物件
 * @returns 符合 INotifier 介面的 Mock 物件
 */
export function createMockNotifier(overrides = {}) {
  return {
    // Telegram 基礎發送
    sendTelegramBatch: vi.fn().mockResolvedValue(undefined),
    sendTelegramMessage: vi.fn().mockResolvedValue(undefined),

    // Daily Report
    broadcastDailyReport: vi.fn().mockResolvedValue(undefined),

    // Optimizer
    broadcastOptimizerResult: vi.fn().mockResolvedValue(undefined),

    // Period Reports
    sendPeriodReport: vi.fn().mockResolvedValue(undefined),

    // 允許覆蓋特定方法
    ...overrides,
  };
}
