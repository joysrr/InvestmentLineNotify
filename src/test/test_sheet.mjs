import "dotenv/config";
import { fetchLastPortfolioState } from "../src/modules/storage.mjs";
async function test() {
  const state = await fetchLastPortfolioState();
  console.log("State:", state);
}
test();
