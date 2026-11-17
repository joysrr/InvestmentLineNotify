# Agent UI 驗證系統手冊 (Agent UI Verification Handbook)

> InvestmentLineNotify WebApp — 前端改動自驗證工具
> 版本 **v2.0** · 2026-11-17 · 給接手的 AI Agent / 開發者
>
> **v2.0 重大變更**：驗證基線由「本地像素截圖」改為「GitHub origin/main + production build」。
> 原因：容器記憶體不足（available ~3GB），Playwright chromium 啟動即 OOM，像素比對不可用。

## 目的

在不影響正式部署的前提下，讓 Agent 能：
1. 改前端程式碼
2. 自動對比 GitHub 遠端基線 + 跑 production build
3. 判定改動是否可交付
4. 一鍵 push 到 GitHub main 或回滾

---

## 0. 30 秒上手

```bash
cd /root/work/InvestmentLineNotify/webapp

npm run ui:verify      # 驗證：對比 origin/main + production build
# ... 改 src/ 下任何檔案 ...
npm run ui:verify      # 再驗證
npm run ui:report      # 看報告

npm run ui:push        # 驗證通過 → commit → push 到 GitHub main
npm run ui:rollback    # 有問題 → 回滾 webapp/src
```

判定：
- `build ✓` 綠 — production build 通過，可交付
- `lint ⚠` 黃 — lint 有問題但不阻斷（目前 `@eslint/js` 未安裝，屬既有問題）
- `build ✗` 紅 — build 失敗 → **必須修，禁止 push**
- `!error` — 找不到 origin/main → 先 `git fetch origin`

---

## 1. 核心架構

### 1.1 為什麼分兩層目錄

手機 `/sdcard` 是 FUSE 掛載，**不支援 symlink**。`npm install` 建 `node_modules/.bin` 時會 EACCES 失敗。

| 位置 | 角色 | 特性 |
|---|---|---|
| `/sdcard/Projects/InvestmentLineNotify/` | 生產源碼 | IDE 編輯 / 部署來源，慢、無 symlink |
| `/root/work/InvestmentLineNotify/` | Agent 工作區 | overlay fs，快、symlink 正常、node_modules 已裝 |
| `github.com:joysrr/InvestmentLineNotify` | **驗證基線 + 交付目標** | v2.0 起唯一真相來源 |

規則：**Agent 一律改 `/root/work`**，驗證對比 GitHub，交付用 `git push`。

### 1.2 目錄結構

```
/root/work/InvestmentLineNotify/
├── node_modules -> webapp/node_modules   # ★ 軟鏈（跨目錄 import pino 需要）
├── .git/                                 # git 倉庫（remote: origin → GitHub）
├── .gitignore                            # 含 node_modules / .agent-report / .agent-baseline
├── src/                                  # 後端源碼
└── webapp/
    ├── node_modules/                     # playwright/pixelmatch/pngjs/pino
    ├── vite.config.mjs                   # ★ .mjs 副檔名，避 ESM/CJS 混亂
    ├── package.json                      # ui:* 指令
    ├── QUICKSTART.md                     # 30 秒上手
    ├── AGENT-UI-HANDBOOK.md              # 本文件
    ├── src/                              # 前端源碼（改這裡）
    ├── .agent-report/latest/             # 最新驗證結果（gitignored）
    │   ├── REPORT.md / report.json
    │   └── screenshots/ diff/            # 僅像素模式產生
    └── scripts/agent/
        ├── verify-git.mjs                # ★ v2.0 主驗證（GitHub 基線）
        ├── push-git.sh                   # ★ v2.0 git 交付
        ├── run.sh                        # 舊像素流程入口（保留）
        ├── baseline.mjs / verify.mjs     # 舊像素流程（OOM，僅環境寬裕時用）
        └── lib/                          # routes/fixtures/browser/capture/diff
```

### 1.3 驗證流程（v2.0）

```
ui:verify  →  node scripts/agent/verify-git.mjs
  ├─ git fetch origin
  ├─ 比對 HEAD...origin/main（ahead/behind）
  ├─ 列出已提交改動 + 工作區未提交改動
  ├─ 門禁 1：npm run build（production，含體積閘門）
  │    ✗ 失敗 → exit 2，禁止交付
  ├─ 門禁 2：npm run lint（僅記錄，不阻斷）
  └─ 輸出 .agent-report/latest/{report.json, REPORT.md}
```

---

## 2. 指令一覽

