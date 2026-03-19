const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

// ============================================================================
// 主推播函式
// ============================================================================

export async function pushLine(input, { to = process.env.USER_ID } = {}) {
  const token = process.env.LINE_ACCESS_TOKEN;

  if (!token || !to) {
    console.warn("缺少 LINE_ACCESS_TOKEN 或 USER_ID/to，跳過推播");
    return { ok: false, skipped: true };
  }

  const messages =
    typeof input === "string"
      ? [{ type: "text", text: input }]
      : toArray(input);

  if (!Array.isArray(messages) || messages.length === 0) {
    console.warn("messages 為空，跳過推播");
    return { ok: false, skipped: true };
  }

  // push messages 常見上限 5
  if (messages.length > 5) {
    throw new Error(`LINE push messages 超過上限(5)：目前=${messages.length}`);
  }

  try {
    const res = await axios.post(
      LINE_PUSH_URL,
      { to, messages },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 20_000,
      },
    );
    return { ok: true, status: res.status };
  } catch (error) {
    console.error("LINE push failed", {
      status: error?.response?.status,
      message: error?.response?.data?.message,
      details: JSON.stringify(error?.response?.data?.details),
      requestId: error?.response?.headers?.["x-line-request-id"],
    });
    throw error;
  }
}
