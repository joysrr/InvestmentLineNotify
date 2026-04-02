import { callAI, PROVIDERS, langfuse } from "./aiClient.mjs";

// ── 觸發策略 ─────────────────────────────────────────────────────────────────

/**
 * 依 LLM_JUDGE_MODE 環境變數決定今天是否執行 Judge
 *
 * 支援三種模式：
 *   weekly  (預設) — 僅在 LLM_JUDGE_WEEKDAY 指定的星期幾執行 (0=日, 1=一...6=六)
 *   random         — 依 LLM_JUDGE_SAMPLE_RATE 機率抽樣執行
 *   always         — 每次都執行，適合短期驗證
 *
 * @returns {boolean}
 */
export function shouldRunJudge() {
  const mode = (process.env.LLM_JUDGE_MODE ?? "weekly").toLowerCase();

  if (mode === "always") return true;

  if (mode === "random") {
    const rate = parseFloat(process.env.LLM_JUDGE_SAMPLE_RATE ?? "0.2");
    return Math.random() < rate;
  }

  // 預設 weekly
  const targetDay = parseInt(process.env.LLM_JUDGE_WEEKDAY ?? "1", 10);
  const todayDay = new Date().getDay(); // 0=日, 1=一 ...
  return todayDay === targetDay;
}

// ── Langfuse score 安全回寫 ───────────────────────────────────────────────────

async function safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    console.warn(`⚠️ [LLMJudge] score 寫入失敗 (${payload.name}):`, err.message);
  }
}

// ── Judge 執行核心 ────────────────────────────────────────────────────────────

/**
 * 對單一 InvestmentAdvice 結果執行 LLM Judge 評分
 * 評估 Actionability 與 Tone_and_Empathy 兩項分數
 *
 * @param {string} adviceTraceId - InvestmentAdvice 的 Langfuse traceId
 * @param {object} adviceObj     - getAiInvestmentAdvice 回傳的建議物件
 * @param {string} sessionId     - 本次執行的 sessionId
 */
export async function runJudge(adviceTraceId, adviceObj, sessionId) {
  if (!adviceTraceId || !adviceObj || typeof adviceObj !== "object") {
    console.warn("⚠️ [LLMJudge] adviceTraceId 或 adviceObj 無效，跳過 Judge");
    return;
  }

  const judgeInput = JSON.stringify({
    action_items: adviceObj.action_items ?? [],
    risk_warnings: adviceObj.risk_warnings ?? [],
    mindset_advice: adviceObj.mindset_advice ?? [],
  });

  const tasks = [
    {
      promptName: "JudgeActionability",
      scoreName: "Actionability",
    },
    {
      promptName: "JudgeToneAndEmpathy",
      scoreName: "Tone_and_Empathy",
    },
  ];

  for (const { promptName, scoreName } of tasks) {
    try {
      console.log(`🔍 [LLMJudge] 執行 ${scoreName} Judge...`);

      const { text } = await callAI(promptName, judgeInput, {
        sessionId,
        provider: PROVIDERS.GEMINI,
        keyIndex: 2,
      });

      // Judge prompt 預期回傳 { score: number (0~1), reason: string }
      const judgeResult = JSON.parse(text);
      const score = Number(judgeResult.score);

      if (!Number.isFinite(score) || score < 0 || score > 1) {
        console.warn(
          `⚠️ [LLMJudge] ${scoreName} 回傳的 score 無效: ${judgeResult.score}`,
        );
        continue;
      }

      await safeLangfuseScore({
        traceId: adviceTraceId,
        name: scoreName,
        value: score,
        comment: judgeResult.reason ?? "",
      });

      console.log(
        `✅ [LLMJudge] ${scoreName} = ${score.toFixed(2)}` +
          (judgeResult.reason ? ` | ${judgeResult.reason.slice(0, 80)}` : ""),
      );
    } catch (err) {
      console.warn(`⚠️ [LLMJudge] ${scoreName} Judge 執行失敗:`, err.message);
    }
  }
}
