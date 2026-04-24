import fs from 'fs';

const filePath = 'src/modules/strategy/strategyEngine.mjs';
let content = fs.readFileSync(filePath, 'utf-8');

// Identify the entire margin machine block from Layer 0 to Layer 2
const marginOld = /  \/\/ 🔴 Layer 0：斷頭危機[\s\S]*?允許 0050 baseline DCA 維持`,\n      maintenanceMargin,\n      protectTrigger: maint.protectTrigger,\n      protectTarget,\n      reserveStatus,\n      needAmount,\n      reserveSufficient,\n    \};\n  \}/;

const marginNew = `  const safeCtx = Object.freeze({ ...ctx });
  const marginLayerObj = evaluateMarginLayer(marginLayer, safeCtx, strategy, reserveStatus);
  if (marginLayerObj) return marginLayerObj;`;

if (marginOld.test(content)) {
    content = content.replace(marginOld, marginNew);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("Margin logic fully refactored.");
} else {
    console.error("Could not find full margin logic block.");
}
