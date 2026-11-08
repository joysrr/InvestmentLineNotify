import { loadStateFromLatestFiles } from "../../domain/ilnState.mjs";
import { archiveManager } from "../../modules/data/archiveManager.mjs";

/**
 * GET /api/status
 * 使用 IlnState 載入最新狀態，回傳 data/market/latest.json 結構。
 * 若 market + report 都不存在則回 404。
 */
export default async function statusRoute(fastify) {
  fastify.get("/status", async (_request, reply) => {
    try {
      const state = await loadStateFromLatestFiles();

      if (!state) {
        return reply
          .code(404)
          .send({ error: "Market status data not available yet" });
      }

      const payload = state.toStatusPayload();

      // 計算全市場融資 5 日增減百分比
      const rawMargin = payload?.data?.rawMargin;
      if (rawMargin?.marginBalance100M != null) {
        const history = await archiveManager.getMarketHistory();
        // 提取有 marginBalance100M 的記錄，按日期降序（最新在前）
        const marginRecords = history
          .filter((h) => h.data?.rawMargin?.marginBalance100M != null)
          .map((h) => ({
            date: h.date,
            balance: h.data.rawMargin.marginBalance100M,
          }))
          .sort((a, b) => b.date.localeCompare(a.date));

        // 去重相同餘額（休市日數據與前一日相同），保留每個餘額最新的日期
        const uniqueBalances = [];
        const seenBalances = new Set();
        for (const rec of marginRecords) {
          if (!seenBalances.has(rec.balance)) {
            seenBalances.add(rec.balance);
            uniqueBalances.push(rec);
          }
        }

        // 需要至少 6 個唯一餘額（當前 + 5 個交易日前）才能計算 5 日增減
        // 若不足，則使用最早可用唯一餘額作為基準（退化情況）
        if (uniqueBalances.length >= 2) {
          const baseIndex = Math.min(5, uniqueBalances.length - 1);
          const baseBalance = uniqueBalances[baseIndex].balance;
          const currentBalance = rawMargin.marginBalance100M;
          rawMargin.marginBalanceChangePercent5d =
            ((currentBalance - baseBalance) / baseBalance) * 100;
        } else {
          rawMargin.marginBalanceChangePercent5d = null;
        }
      }

      return reply.send(payload);
    } catch (err) {
      fastify.log.error({ err }, "Failed to load market status via IlnState");
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
