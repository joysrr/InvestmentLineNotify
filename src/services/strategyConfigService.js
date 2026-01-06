const fetch = require("node-fetch");
const { validateStrategyConfig } = require("./strategyConfigValidator");

const STRATEGY_URL = process.env.STRATEGY_URL;

let _cache = {
  url: null,
  strategy: null,
  loadedAt: null,
};

async function fetchStrategyConfig() {
  if (!STRATEGY_URL) {
    throw new Error("缺少 STRATEGY_URL 環境變數，無法載入 Strategy.json");
  }

  if (_cache.url === STRATEGY_URL && _cache.strategy) {
    return _cache.strategy;
  }

  try {
    const res = await fetch(STRATEGY_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 strategy-client",
        Accept: "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Strategy.json HTTP ${res.status}: ${text.slice(0, 200)}`,
      );
    }

    const json = JSON.parse(text);

    // ✅ 先驗證再寫入 cache
    validateStrategyConfig(json);

    _cache = {
      url: STRATEGY_URL,
      strategy: json,
      loadedAt: new Date(),
    };

    return json;
  } catch (err) {
    // 若遠端壞掉，但 cache 有舊的，仍可讓排程繼續跑
    if (_cache.strategy) return _cache.strategy;
    throw err;
  }
}

module.exports = { fetchStrategyConfig };
