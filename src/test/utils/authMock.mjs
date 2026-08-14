import crypto from "crypto";

/**
 * 產生合法的 Telegram WebApp initData (用於 Dogfood / 整合測試)
 *
 * @param {string} botToken - Telegram Bot Token (必須與伺服器端相同)
 * @param {Object} [userPayload] - 模擬的使用者資訊
 * @param {number} [authDate] - 認證時間 (預設為現在)
 * @returns {string} 可直接放入 `X-Telegram-Init-Data` header 的字串
 */
export function generateValidInitData(
  botToken,
  userPayload = {
    id: 12345678,
    first_name: "TestUser",
    last_name: "QA",
    username: "testuser_qa",
    language_code: "zh-hant",
  },
  authDate = Math.floor(Date.now() / 1000)
) {
  if (!botToken) {
    throw new Error("botToken is required to generate valid initData");
  }

  // 1. 建立參數集合 (不包含 hash)
  const params = new URLSearchParams();
  params.set("query_id", "AAG_w94XAAAAAP_D3hc_test"); // 隨機的 query_id
  params.set("user", JSON.stringify(userPayload));
  params.set("auth_date", authDate.toString());
  
  // (可選) 增加一些常見的 WebApp 參數
  params.set("chat_type", "private");
  params.set("chat_instance", "-1234567890123456789");

  // 2. 組成 data-check-string (字母排序，排除 hash)
  const dataCheckArr = [];
  for (const [key, value] of [...params.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join("\n");

  // 3. 導出 Secret Key: HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // 4. 計算 Hash: HMAC-SHA256(dataCheckString, secretKey)
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // 5. 加上 hash 組合出最終字串
  params.set("hash", expectedHash);

  return params.toString();
}
