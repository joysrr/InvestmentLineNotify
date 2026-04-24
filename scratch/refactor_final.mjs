import fs from 'fs';

const filePath = 'src/modules/strategy/strategyEngine.mjs';
let content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');
const rangesToDelete = [
    [41, 57], [59, 110], [112, 178], [180, 341], [343, 445], [447, 588],
    [1249, 1268], [1270, 1336], [1338, 1370]
];

rangesToDelete.sort((a, b) => b[0] - a[0]);

for (const [start, end] of rangesToDelete) {
    lines.splice(start - 1, end - start + 1);
}

content = lines.join('\n');

const aggregatedImports = `
import {
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
} from "./policies/index.mjs";
`;

content = content.replace('import { archiveManager } from "../data/archiveManager.mjs";', 'import { archiveManager } from "../data/archiveManager.mjs";\n' + aggregatedImports);

const marginOld = /  \/\/ 🔴 Layer 0：斷頭危機[\s\S]*?reserveSufficient,\n    \};\n  \}/;
const marginNew = `  const safeCtx = Object.freeze({ ...ctx });
  const marginLayerObj = evaluateMarginLayer(marginLayer, safeCtx, strategy, reserveStatus);
  if (marginLayerObj) return marginLayerObj;`;
content = content.replace(marginOld, marginNew);

const leverageOld = /  \/\/ Priority 2：Gross Leverage[\s\S]*?panicBypassActive: isPanicBypass,\n      \};\n    \}\n  \}/;
const leverageNew = `  const leverageObj = evaluateGrossLeverage(grossLeverageResult, strategy, ctx.panicBypassActive);
  if (leverageObj) return leverageObj;`;
content = content.replace(leverageOld, leverageNew);

const vgOld = /  \/\/ Priority 4：valuationGuard 估值守衛[\s\S]*?ctx\.trendConfirmation = trendConfirmation;\n    \}\n  \}/;
const vgNew = `  const vgCfg = strategy?.valuationGuard;
  const trendConfirmation = resolveTrendConfirmation(
    {
      closeArr: ctx.closeArr ?? [],
      ma20Arr: ctx.ma20Arr ?? [],
      atrArr: ctx.atrArr ?? [],
    },
    strategy,
  );
  if (vgCfg?.enabled && ctx.pbRecords != null && !ctx.panicBypassActive) {
    const currentPB = ctx.valuation?.pb ?? null;
    const pbRecords = ctx.pbRecords ?? [];
    const vgResult = resolveValuationGuard(currentPB, pbRecords, strategy);
    const vgEval = evaluateValuationGuard(ctx, strategy, trendConfirmation, vgResult, ma60Slope);
    if (vgEval) return vgEval;
  }`;
content = content.replace(vgOld, vgNew);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Final refactor and polish complete.");
