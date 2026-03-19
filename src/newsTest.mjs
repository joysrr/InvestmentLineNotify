import "dotenv/config";
import {
  listAllModels,
  getNewsTelegramMessages,
} from "./providers/newsProvider.mjs";

//listAllModels();
const news = await getNewsTelegramMessages();
console.log(JSON.stringify(news));
