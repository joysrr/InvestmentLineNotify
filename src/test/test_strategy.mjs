import { fetchStrategyConfigUnified } from "../src/modules/strategy/strategyLoader.mjs";

(async () => {
  try {
    const strategy = await fetchStrategyConfigUnified();
    console.log("Strategy loaded successfully! Version:", strategy.version);
  } catch (err) {
    console.error("Strategy load error:", err);
  }
})();