### ui:verify — 驗證（主指令）
```bash
npm run ui:verify
```
對比 origin/main + production build。Exit code：`0` 通過｜`2` build 失敗｜`1` 執行錯誤。

### ui:report — 看報告
```bash
npm run ui:report
```

### ui:push — 交付到 GitHub
```bash
npm run ui:push                          # 預設 commit message
sh scripts/agent/push-git.sh "feat: xxx" # 自訂 message
```
流程：驗證 → git add -A → commit → push origin main。**驗證不通過直接中止**。

### ui:pull — 從 GitHub 拉最新
```bash
npm run ui:pull
```
`git pull --ff-only origin main`，避免產生 merge commit。

### ui:rollback — 回滾
```bash
npm run ui:rollback
```
`git checkout -- webapp/src/`。只回滾 src，不動其他。

### ui:verify:pixel — 舊像素驗證（備用）
```bash
npm run ui:verify:pixel
```
需要先 `npm run ui:baseline`。**目前環境會 OOM**，僅在記憶體寬裕時使用。

---

## 3. 常見任務

### 3.1 改某頁 UI
```bash
cd /root/work/InvestmentLineNotify/webapp
# 1. 改檔
nano src/views/DashboardView.vue
# 2. 驗證
npm run ui:verify
# 3a. 綠 → 交付
npm run ui:push
# 3b. 紅 → 看 .agent-report/latest/REPORT.md 修，或
npm run ui:rollback
```

### 3.2 新頁面加進驗證清單
編輯 `scripts/agent/lib/routes.mjs`（僅影響像素模式；v2.0 主驗證靠 build，不需改）。

### 3.3 build 失敗排查
1. 看 `.agent-report/latest/REPORT.md` 的 Build 輸出尾段
2. 常見：`Rollup failed to resolve import "xxx"` → 套件沒裝或軟鏈丟失
3. 修完重跑 `npm run ui:verify`

### 3.4 lint 一直失敗
`@eslint/js` / `globals` 未安裝（既有問題，非本次引入）。lint 為非阻斷項，不影響交付。要修：
```bash
cd /root/work/InvestmentLineNotify/webapp
npm install -D @eslint/js globals --registry https://registry.npmmirror.com
```

---

## 4. 陷阱清單（踩過的坑）

| 坑 | 症狀 | 解法 |
|---|---|---|
| **root node_modules 軟鏈丟失** | build 報 `Rollup failed to resolve import "pino"` | `cd /root/work/InvestmentLineNotify && ln -sfn webapp/node_modules node_modules` |
| /sdcard 無 symlink | npm install EACCES | 一律在 /root/work 裝 |
| Playwright 用 Android cache | mkdtemp ENOENT | TMPDIR=/tmp（run.sh 已設） |
| Playwright arm64 無官方 build | install 失敗 | 用系統 chromium + executablePath |
| vite.config.js ESM/CJS 混亂 | Cannot use import outside module | 用 .mjs + --config |
| mock glob 太貪婪 | Failed to load module script | 正則 ^https?://[^/]+/api(/|$|\?) |
| 跨目錄 import logger | pino 解析失敗 | 建 root node_modules 軟鏈 |
| --no-save 裝的包被清 | 昨天好今天壞 | 一律寫入 devDependencies |
| context 太快關 | 假 Failed to fetch | ABORT_NOISE_RE 過濾 |
| fixture 形狀錯 | .reverse is not a function | 確認 array/object |
| **像素驗證 OOM** | `Killed` / chromium 啟動即崩 | 用 `ui:verify`（git 基線），不要用 `ui:verify:pixel` |
| **殘留進程吃記憶體** | available 掉到 2GB | `pkill -9 chromium; pkill -9 esbuild`（勿用過寬 pattern 會殺自己 shell） |
| **`.gitignore` 只寫 `node_modules/`** | 軟鏈被當未追蹤 | 補一行不帶斜線的 `node_modules` |
| 在 /sdcard 跑測試 | symlink 錯 | 一切在 /root/work |

---

## 5. 安全邊界

| 禁止 | 原因 |
|---|---|
| 直接改 /sdcard 的 webapp/src | 那是生產源碼，v2.0 起以 GitHub 為準 |
| 刪 .agent-baseline/（若存在） | 像素模式會失去判定依據 |
| 改 vite.config.js 原檔 | 只改 vite.config.mjs |
| 改 scripts/audit-pages.mjs 等 | 生產 QA 流程，獨立 |
| 碰 src/api/server.mjs | 驗證用 mock，後端不在範圍 |
| **在 build 失敗時 push** | push-git.sh 已內建門禁，不要繞過 |
| **force push 到 main** | 會破壞他人歷史 |

