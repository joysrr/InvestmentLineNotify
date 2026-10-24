import { loadReplayEvidenceList } from "../../modules/replay/replayEvidenceLoader.mjs";

export async function handleReplay(ctx) {
  try {
    const evidenceList = await loadReplayEvidenceList();

    if (evidenceList.length === 0) {
      await ctx.reply(
        "📭 目前尚無 replay evidence 記錄\n\n" +
          "Replay evidence 會在執行 replay 時自動產生。",
      );
      return;
    }

    const lines = ["🔄 *Replay Evidence 記錄*\n"];

    for (const evidence of evidenceList) {
      const matchIcon = evidence.replayMatches ? "✅" : "⚠️";
      const shortHash = truncateHash(evidence.strategyHash);
      const dataDate = extractDataDate(evidence.dataAsOf);

      lines.push(`*${evidence.replayDate}* ${matchIcon}`);
      lines.push(`  來源: ${evidence.fixtureSource}`);
      lines.push(`  資料: ${dataDate}`);
      lines.push(`  策略: \`${shortHash}\``);
      lines.push(`  狀態: ${evidence.status}`);
      lines.push("");
    }

    lines.push(`_共 ${evidenceList.length} 筆記錄_`);

    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.reply(
      "❌ 載入 replay evidence 時發生錯誤\n\n" + "請聯絡系統管理員或稍後再試。",
    );
  }
}

function truncateHash(hash) {
  if (!hash) return "N/A";
  // Remove sha256: prefix if present, take first 12 chars
  const cleaned = hash.replace(/^sha256:/, "");
  return cleaned.substring(0, 12);
}

function extractDataDate(dataAsOf) {
  if (!dataAsOf) return "N/A";
  if (typeof dataAsOf === "string") return dataAsOf;
  if (dataAsOf.market?.latestDate) return dataAsOf.market.latestDate;
  return "N/A";
}
