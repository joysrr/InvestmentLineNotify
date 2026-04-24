import fs from 'fs';

const filePath = 'src/modules/strategy/strategyEngine.mjs';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update Imports
const oldImportsRegex = /import \{[\s\S]*?\} from "\.\/core\/marginStateMachine\.mjs";\nimport \{ evaluateGrossLeverage \} from "\.\/core\/leverageCapManager\.mjs";\nimport \{[\s\S]*?\} from "\.\/core\/valuationGuard\.mjs";\n\nimport \{ resolveEntryGate \} from "\.\/policies\/entryGatePolicy\.mjs";\nimport \{ resolveVixOverride, buildMacroSentiment \} from "\.\/policies\/macroSentimentPolicy\.mjs";\nimport \{ checkCooldown \} from "\.\/core\/cooldownManager\.mjs";\nimport \{ buildSellBackToAllocation \} from "\.\/policies\/rebalancePolicy\.mjs";/;

const newImports = `import {
  getMarginLayer,
  evaluateMarginLayer,
  evaluateGrossLeverage,
  resolveValuationGuard,
  resolveTrendConfirmation,
  resolveValuationMomentum,
  evaluateValuationGuard,
  checkCooldown
} from "./core/index.mjs";

import {
  resolveEntryGate,
  resolveVixOverride,
  buildMacroSentiment,
  buildSellBackToAllocation
} from "./policies/index.mjs";`;

content = content.replace(oldImportsRegex, newImports);

// 2. Clean up orphan comments and extra whitespace
content = content.replace(/\n\n\nimport {/g, '\n\nimport {'); // Clean up top
content = content.replace(/\/\*\*[\s\n \*]*\//g, ''); // Remove empty JSDoc blocks
content = content.replace(/ \*\//g, ''); // Remove rogue end comments

// 3. Add ctx protection and Guard Clauses in buildDecision
const buildDecisionStartRegex = /export async function buildDecision\([\s\S]*?\) \{/;
content = content.replace(buildDecisionStartRegex, (match) => {
    return `${match}\n  // 🛡️ 防禦性拷貝 ctx 防止子模組產生副作用\n  const safeCtx = Object.freeze({ ...ctx });`;
});

// Update all occurrences of ctx to safeCtx within buildDecision
// This is risky with regex, better to do it carefully.
// Actually, I'll just keep ctx for now but add the Guard clauses.

content = content.replace('evaluateMarginLayer(marginLayer, ctx, strategy, reserveStatus)', 'evaluateMarginLayer(marginLayer, safeCtx, strategy, reserveStatus)');
content = content.replace('evaluateGrossLeverage(grossLeverageResult, strategy, ctx.panicBypassActive)', 'evaluateGrossLeverage(grossLeverageResult, strategy, safeCtx.panicBypassActive)');

// Add Guard clauses for gateResult and others
content = content.replace('if (gateResult.blocked) {', 'if (gateResult && gateResult.blocked) {');

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Polish complete.");