---

## 6. 從零重建環境

若容器重啟 / 工作區損壞：

```bash
# 1. 系統依賴
apk add --no-cache chromium rsync git nodejs npm openssh-client

# 2. 建工作區（避開 perms，因 /sdcard 是 FUSE）
mkdir -p /root/work/InvestmentLineNotify
rsync -rlt --no-perms --no-owner --no-group \
  --exclude node_modules --exclude .git \
  /sdcard/Projects/InvestmentLineNotify/ /root/work/InvestmentLineNotify/

# 3. ★ 從 GitHub 拉完整歷史（v2.0 起以 git 為真相來源）
cd /root/work/InvestmentLineNotify
git init
git remote add origin git@github.com:joysrr/InvestmentLineNotify.git
git fetch origin
git reset --hard origin/main

# 4. 裝依賴
cd webapp
npm install --registry https://registry.npmmirror.com

# 5. ★ root node_modules 軟鏈（沙箱重啟後最常丟，務必確認）
cd /root/work/InvestmentLineNotify
ln -sfn webapp/node_modules node_modules
ls -la node_modules          # 應顯示 -> webapp/node_modules

# 6. 驗證
cd webapp
npm run ui:verify
# 預期：build ✓ 通過
```

---

## 7. 當前專案狀態（2026-11-17 · v2.0）

| 項目 | 狀態 |
|---|---|
| 技術棧 | Vue 3 + Vite 6 + Element Plus + Pinia + vue-router + ECharts |
| 頁面 | 7 頁 |
| 驗證基線 | **GitHub origin/main**（v2.0） |
| 交付方式 | **git push origin main**（v2.0） |
| Build | ✓ 通過（Initial JS 103.3KB / 預算 156KB） |
| Lint | ⚠ `@eslint/js` 未安裝（既有問題） |
| node | v20.15.1（EBADENGINE warning 不影響執行） |
| Chromium | /usr/bin/chromium（像素模式用，目前 OOM 不可用） |
| 記憶體 | total 11GB，available ~3GB（像素驗證不可行的原因） |

頁面清單：
- dashboard 儀表板 `/#/dashboard`
- insights-radar 市場雷達 `/#/insights?tab=radar`
- insights-macro 多空對決 `/#/insights?tab=macro`
- chart 圖表 `/#/chart`
- news 新聞 `/#/news`
- account 帳戶 `/#/account`
- strategy-config 策略設定 `/#/strategy-config`

---

## 8. v1.0 → v2.0 遷移對照

| 項目 | v1.0 | v2.0 |
|---|---|---|
| 驗證基線 | 本地 `.agent-baseline/` 截圖 | GitHub `origin/main` + build |
| 判定方式 | 像素差異 < 2% | build 成功 / 失敗 |
| 交付 | rsync → /sdcard | git commit + push |
| 回滾 | git checkout webapp/src | 同左 |
| 像素驗證 | 主流程 | 降級為 `ui:verify:pixel`（備用） |
| 阻塞原因 | — | 記憶體不足導致 chromium OOM |

---

## 9. 出處

- 專案：InvestmentLineNotify
- 倉庫：git@github.com:joysrr/InvestmentLineNotify.git（main）
- 工作區：/root/work/InvestmentLineNotify
- 生產鏡像：/sdcard/Projects/InvestmentLineNotify
- 工具：webapp/scripts/agent/
- v1.0 建置：AI Agent 2026-11-16
- v2.0 改造：AI Agent 2026-11-17（GitHub 基線 + git 交付）

**接手時第一句話**：
> `cd /root/work/InvestmentLineNotify/webapp && npm run ui:verify`
> 確認 `build ✓`，再開始改東西。

---

## 10. 實測驗證經驗（v2.1 · 2026-11-17）

> 完整 SOP 見 `VERIFICATION-SOP.md`。本節只記關鍵結論。

### 10.1 三層驗證（可靠性排序）

| 層 | 工具 | 可靠性 | 耗時 |
|---|---|---|---|
| ① 資料層 | `verify-fixtures.mjs`（純 Node） | ✅ 必成 | 5 秒 |
| ② 視覺層 | `serve-fixtures.mjs` + 手機瀏覽器 | ✅ 最可靠（真 chromium + GPU） | 30 秒 |
| ③ 自動截圖 | `shoot-mock.mjs`（裸 CDP） | ⚠️ 不穩定 | 40-60 秒 |

