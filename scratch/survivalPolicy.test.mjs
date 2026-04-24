import assert from "node:assert";
import { analyzeSurvival } from "../src/modules/strategy/policies/survivalPolicy.mjs";

console.log("🧪 Running Survival Policy Tests...");

// Test Case 1: Healthy position
{
  const portfolio = { qty0050: 100000, totalLoan: 5000000 }; // 0050 value at 100 = 10,000,000. Margin = 200%
  const strategy = { maintenance: { marginCallThreshold: 135, protectTarget: 160 } };
  const result = analyzeSurvival(portfolio, 100, strategy);

  assert.strictEqual(result.currentMargin, 200);
  assert.strictEqual(result.survivalDropLimit, 32.5); // (10M - 1.35 * 5M) / 10M = (10 - 6.75) / 10 = 32.5%
  assert.strictEqual(result.refillRequirement, 0);
  assert.strictEqual(result.isVulnerable, false);
  console.log("✅ Healthy position test passed");
}

// Test Case 2: Vulnerable position (below 160%)
{
  const portfolio = { qty0050: 100000, totalLoan: 7000000 }; // 10M value. Margin = 142.8%
  const strategy = { maintenance: { marginCallThreshold: 135, protectTarget: 160 } };
  const result = analyzeSurvival(portfolio, 100, strategy);

  assert.strictEqual(result.currentMargin, 142.9);
  // Refill to 160%: TargetCollateral = 1.6 * 7M = 11.2M. Current = 10M. Requirement = 1.2M
  assert.strictEqual(result.refillRequirement, 1200000);
  assert.strictEqual(result.isVulnerable, true);
  console.log("✅ Vulnerable position test passed");
}

console.log("🎉 All Survival Policy tests passed!");
