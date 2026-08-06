import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const webappRoot = path.resolve(projectRoot, "webapp");

console.log("🚀 開始執行 InvestmentLineNotify 全能交付前安全驗證...\n");

function runCommand(command, cwd, name) {
  console.log(`[驗證中] 正在執行 ${name}...`);
  try {
    execSync(command, { cwd, stdio: "inherit" });
    console.log(
      `\n✅ ${name} 驗證成功！\n----------------------------------------`,
    );
    return true;
  } catch (error) {
    console.error(`\n❌ ${name} 驗證失敗！請檢查上述錯誤資訊。`);
    return false;
  }
}

// 1. 後端測試
const backendOk = runCommand(
  "npm run test",
  projectRoot,
  "後端 400 個單元與整合測試",
);
if (!backendOk) process.exit(1);

// 2. 前端測試
const frontendTestOk = runCommand(
  "npm run test",
  webappRoot,
  "前端 Vue 元件單元測試",
);
if (!frontendTestOk) process.exit(1);

// 3. 前端編譯打包
const frontendBuildOk = runCommand(
  "npm run build",
  webappRoot,
  "前端 Vite 生產打包編譯",
);
if (!frontendBuildOk) process.exit(1);

// 4. OpenAPI Spec 生成與 Breaking Change 檢查
const openapiGenOk = runCommand(
  "npm run openapi:generate",
  projectRoot,
  "OpenAPI Spec 生成",
);
if (!openapiGenOk) process.exit(1);

const openapiCheckOk = runCommand(
  "npm run openapi:check",
  projectRoot,
  "OpenAPI Breaking Change 檢查",
);
if (!openapiCheckOk) process.exit(1);

console.log(
  "🎉 恭喜！後端測試、前端測試、前端打包、OpenAPI Spec 生成與檢查全部 100% 成功通過！",
);
console.log("✅ 您可以安全地進行 git commit 以及 git push！保證零瑕疵存活！");
process.exit(0);