### 10.2 修正 v2.0 的過度絕對表述

- **v2.0 原文**：「Playwright Chromium 啟動即 OOM，像素驗證不可用」
- **實際**：playwright（三層）確實不可用；但**裸 CDP（node+ws 直連）在 available > 3GB 時可成功截圖**，03:40 曾 7/7 成功
- **準確表述**：穩定性受記憶體臨界限制，不是技術不可行

### 10.3 PRoot 環境關鍵陷阱

| 陷阱 | 解法 |
|---|---|
| stdout 塊緩衝吞輸出 | 所有 log 用 `fs.appendFileSync`；命令塊後單獨 `cat` |
| OOM 連 shell 一起殺 | 命令塊空白先查 `/tmp/*.log`，別急著重跑 |
| `setsid -f` 不支援（BusyBox） | 用 `nohup (... &)` |
| 沒有 curl | 用 `node -e "fetch(...)"` |
| EADDRINUSE | 之前的 server 還活著，先探測再重用 |
| Alpine chromium 無 GL | `apk add mesa-egl mesa-gles mesa-dri-gallium` + `--use-gl=angle --use-angle=gl-egl` |

### 10.4 接手時的第一句話

> `cd webapp && node scripts/agent/verify-fixtures.mjs`
> 看到 `全部通過 ✅` 再開始做視覺驗證。

---


---
---

## 11. EP → M3 主題驗證經驗（v2.2 · 2026-11-17）

### 11.1 P0：vite alias 缺 isTest 守衛

**症狀**：上線後 el-alert 750px、el-collapse 387px 完全裸奔，本地 dev 正常。
**根因**：vite.config.mjs 的 resolve.alias 無條件把 EP theme-chalk CSS 替換為 src/test/empty.css。
**修法**：把該 alias 包進 `...(isTest ? [...] : [])`。
**驗證**：el-alert 40px / el-collapse 49px。

### 11.2 P1：EP 默認主題與 M3 token 衝突

**症狀**：EP 有樣式但全是默認藍白灰：primary #409eff / bg #fff / radius 4px，違反 B1 與「禁止默認控件」規範。
**修法**：新增 src/styles/element-plus-overrides.css，把 --el-* 全量映射到 --iln-* M3 token（404 行，4 段）。
**引入位置**：main.js 中 shared-styles.css 之後。

### 11.3 三個關鍵陷阱

1. **EP chunk CSS 運行時後注入**：同特異性下順序壓過 overrides → 組件級規則必須 `!important`。
2. **派生色階必須全補**：`--el-color-{type}-light-{3,5,7,8,9}` 與 `-dark-2`。只補主色不夠，el-alert bg 用的是 light-9。
3. **dark 必須獨立覆蓋**：`:root[data-tg-scheme="dark"] { ... }`，否則 dark 下 alert 是淺底深字。M3 dark container：info #00497D / success #386A20 / warning #5F4100 / danger #93000A。

### 11.4 驗證探針 diag-ep-tokens.mjs

**用法**：`node --max-old-space-size=192 scripts/agent/diag-ep-tokens.mjs`
**輸出**：{ light, dark }，每段含 14 個 EP 變數 + alert/input 實際計算樣式。
**修前**：alert.bg rgb(244,244,245) / input.bg #fff / primary #409eff
**修後**：light.alert.bg rgb(240,246,255) / dark.alert.bg rgb(0,73,125) / input.radius 12px
**陷阱**：不要查不存在的 --el-alert-bg-color-info / --el-alert-text-color-info（假陰性）。
**chromium 必需**：--use-gl=angle --use-angle=gl-egl（缺則 SIGABRT）。

### 11.5 check-no-raw-color 對 CSS 假陽性

check-no-raw-color.mjs 的 walk() 只掃 .vue/.js/.mjs，不掃 .css。決策：把 overrides.css 加入 FILE_WHITELIST（它是第二個 token 檔），不擴掃描範圍。

### 11.6 接手 6 步排查

1. vite.config.mjs alias 有 isTest 守衛？
2. main.js 有 import overrides（在 shared-styles 後）？
3. overrides 有補 light-9 / dark-2？
4. .el-alert--* / .el-input__wrapper 有 !important？
5. :root[data-tg-scheme="dark"] 分支獨立？
6. 跑 diag-ep-tokens，light+dark 兩段都對才收工。

### 11.7 本次 commit 軌跡

bf651030（P0+P1 主修復）→ 65a1e4d8（lint 清零）→ 801e8cbc（手冊 v2.2）→ 本補完 commit。
