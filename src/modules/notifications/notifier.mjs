import { buildTelegramMessages } from "./templates/telegramHtmlBuilder.mjs";
import {
  unpinAllChatMessages,
  sendTelegramBatch,
  sendSystemMessage,
} from "./transports/telegramClient.mjs";

/**
 * 終極對外介面：廣播戰報到所有支援的平台
 */
export async function broadcastDailyReport(
  data,
  newsMessages = [],
  isTelegramEnabled,
) {
  const tasks = [];

  // 組裝並發送 Telegram
  if (isTelegramEnabled && process.env.TELEGRAM_API_TOKEN) {
    let tgMsgs = buildTelegramMessages(data);
    if (newsMessages.length) {
      tgMsgs = tgMsgs.concat(newsMessages);
    }

    tasks.push(
      unpinAllChatMessages()
        .then(() => sendTelegramBatch(tgMsgs))
        .then(() => console.log("✅ Telegram 戰報發送成功"))
        .catch((e) => console.error("❌ Telegram 發送失敗", e)),
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * 廣播 Optimizer 執行結果至 Log 頻道（靜默通知）
 *
 * 僅在有新規則通過時才發送，無新規則時靜默略過。
 * 使用 TELEGRAM_LOG_API_TOKEN 發送至系統訊息頻道。
 *
 * @param {{ tw: { accepted, rejected }, us: { accepted, rejected } }} result
 * @param {number} totalRuleCount - 執行後 blacklist 的總規則數
 */
export async function broadcastOptimizerResult(result, totalRuleCount) {
  const twA = result?.tw?.accepted ?? [];
  const twR = result?.tw?.rejected ?? [];
  const usA = result?.us?.accepted ?? [];
  const usR = result?.us?.rejected ?? [];

  // 無新規則時靜默略過
  if (twA.length + usA.length === 0) {
    console.log("[OptimizerNotify] 本次無新增規則，跳過通知");
    return;
  }

  const dateStr = new Date().toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  /**
   * 格式化單一區域（TW / US）的規則摘要
   * 最多顯示 5 條 pattern，超過則附加「…等 N 條」
   */
  function formatRegion(flag, label, accepted, rejected) {
    const lines = [`${flag} ${label}規則：`];
    lines.push(`  ✅ 新增 ${accepted.length} 條`);
    if (accepted.length > 0) {
      const MAX_SHOW = 5;
      const shown = accepted.slice(0, MAX_SHOW);
      shown.forEach((r) => lines.push(`  └ <code>${escapeHtml(r.regexLiteral)}</code>`));
      if (accepted.length > MAX_SHOW) {
        lines.push(`  └ …等 ${accepted.length - MAX_SHOW} 條`);
      }
    }
    lines.push(`  ❌ 拒絕 ${rejected.length} 條`);
    return lines.join("\n");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const twSection = formatRegion("🇹🇼", "台股", twA, twR);
  const usSection = formatRegion("🇺🇸", "美股", usA, usR);
  const totalLine = totalRuleCount != null
    ? `\n📊 累計黑名單規則總數：${totalRuleCount} 條`
    : "";

  const text = [
    "🤖 <b>Blacklist Optimizer 執行完成</b>",
    "",
    `📅 ${dateStr}`,
    "",
    twSection,
    "",
    usSection,
    totalLine,
  ].join("\n");

  try {
    await sendSystemMessage(text);
  } catch (err) {
    console.warn("[OptimizerNotify] 發送失敗（不影響主流程）:", err.message);
  }
}
