import { analyzeMarginRisk, analyzeCapitalDecoupling } from "../src/modules/strategy/marginManager.mjs";

const mockPortfolio = {
  qty0050: 10000,
  qtyZ2: 5000,
  totalLoan: 1000000,
  cash: 50000
};

const mockPrices = {
  price0050: 150,
  priceZ2: 80
};

const mockStrategy = {
  maintenance: {
    marginCallThreshold: 135,
    protectTarget: 160
  }
};

console.log("=== Margin Analysis ===");
const marginRisk = analyzeMarginRisk(mockPortfolio, mockPrices.price0050, mockStrategy);
console.log(JSON.stringify(marginRisk, null, 2));

console.log("\n=== Decoupling Analysis ===");
const decoupling = analyzeCapitalDecoupling(mockPortfolio, mockPrices);
console.log(JSON.stringify(decoupling, null, 2));
