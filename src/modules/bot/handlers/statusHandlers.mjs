import { readFile } from "fs/promises";
import { join } from "path";
import { InlineKeyboard } from "grammy";

// latest.json 結構：{ _meta: { lastRun, sources }, data: { rawCnn, rawUsMarket, rawNdc, rawMargin, rawFx, rawValuation } }
export async function handleStatus(ctx, MINI_APP_URL) {
  const latestPath = join(process.cwd(), "data", "market", "latest.json");

  try {
    const raw = await readFile(latestPath, "utf-8");
    const parsed = JSON.parse(raw);
    const meta = parsed._meta ?? {};
    const d = parsed.data ?? {};

    const lines = ["📊 <b>最新市場快取</b>", ""];

    // 快取時間
    if (meta.lastRun) {
      const t = new Date(meta.lastRun).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
      });
      lines.push(`🕒 更新時間：<code>${t}</code>`);
      lines.push("");
    }

    // 大盤估值 PB / PE
    const valuation = d.rawValuation;
    if (valuation?.pb != null) lines.push(`📐 大盤 PB：<b>${valuation.pb}</b>`);
    if (valuation?.per != null)
      lines.push(`📐 大盤 PE：<b>${valuation.per}</b>`);

    // 美股：VIX、SPX 漲跌
    const us = d.rawUsMarket;
    if (us?.vix != null) lines.push(`🟡 VIX：<b>${us.vix}</b>`);
    if (us?.spxChg != null) lines.push(`🇺🇸 SPX 漲跌：<b>${us.spxChg}</b>`);

    // CNN 恐慌貪婪
    const cnn = d.rawCnn;
    if (cnn?.score != null)
      lines.push(
        `🟢 Fear &amp; Greed：<b>${cnn.score}</b>（${cnn.rating ?? ""}）`,
      );

    // 景氣燈號
    const ndc = d.rawNdc;
    if (ndc?.light != null) lines.push(`🚦 景氣燈號：<b>${ndc.light}</b>`);

    // 匯率
    const fx = d.rawFx;
    if (fx?.currentRate != null)
      lines.push(`💱 USD/TWD：<b>${fx.currentRate}</b>`);

    // 融資餘額與維持率
    const margin = d.rawMargin;
    if (margin?.marginBalance100M != null)
      lines.push(`📈 融資餘額：<b>${margin.marginBalance100M} 億</b>`);
    if (margin?.maintenanceRatio != null)
      lines.push(`🛡 維持率：<b>${margin.maintenanceRatio}%</b>`);

    if (lines.length <= 2) {
      lines.push("⚠️ 快取資料為空，請先執行 /daily 建立市場資料。");
    }

    const replyMarkup = MINI_APP_URL
      ? new InlineKeyboard().webApp("📊 開啟儀表板", MINI_APP_URL)
      : undefined;

    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      await ctx.reply("⚠️ 尚無市場快取資料，請先執行 /daily 。");
    } else {
      await ctx.reply(`❌ 讀取市場快取失敗：<code>${err.message}</code>`, {
        parse_mode: "HTML",
      });
    }
  }
}

export async function handleStatusDebug(ctx) {
  const latestPath = join(process.cwd(), "data", "market", "latest.json");

  try {
    const raw = await readFile(latestPath, "utf-8");
    const parsed = JSON.parse(raw);
    const meta = parsed._meta ?? {};
    const sources = meta.sources ?? {};
    const lastRun = meta.lastRun
      ? new Date(meta.lastRun).toLocaleString("zh-TW", {
          timeZone: "Asia/Taipei",
        })
      : "未知";

    const now = new Date();

    const lines = [
      "🛠 <b>資料來源 Debug</b>",
      "",
      `🕒 最後整體執行時間：<code>${lastRun}</code>`,
      "",
      "<b>各 Provider 狀態：</b>",
    ];

    const formatTs = (iso) =>
      iso
        ? new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
        : "無紀錄";

    const entries = Object.entries(sources);
    if (entries.length === 0) {
      lines.push("（尚無任何 provider metadata，可能尚未完整跑過 dailyCheck）");
    } else {
      for (const [key, info] of entries) {
        const status = info.status || "UNKNOWN";
        const lastFetch = formatTs(info.lastFetch);
        const error = info.error
          ? `\n  └ Error: <code>${info.error}</code>`
          : "";

        let staleHint = "";
        if (info.lastFetch) {
          const diffHours = (now - new Date(info.lastFetch)) / (1000 * 60 * 60);
          if (diffHours > 48) {
            staleHint = " ⚠️ 疑似過舊(>48h)";
          }
        }

        lines.push(
          `• <code>${key}</code> — <b>${status}</b>${staleHint}\n  └ lastFetch: <code>${lastFetch}</code>${error}`,
        );
      }
    }

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
  } catch (err) {
    if (err.code === "ENOENT") {
      await ctx.reply("⚠️ 尚無市場快取資料，請先執行 /daily 。");
    } else {
      await ctx.reply(`❌ 讀取 Debug 資訊失敗：<code>${err.message}</code>`, {
        parse_mode: "HTML",
      });
    }
  }
}
