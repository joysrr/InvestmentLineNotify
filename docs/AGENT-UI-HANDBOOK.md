# Agent UI 驗證系統手冊 (Agent UI Verification Handbook)

> InvestmentLineNotify WebApp — 前端改動自驗證工具
> 版本 v1.0 · 2026-11-16 · 給接手的 AI Agent / 開發者

## 目的

在不影響正式部署的前提下，讓 Agent 能：
1. 改前端程式碼
2. 自動截圖 + 像素比對 + console error 檢查
3. 判定改動是否造成回歸
4. 一鍵交付或回滾

---

## 0. 30 秒上手

```bash
cd /root/work/InvestmentLineNotify/webapp

npm run ui:verify      # 驗證當前狀態（預期 7/7 ok）
# ... 改 src/ 下任何檔案 ...
npm run ui:verify      # 再驗證
npm run ui:report      # 看報告

npm run ui:push        # 全綠 → 交付到 /sdcard
npm run ui:rollback    # 有回歸 → 回滾
```

判定：
- `ok` 綠 — 與基準一致或差異在閾值內
- `changed` 黃 — 有像素差異但 < 2%，可接受
- `regressed` 紅 — 超閾值或有新 error → **必須修或回滾**

---

## 1. 核心架構

### 1.1 為什麼分兩層目錄

手機 `/sdcard` 是 FUSE 掛載，**不支援 symlink**。`npm install` 建 `node_modules/.bin` 時會 EACCES 失敗。

| 位置 | 角色 | 特性 |
|---|---|---|
| `/sdcard/Projects/InvestmentLineNotify/` | 生產源碼 | IDE 編輯 / 部署來源，慢、無 symlink |
| `/root/work/InvestmentLineNotify/` | Agent 工作區 | overlay fs，快、symlink 正常、node_modules 已裝 |

規則：**Agent 一律改 `/root/work`**，只有 `ui:push` 才回寫 `/sdcard`。

### 1.2 目錄結構

```
/root/work/InvestmentLineNotify/
├── node_modules -> webapp/node_modules   # 軟鏈（跨目錄 import 需要）
├── .git/                                 # rollback 用
├── src/                                  # 後端源碼
└── webapp/
    ├── node_modules/                     # playwright/pixelmatch/pngjs/pino
    ├── vite.config.mjs                   # ★ .mjs 副檔名，避 ESM/CJS 混亂
    ├── package.json                      # ui:* 六指令
    ├── src/                              # 前端源碼（改這裡）
    ├── .agent-baseline/                  # 基準快照
    │   ├── manifest.json
    │   └── screenshots/*.png
    ├── .agent-report/latest/             # 最新驗證結果
    │   ├── REPORT.md / report.json
    │   ├── screenshots/*.png
    │   └── diff/*.png
    └── scripts/agent/
        ├── run.sh                        # 入口（POSIX sh）
        ├── baseline.mjs / verify.mjs
        └── lib/
            ├── routes.mjs                # 頁面清單
            ├── fixtures.mjs              # API mock（最常改）
            ├── browser.mjs               # Chromium + Telegram mock
            ├── capture.mjs               # 截圖 + error 收集
            └── diff.mjs                  # pixelmatch
```

### 1.3 驗證流程

```
ui:verify
  ├─ 啟動 vite (port 5174, --config vite.config.mjs)
  ├─ 對 ROUTES 每頁：
  │   ├─ 新 context (390x844, DSF 2, mobile, dark)
  │   ├─ 注入 Telegram WebApp mock
  │   ├─ route 攔截 ^https?://host/api/* → fixtures
  │   ├─ goto → 等 #app.innerHTML > 100 → networkidle → +1.5s
  │   ├─ 截圖 + SHA256
  │   ├─ 收集 console error（過濾 abort 噪音）
  │   └─ 比對 baseline：hash 同 → ok；否則 pixelmatch
  └─ 判定：err > baseline OR diff > 2% → regressed
```

---

## 2. 六個命令

