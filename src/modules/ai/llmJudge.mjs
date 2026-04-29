import { callAI, PROVIDERS, langfuse } from "./aiClient.mjs";
import { AIServiceError } from "../../utils/retryUtils.mjs";
import logger from "../../utils/logger.mjs";

// ── 觸發策略 ─────────────────────────────────────────────────────────────────

/**
 * 依 LLM_JUDGE_MODE 環境變數決定今天是否執行 Judge
 *
 * 支援三種模式：
 *   weekly  (預設) — 僅在 LLM_JUDGE_WEEKDAY 指定的星期幾執行 (0=日，1=一...6=六)
 *   random         — 依 LLM_JUDGE_SAMPLE_RATE 機率抽樣執行
 *   always         — 每次都執行，適合短期驗證
 *
 * @param {{ forceRun?: boolean }} [context={}] - 提供上下文，支援高風險日強制執行
 * @returns {boolean}
 */
export function shouldRunJudge(context = {}) {
  // ── 高風險強制觸發 ─────────────────────────────────────────────────────────
  if (context.forceRun === true) {
    logger.warn({ forceRun: true }, "LLMJudge 高風險日強制觸發");
    return true;
  }

  const mode = (process.env.LLM_JUDGE_MODE ?? "weekly").toLowerCase();

  if (mode === "always") return true;

  if (mode === "random") {
    const rate = parseFloat(process.env.LLM_JUDGE_SAMPLE_RATE ?? "0.2");
    return Math.random() < rate;
  }

  // 預設 weekly
  const targetDay = parseInt(process.env.LLM_JUDGE_WEEKDAY ?? "1", 10);
  const todayDay = new Date().getDay(); // 0=日，1=一 ...
  return todayDay === targetDay;
}

// ── Langfuse score 安全回寫 ───────────────────────────────────────────────────

async function safeLangfuseScore(payload) {
  try {
    await langfuse.score(payload);
  } catch (err) {
    logger.warn(
      { name: payload.name, error: err.message },
      "LLMJudge score 寫入失敗"
    );
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
    logger.warn(
      { adviceTraceId, hasAdviceObj: !!adviceObj },
      "LLMJudge adviceTraceId 或 adviceObj 無效，跳過 Judge"
    );
    return;
  }

  const judgeInput = JSON.stringify({
    action_items: adviceObj.action_items ?? [],
    risk_warnings: adviceObj.risk_warnings ?? [],
    mindset_advice: adviceObj.mindset_advice ?? [],
  });

  const tasks = [
    {
      promptName: "LLMJudge/JudgeActionability",
      scoreName: "Actionability",
      promptVariables: { coachOutputJson: judgeInput },
    },
    {
      promptName: "LLMJudge/JudgeToneAndEmpathy",
      scoreName: "Tone_and_Empathy",
      promptVariables: { coachOutputJson: judgeInput },
    },
  ];

  for (const { promptName, scoreName, promptVariables } of tasks) {
    try {
      logger.debug({ scoreName }, "LLMJudge 執行 Judge");

      const { text } = await callAI(promptName, {
        sessionId,
        provider: PROVIDERS.GEMINI,
        keyIndex: 2,
        promptVariables,
      });

      // schema 已保證結構，直接解析；score 型別由 Gemini 保證為 number
      const judgeResult = JSON.parse(text);
      const score = Number(judgeResult.score);

      if (!Number.isFinite(score) || score < 0 || score > 1) {
        logger.warn(
          { scoreName, score: judgeResult.score },
          "LLMJudge score 超出範圍"
        );
        continue;
      }

      await safeLangfuseScore({
        traceId: adviceTraceId,
        name: scoreName,
        value: score,
        comment: judgeResult.reason ?? "",
      });

      logger.info(
        { scoreName, score, reason: judgeResult.reason?.slice(0, 80) },
        "LLMJudge 評分完成"
      );
    } catch (err) {
      const errorMsg = err instanceof AIServiceError
        ? `AI Service Error (${err.provider}/${err.model}): ${err.message}`
        : `Unexpected Error: ${err.message}`;

      logger.warn({ scoreName, error: errorMsg }, "LLMJudge Judge 執行失敗");

      // 記錄錯誤至 Langfuse
      await safeLangfuseScore({
        traceId: adviceTraceId,
        name: scoreName,
        value: 0,
        comment: `Failed: ${err instanceof AIServiceError ? err.name : err.constructor.name}`,
      });
    }
  }
}
