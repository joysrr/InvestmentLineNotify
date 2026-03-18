import { getNewsTelegramMessages } from "./providers/newsProvider.mjs";

const news = await getNewsTelegramMessages();
console.log(JSON.stringify(news));