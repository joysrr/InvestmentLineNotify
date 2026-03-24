import "dotenv/config";
import { listAllModels } from "../modules/ai/aiClient.mjs";
import { getDailyQuote } from "../modules/providers/quoteProvider.mjs";
import { fetchUsMarketData } from "../modules/providers/usMarketProvider.mjs";
listAllModels();
/*
getDailyQuote().then((quote) => {
  console.log("今日名言：", quote);
});
fetchUsMarketData().then((data) => {
  console.log("美股市場資料：", data);
});
*/
