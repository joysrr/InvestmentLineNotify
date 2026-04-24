import fs from 'fs';

const filePath = 'src/modules/strategy/strategyEngine.mjs';
let content = fs.readFileSync(filePath, 'utf-8');

const start = 'import { getMarginLayer, evaluateMarginLayer } from "./core/marginStateMachine.mjs";';
const end = 'import { buildSellBackToAllocation } from "./policies/rebalancePolicy.mjs";';

const startIndex = content.indexOf(start);
const endIndex = content.indexOf(end) + end.length;

if (startIndex !== -1 && endIndex !== -1) {
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
    content = content.slice(0, startIndex) + newImports + content.slice(endIndex);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("Imports updated.");
} else {
    console.error("Could not find import block.");
}
