#!/usr/bin/env node
/**
 * validate-phase-completion.mjs
 * 驗證 Phase 完成狀態：git status、本地/遠端 HEAD SHA、關鍵檔案存在性
 *
 * 使用方式:
 *   node scripts/validate-phase-completion.mjs --phase "Phase 10" --files "docs/a.md,docs/b.md"
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const k = arg.slice(0, eqIdx);
      const v = arg.slice(eqIdx + 1);
      if (k === "--files")
        opts.files = v
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
      else opts[k.slice(2)] = v;
    } else {
      const k = arg.slice(2);
      const v = args[i + 1];
      if (k === "files" && v) {
        opts.files = v
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
        i++; // consume next arg
      } else {
        opts[k] = v || true;
      }
    }
  }
}

const RESULTS = { pass: 0, fail: 0, details: [] };

function check(label, ok, detail = "") {
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
  RESULTS.details.push({ label, ok, detail });
  if (ok) RESULTS.pass += 1;
  else RESULTS.fail += 1;
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch (e) {
    return "";
  }
}

// 1. Phase 名稱
check(`Phase: ${opts.phase || "(未指定)"}`, true);

// 2. git status clean
const gitStatus = run("git status --porcelain");
check(
  "working tree 乾淨",
  gitStatus === "",
  gitStatus ? `有 ${gitStatus.split("\n").filter(Boolean).length} 個異動` : "",
);

// 3. 本地 HEAD SHA
const localSha = run("git rev-parse HEAD");
check("本地 HEAD SHA", localSha.length > 0, localSha);

// 4. 遠端 HEAD SHA (GitHub API)
let remoteSha = "";
try {
  const https = await import("https");
  remoteSha = await new Promise((resolve) => {
    const req = https.get(
      "https://api.github.com/repos/joysrr/InvestmentLineNotify/commits/main",
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).sha);
          } catch {
            resolve("");
          }
        });
      },
    );
    req.on("error", () => resolve(""));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve("");
    });
  });
} catch {
  remoteSha = "";
}

check("遠端 HEAD SHA", remoteSha.length > 0, remoteSha || "無法取得");

// 5. HEAD 一致性
check(
  "本地/遠端 HEAD 一致",
  localSha === remoteSha && remoteSha.length > 0,
  localSha === remoteSha ? "一致" : "不一致",
);

// 6. 關鍵檔案存在性 (從 raw.githubusercontent.com)
if (opts.files && opts.files.length > 0) {
  const https = await import("https");
  for (const file of opts.files) {
    try {
      const exists = await new Promise((resolve) => {
        const req = https.get(
          `https://raw.githubusercontent.com/joysrr/InvestmentLineNotify/main/${file}`,
          (res) => {
            resolve(res.statusCode === 200);
          },
        );
        req.on("error", () => resolve(false));
        req.setTimeout(10000, () => {
          req.destroy();
          resolve(false);
        });
      });
      check(
        `GitHub 檔案存在: ${file}`,
        exists,
        exists ? "200 OK" : "404 或錯誤",
      );
    } catch {
      check(`GitHub 檔案存在: ${file}`, false, "請求失敗");
    }
  }
} else {
  check("關鍵檔案檢查", true, "未指定 --files，跳過");
}

// 輸出摘要
console.log(`\n📊 結果: ${RESULTS.pass} 通過, ${RESULTS.fail} 失敗`);
if (RESULTS.fail > 0) {
  console.log("\n⚠️  失敗項目：");
  for (const d of RESULTS.details) {
    if (!d.ok) console.log(`   • ${d.label}: ${d.detail}`);
  }
  process.exit(1);
} else {
  console.log("✅ Phase 完成驗證全部通過");
  process.exit(0);
}
