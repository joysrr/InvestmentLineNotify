import "dotenv/config";
import { listAllModels } from "../modules/ai/aiClient.mjs";
import { getDailyQuote } from "../modules/providers/quoteProvider.mjs";
import { fetchUsMarketData } from "../modules/providers/usMarketProvider.mjs";
import { getRawNews } from "../modules/newsFetcher.mjs";

//listAllModels();

//getDailyQuote().then((quote) => {
//  console.log("今日名言：", quote);
//});

//fetchUsMarketData().then((data) => {
//  console.log("美股市場資料：", data);
//});

const aiResults = JSON.parse(`{"twQueries": [
      {
        "keyword": "外資 賣超",
        "searchType": "intitle"
      },
      {
        "keyword": "融資 斷頭",
        "searchType": "broad"
      },
      {
        "keyword": "台積電 支撐",
        "searchType": "intitle"
      },
      {
        "keyword": "避險資產 湧入",
        "searchType": "broad"
      },
      {
        "keyword": "台股 崩跌 原因",
        "searchType": "broad"
      },
      {
        "keyword": "國安基金 動向",
        "searchType": "intitle"
      }
    ],
    "usQueries": [
      {
        "keyword": "VIX spike causes",
        "searchType": "broad"
      },
      {
        "keyword": "Fed emergency meeting",
        "searchType": "intitle"
      },
      {
        "keyword": "Treasury yields volatility",
        "searchType": "broad"
      },
      {
        "keyword": "Nvidia stock correction",
        "searchType": "intitle"
      },
      {
        "keyword": "Systemic liquidity risk",
        "searchType": "broad"
      },
      {
        "keyword": "S&P 500 technical breakdown",
        "searchType": "intitle"
      }
]}`);

const rawNews = await getRawNews({
  twQueries: aiResults.twQueries,
  usQueries: aiResults.usQueries,
});
aiResults.twQueries.forEach((q, i) => {
  console.log(
    `台灣查詢 [${i}] 關鍵字: ${q.keyword} | 搜尋類型: ${q.searchType}`,
  );
});
aiResults.usQueries.forEach((q, i) => {
  console.log(
    `國際查詢 [${i}] 關鍵字: ${q.keyword} | 搜尋類型: ${q.searchType}`,
  );
});
rawNews.forEach((news, index) => {
  console.log(
    `最終新聞 [${index}] [${news._region}] 標題: ${news.title} | 來源: ${news.source}`,
  );
});
