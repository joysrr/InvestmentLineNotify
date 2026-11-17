# UI 驗證 SOP — 接手指南（v2.1 · 2026-11-17）

> 一句話：資料層用 verify-fixtures.mjs（必成），視覺層用手機瀏覽器 + serve-fixtures.mjs。
> 不要在容器內反覆跑 chromium 截圖——記憶體臨界會連 shell 一起被殺。

## 0. 三層驗證（按可靠性排序）

| 層 | 工具 | 可靠性 | 耗時 | 用途 |
|---|---|---|---|---|
| ① 資料層 | verify-fixtures.mjs | 必成 | 5 秒 | 11 個 API 端點形狀 |
| ② 視覺層 | serve-fixtures.mjs + 手機瀏覽器 | 最可靠 | 30 秒 | 親眼看排版 |
| ③ 自動截圖 | shoot-mock.mjs（裸 CDP） | 不穩定 | 60 秒 | 批量 PNG |

接手第一件事：跑 ①，看到「全部通過」再往下。不要一上來就碰 ③。

## 1. 指令速查

    cd /root/work/InvestmentLineNotify/webapp

    # ① 驗證 fixture 形狀（必成，純 Node <50MB）
    node scripts/agent/verify-fixtures.mjs

    # ② 起 server（前台執行，Ctrl+C 結束）
    node scripts/agent/serve-fixtures.mjs

    # ③ 自動截圖（先確認 available > 2.5GB 且無殘留進程）
    free -m | head -2
    node --max-old-space-size=128 scripts/agent/shoot-mock.mjs

## 2. 七個頁面 URL（server 啟動後手機瀏覽器開）

    http://127.0.0.1:5175/#/dashboard
    http://127.0.0.1:5175/#/insights?tab=radar
    http://127.0.0.1:5175/#/insights?tab=macro
    http://127.0.0.1:5175/#/chart
    http://127.0.0.1:5175/#/news
    http://127.0.0.1:5175/#/account
    http://127.0.0.1:5175/#/strategy-config

## 3. PRoot 環境十大陷阱