### ui:pull — 拉生產源碼到工作區
```bash
npm run ui:pull
```
`/sdcard` → `/root/work`（保留 node_modules）。接手別人的改動 / IDE 改過東西時用。

### ui:baseline — 拍基準
```bash
npm run ui:baseline            # 首次
npm run ui:baseline -- --reset # 覆蓋既有基準（慎用）
```
**會先從 `/sdcard` 同步 src**，確保基準 = 生產狀態。7 頁截圖存到 `.agent-baseline/`。

### ui:verify — 驗證當前改動
```bash
npm run ui:verify
AGENT_DIFF_THRESHOLD=5 npm run ui:verify  # 放寬到 5%
AGENT_PORT=5180 npm run ui:verify         # 改 port
```
**不從 /sdcard 同步**（關鍵），驗的就是工作區當前狀態。
Exit code：`0` 全 ok/changed｜`2` 有 regressed/error｜`1` 執行錯誤。

### ui:report — 看報告
```bash
npm run ui:report
```

### ui:push — 交付到生產
```bash
npm run ui:push
```
工作區 `src/` + `scripts/agent/` + `package.json` → `/sdcard`。**verify 全綠才 push**。

### ui:rollback — 回滾
```bash
npm run ui:rollback
```
`git checkout -- webapp/src/`。只回滾 src，不動 baseline、不動 scripts、不動 /sdcard。

---

## 3. 常見任務

### 3.1 改某頁 UI
```bash
cd /root/work/InvestmentLineNotify/webapp
# 1. 改檔（用 nano / 或直接 heredoc 覆寫）
nano src/views/DashboardView.vue
# 2. 驗證
npm run ui:verify
# 3a. 全綠 → push
npm run ui:push
# 3b. 紅 → 看 .agent-report/latest/REPORT.md
#     看 .agent-report/latest/diff/*.png（紅色=差異）
#     修 → 再 verify；或 npm run ui:rollback
```

### 3.2 新頁面加進驗證清單
編輯 `scripts/agent/lib/routes.mjs`：
```js
export const ROUTES = [
  // ...原有
  { slug: "my-new-page", path: "/#/my-new", title: "我的新頁面" },
];
```
然後**必須**：`npm run ui:baseline -- --reset`

### 3.3 某頁一直 500 / Failed to fetch
**fixture 形狀不對**，不是真 bug。
1. 看 view 怎麼用：`grep -n ".reverse()\|\.map(\|fetchXXX" src/views/XXX.vue`
2. 看 API 包裝：`grep -n "fetchXXX\|ENDPOINTS" src/api/index.js`
3. 判斷返回 **array** 還是 **object**，去 `lib/fixtures.mjs` 加 case：
```js
if (p.includes("/my-array-endpoint")) return [];
if (p.includes("/my-object-endpoint")) return { rows: [], total: 0 };
```
4. `npm run ui:baseline -- --reset` 重拍

已知需求：
- `/api/reports*` → **array**（AccountView 直接 .reverse()）
- `/api/reports/snapshots*` → **array**
- `/api/news` → **array**
- `/api/status` `/api/portfolio/health` `/api/strategy-config` → **object**

### 3.4 某頁 error 增加但無害
已自動過濾的噪音（capture.mjs 的 ABORT_NOISE_RE）：
- `Failed to fetch` / `net::ERR_ABORTED` / `The user aborted a request`
- Vite HMR `ws://` 連線失敗

真 error 但可接受 → 重拍 baseline 承認新狀態：`npm run ui:baseline -- --reset`

### 3.5 vite 起不來 / 頁面全白
症狀：verify 全部 RENDER_TIMEOUT，vite log 有 `Failed to resolve import "pino"` 或 ESM 錯誤。
```bash
grep -A2 '"pino"' package.json          # pino 在 devDeps？
ls vite.config.mjs                        # mjs 存在？
grep "vite --config" scripts/agent/run.sh  # 用 --config？
npm install --registry https://registry.npmmirror.com
```

---

## 4. 陷阱清單（踩過的坑）

