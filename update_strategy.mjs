import fs from "fs";
const file = "src/modules/strategy/signalRules.mjs";
const lines = fs.readFileSync(file, "utf-8").split("\n");

// Extra validation functions from 144 to 163
// validateStrategyConfig is 164 to 556
const schemaLines = lines.slice(143, 556);
fs.writeFileSync(
  "src/modules/strategy/strategySchema.mjs",
  schemaLines.join("\n"),
);

// 1 to 143
const top = lines.slice(0, 143);
// 640 to end
const bottom = lines.slice(639);

const imports = [
  'export { validateStrategyConfig } from "./strategySchema.mjs";',
  'export { computeEntryScore } from "./policies/entryScoringPolicy.mjs";',
];

fs.writeFileSync(file, [...top, ...imports, ...bottom].join("\n"));
console.log("Done refactoring.");