| # | 陷阱 | 症狀 | 解法 |
|---|---|---|---|
| 1 | stdout 塊緩衝吞輸出 | 命令塊空白但腳本跑了 | log 用 fs.appendFileSync；命令塊後單獨 cat |
| 2 | OOM 連 shell 一起殺 | 整塊空白連 echo 都沒有 | 先 ls /tmp/*.log 看有沒有落盤 |
| 3 | setsid -f 不支援 | unrecognized option: f | BusyBox 只有 setsid；別用後台常駐 |
| 4 | 沒有 curl | curl: not found | 用 node -e fetch |
| 5 | EADDRINUSE 不是失敗 | 啟動報埠佔用 | 之前的 server 還活著，先探測 |
| 6 | playwright 三層太重 | launch 即空白 | 用裸 CDP（node + ws 直連） |
| 7 | virtual-time-budget 吞截圖 | --screenshot 不出檔 | 拿掉；SPA 用 CDP 等固定秒數 |
| 8 | 無 mesa 則無 GL | raster decoder state | apk add mesa-egl mesa-gles mesa-dri-gallium |
| 9 | ANGLE 走 Vulkan 崩潰 | VK_KHR_surface not supported → signal 6 | 加 --use-angle=gl-egl；仍崩就放棄截圖 |
| 10 | heredoc 寫含 fence 的 markdown 被截斷並誤執行 | 檔案只寫一部分、fence 內命令被當 shell 跑 | 改用 node 寫檔；不用 fence，改 4 空格縮進 |

## 4. 命令塊空白的診斷順序

    1. ls -la /tmp/<腳本日誌>.log        → 有檔案？有內容？
    2. node -e 探測 5175/api/status      → 端口已活？之前的 server 還在
    3. free -m | head -2                  → available < 2.5GB 別跑 chromium
    4. ps aux | grep chromium             → 有殘留先 pkill -9 -f chromium

不要看到空白就重跑同一條命令。先診斷，再決定。

## 5. chromium 截圖可用參數（唯一成功那套）

    apk add --no-cache mesa-egl mesa-gles mesa-dri-gallium
    /usr/bin/chromium --headless=new --single-process --no-zygote \
      --no-sandbox --disable-dev-shm-usage --disable-gpu \
      --disable-extensions --disable-plugins --hide-scrollbars \
      --disable-background-networking --use-gl=angle --use-angle=gl-egl \
      --js-flags=--max-old-space-size=160 --window-size=390,844 \
      --remote-debugging-port=9222 --user-data-dir=/tmp/shoot-profile about:blank

三層堆限制：node 128MB / server 64MB / chromium 192MB。加任何額外負載都可能翻車。

已知失敗模式（2026-11-17 04:00 實測）：
    vk_renderer.cpp: Extension not supported: VK_KHR_surface
    gl_display.cc: eglInitialize SwANGLE failed
    FATAL:check.cc(381) → proot info: vpid 1: terminated with signal 6
→ ANGLE 走了 Vulkan 後端但驅動不支援。遇到直接放棄截圖，轉手機瀏覽器。

## 6. 產物位置

| 類型 | 容器內 | 可見目錄 |
|---|---|---|
| 截圖 | webapp/.agent-report/latest/mock-screenshots/ | /sdcard/Download/mock-screenshots/ |
| fixture 源碼 | webapp/scripts/agent/lib/fixtures.mjs | /sdcard/Download/agent-verification/fixtures.mjs |
| 驗證腳本 | webapp/scripts/agent/{verify,serve,shoot,probe}-*.mjs | — |
| 文檔 | webapp/VERIFICATION-SOP.md 等 | /sdcard/Download/agent-verification/ |

## 7. 底線（血淚總結）

- 不要為了截圖反覆重試——3 次失敗就轉手機瀏覽器
- 不要在截圖同一輪加 DOM 探針（負載疊加必崩）
- 不要相信命令塊空白 = 腳本失敗，先查 log
- 不要用 nohup 起常駐 server（留殭屍、不易管理）
- 要先用 verify-fixtures.mjs 確認資料層，再做視覺驗證
- 要分段寫長檔案；含 fence 的 markdown 用 node 寫，不要 heredoc

## 8. 本次驗證最終結論（2026-11-17）

| 層 | 狀態 | 證據 |
|---|---|---|
| 資料層 | 完全正確 | verify-fixtures.mjs 11/11；server 實時 sources=8 |
| 資源層 | 完全正確 | 首頁 2071 bytes，Telegram mock 注入，外鏈全清 |
| 視覺層 | 已交付 | 7 張 PNG（03:40）+ 手機瀏覽器可實時查看 |
| 容器內自動化 | 不穩定 | available 2.9-3.2GB 漂移，10 次嘗試 1 次成功 |

## 9. 本次事故記錄（供後人避坑）

2026-11-17 03:46 分段用 heredoc 寫本文件，P1/P2/P3 被截斷，只有 P4 寫入（58 行）。
更嚴重：P3 的 fence 代碼塊被 shell 當命令執行（apk add + chromium 啟動）。
根因：PRoot 下含 markdown fence 的 heredoc 不可靠。
解法：改用 node -e 的字符串數組寫檔；markdown 代碼塊用 4 空格縮進，不用 fence。

> **更新 2026-11-17 05:30（推翻本文舊結論）**：
> Playwright 實測 **7/7 頁全成功**。舊「chromium 啟動即崩、10 次 1 次成功」的誤判主因是：
> 1) `pkill -9 -f chromium` 會連執行它的 shell 一起殺（argv 自我匹配），導致後續命令從未執行，表現為「命令塊空白」。
> 2) 殘留 chromium 進程未清。
>
> 正確用法：`pgrep -f chromium | xargs -r kill -9` 清乾淨後，
> `chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--js-flags=--max-old-space-size=128"] })` 可直接穩定截圖（7 頁約 20 秒）。
> 腳本：`scripts/agent/verify-visual.mjs`；產物：`.agent-report/latest/visual/` → `/sdcard/Download/mock-screenshots/`。