| 坑 | 症狀 | 解法 |
|---|---|---|
| /sdcard 無 symlink | npm install EACCES | 一律在 /root/work 裝 |
| Playwright 用 Android cache | mkdtemp ENOENT | TMPDIR=/tmp（run.sh 已設） |
| Playwright arm64 無官方 build | install 失敗 | 用系統 chromium + executablePath |
| vite.config.js ESM/CJS 混亂 | Cannot use import outside module | 用 .mjs + --config |
| mock glob 太貪婪 | Failed to load module script | 正則 ^https?://[^/]+/api(/|$|\?) |
| 跨目錄 import logger | pino 解析失敗 | 建 root node_modules 軟鏈 |
| --no-save 裝的包被清 | 昨天好今天壞 | 一律寫入 devDependencies |
| context 太快關 | 假 Failed to fetch | ABORT_NOISE_RE 過濾 |
| fixture 形狀錯 | .reverse is not a function | 確認 array/object |
| verify 前 rsync 覆蓋改動 | 改壞了 verify 還 ok | verify 分支不同步（已設計） |
| 沒 --reset 重拍 | Baseline 已存在 | 加 -- --reset |
| 在 /sdcard 跑測試 | symlink 錯 | 一切在 /root/work |

---

## 5. 安全邊界

| 禁止 | 原因 |
|---|---|
| 直接改 /sdcard 的 webapp/src | 那是生產源碼 |
| 刪 .agent-baseline/ | verify 失去判定依據 |
| ui:verify 前手動 rsync src | 會覆蓋改動 |
| 改 vite.config.js 原檔 | 只改 vite.config.mjs |
| 改 scripts/audit-pages.mjs 等 | 生產 QA 流程，獨立 |
| git push | /root/work/.git 是本地沙箱 |
| 碰 src/api/server.mjs | 驗證用 mock，後端不在範圍 |

---

## 6. 從零重建環境

若容器重啟 / 工作區損壞：
```bash
# 1. 系統依賴
apk add --no-cache chromium rsync git nodejs npm

# 2. 建工作區（避開 perms，因 /sdcard 是 FUSE）
mkdir -p /root/work/InvestmentLineNotify
rsync -rlt --no-perms --no-owner --no-group \
  --exclude node_modules --exclude .git \
  /sdcard/Projects/InvestmentLineNotify/ /root/work/InvestmentLineNotify/

# 3. 裝依賴
cd /root/work/InvestmentLineNotify/webapp
npm install --registry https://registry.npmmirror.com

# 4. root node_modules 軟鏈
cd /root/work/InvestmentLineNotify
ln -sf webapp/node_modules node_modules

# 5. vite.config.mjs
cd webapp
[ -f vite.config.mjs ] || cp vite.config.js vite.config.mjs

# 6. git init（rollback 需要）
cd /root/work/InvestmentLineNotify
git init && git add -A && git -c user.email=a@b -c user.name=agent commit -m "init"

# 7. 驗證
cd webapp
AGENT_PORT=5174 npm run ui:baseline -- --reset
AGENT_PORT=5174 npm run ui:verify
# 預期：ok=7 regressed=0
```

---

## 7. 當前專案狀態（2026-11-16）

| 項目 | 狀態 |
|---|---|
| 技術棧 | Vue 3 + Vite 6 + Element Plus + Pinia + vue-router + ECharts |
| 頁面 | 7 頁 |
| 基準 | 7/7 全綠 0 error |
| 依賴 | playwright / pixelmatch / pngjs / pino 在 devDependencies |
| node | v20.15.1（EBADENGINE warning 不影響執行） |
| Chromium | /usr/bin/chromium（Alpine 131） |

頁面清單：
- dashboard 儀表板 `/#/dashboard`
- insights-radar 市場雷達 `/#/insights?tab=radar`
- insights-macro 多空對決 `/#/insights?tab=macro`
- chart 圖表 `/#/chart`
- news 新聞 `/#/news`
- account 帳戶 `/#/account`
- strategy-config 策略設定 `/#/strategy-config`

---

## 8. 擴展方向

