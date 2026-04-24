import fs from 'fs';

const filePath = 'src/modules/strategy/strategyEngine.mjs';
let content = fs.readFileSync(filePath, 'utf-8');

const layer2Old = /  \/\/ 🟡 Layer 2：預備金防禦 145–160% \(protectTrigger\)[\s\S]*?reserveSufficient,\n    \};\n  \}/;

if (layer2Old.test(content)) {
    content = content.replace(layer2Old, '');
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("Layer 2 removed.");
} else {
    console.error("Could not find Layer 2.");
}