1. 多視窗尺寸（360×640 / 430×932）
2. 互動態快照（點按鈕後）
3. a11y 檢查（axe-core）
4. CI 整合（GitHub Action）

---

## 9. 出處

- 專案：InvestmentLineNotify
- 源碼：/sdcard/Projects/InvestmentLineNotify/
- 工具：webapp/scripts/agent/
- 建置：AI Agent 2026-11-16

**接手時第一句話**：
> `cd /root/work/InvestmentLineNotify/webapp && npm run ui:verify`
> 確認 7/7 ok，再開始改東西。

---

## 3.7 截图全白 / 无中文字（CJK 字体缺失）

**症状**：baseline 跑通、7/7 页 0 error，但打开截图**看不到任何中文字**——布局正常但文字是空白，整页看起来 90% 白底。

**根因**：Alpine 容器默认**不带任何 CJK 字体**，Chromium 会用西文字体（Open Sans）去渲染中文，全部 fallback 成空白。

**诊断**：
```bash
# 应该有 20+ 条，如果为 0 就是缺字体
fc-list | grep -icE "cjk|noto.*sc"

# 应该命中 Noto CJK；如果是 OpenSans-Regular 就是没配好
fc-match "sans-serif:lang=zh"
```

**修复**（跑一次 `scripts/agent/install-deps.sh` 会自动做，或手动）：
```bash
apk add --no-cache font-noto-cjk
mkdir -p /root/.config/fontconfig
cat > /root/.config/fontconfig/fonts.conf <<"FONTCONF"
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>Noto Sans CJK TC</string></edit>
  </match>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="append" binding="strong"><string>Noto Sans CJK SC</string></edit>
  </match>
</fontconfig>
FONTCONF
fc-cache -f
fc-match "sans-serif:lang=zh"   # 应显示 Noto Sans CJK TC
```

**验证**：修复后截图中间调像素（文字）会从 ~0% 涨到 2-4%。可以这样程序化检测：
```js
// PNG 里亮度在 80-200 之间（非纯黑非纯白）的像素 = 文字渲染
let mid = 0;
for (let i = 0; i < png.data.length; i += 4) {
  const lum = png.data[i]*0.299 + png.data[i+1]*0.587 + png.data[i+2]*0.114;
  if (lum >= 80 && lum <= 200) mid++;
}
// mid/总像素 > 0.5% 说明有文字；接近 0% 说明没字体
```

**如果不修复会怎样**：视觉回归检查形同虚设——文字溢出、换行、对比度、对齐全看不见，agent 无法真正"审查" UI。

---

## 3.8 vite 进程跨命令被 kill

**症状**：单独启动 vite 成功（`curl http://localhost:5174` 返回 200），但下一条命令里 vite 已经死了，baseline 全部 `ERR_CONNECTION_REFUSED`，7 张截图完全一样（都是 Chrome 错误页）。

**根因**：App 的每条 bash 命令运行在独立 shell，shell 退出时会对子进程发 SIGHUP。`npx vite &` 的后台进程属于这个 shell，shell 退出就被杀。

**修复**：用 `setsid` 让 vite 成为独立会话的 leader，脱离 shell 生命周期：
```bash
setsid npx vite --config vite.config.mjs --port 5174 --strictPort < /dev/null > /tmp/vite.log 2>&1 &
disown 2>/dev/null || true
sleep 8
node -e "fetch('http://localhost:5174/').then(r=>console.log('HTTP',r.status))"
```

**或更简单**：用 `scripts/agent/run.sh baseline` ——它已经在内部处理了（`setsid` + trap 清理）。

**验证截图是否真的对应不同页面**：7 张截图的 SHA256 必须**各不相同**；如果完全相同（且都是几十 KB），说明全是错误页。
```bash
node -e "const m=require('./.agent-baseline/manifest.json'); const hashes = m.routes.map(r=>r.screenshotHash); console.log('unique hashes:', new Set(hashes).size, '/', hashes.length);"
# 必须 7/7，否则某页没抓到
```

