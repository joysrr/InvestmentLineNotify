# Workspace: <project_name>

> 專案環境變數檔。`@Lead` 於派發子 Agent 前依策略 A 靜態注入對應欄位。
> 本檔為**空白模板**，複製後修改；不直接作為 active workspace 使用。
>
> **契約**：所有欄位定義參照 `.agents/WORKSPACE_SCHEMA.yaml`（SSOT）；依 PROPOSAL_20260422_022 擴充 4 欄位區塊。

---

## PROJECT_CONTEXT（專案核心資訊）

- **project_name**：<專案英文代號，snake_case>
- **display_name**：<中文/顯示名稱>
- **business_domain**：<業務領域一句話>
- **core_entities**：<核心資料結構名稱列表>
- **user_role**：<使用者角色與人數規模>
- **proposal_prefix**：<TBD>  <!-- 3-5 字母大寫；若該專案有 project scope 提案則必填。例：ILN / MYAPP；依 PROPOSAL_20260422_023 §十七.D -->

## TECH_STACK（技術棧）

- **language**：<程式語言與版本，如 Node.js 20 ESM / Python 3.11 / Go 1.21>
- **frontend**：<前端框架，如 Vue 3 / React / None>
- **backend**：<後端框架，如 Fastify / FastAPI / Express / None>
- **storage**：<儲存策略，如 File-based / PostgreSQL / MongoDB / Redis>
- **external_dependency**：<外部服務清單，如 Telegram Bot API / Slack Webhook / OpenAI API>
- **deployment**：<部署工具，如 PM2 / Docker / K8s / Serverless>
- **testing_framework**：<測試框架，如 Node.js 內建 test / pytest / jest>

## PATHS（實際專案路徑）

- **project_root**：<如 專案根目錄，通常為 `.`>
- **frontend_root**：<如 webapp/ / frontend/>
- **data_root**：<如 data/ / db/>
- **docs_root**：<如 docs/>
- **env_example**：<如 .env.example>
- **test_root**：<如 src/test/ / tests/>

### PATHS.source_modules（模組實作位置，供 tech-stacks 引用）

- **storage**：<File-based 儲存模組，如 src/modules/storage.mjs>
- **concurrency**：<併發鎖模組，如 src/modules/bot/runnerLock.mjs；缺失將阻斷狀態變更任務>
- **archive**：<歸檔模組，如 src/modules/data/archiveManager.mjs>
- **middleware**：<API middleware，如 src/api/middleware/initDataGuard.mjs>
- **composables**：<前端 composables，如 src/composables/>

### PATHS.schedulers（排程任務清單，供 nodejs-esm-backend 引用）

- <如 runDailyCheck.mjs / runNewsFetch.mjs>

## DEPLOYMENT_CONSTRAINTS（部署約束，新增於 PROPOSAL_022）

> 部署目標平台的硬性限制；供 `infra-constraints` / `file-based-storage` 等 tech-stacks 引用。

- **target**：<部署目標，如 Oracle VM Free Tier / AWS EC2 / Vercel / Self-hosted>
- **cpu**：<如 4 OCPU ARM / 2 vCPU x86>
- **memory**：<如 24GB / 1GB / 512MB>
- **storage_limit**：<如 50GB / 無限制>
- **network_limit**：<如 10TB/月 / 無限制>
- **runtime**：<如 Node.js 20 LTS / Python 3.11>
- **watchdog**：<如 PM2 / systemd / k8s liveness>
- **process_naming**：<PM2 程序命名前綴，如 iln- / app- / myproj->
- **nginx_config_path**：<如 /etc/nginx/sites-available/myproj>

## DEPLOYMENT_SOP（部署標準作業流程，新增於 PROPOSAL_022）

> 取代原 `skills/deploy-oracle.md` 內容。具體部署步驟於此填寫。

### deploy_steps（部署步驟）

1. <如 git pull origin main>
2. <如 npm install --production>
3. <如 pm2 restart <process_name>>
4. <如 pm2 status 確認 online>

### env_sync（環境變數同步）

- <如 手動編輯 Oracle VM 上的 .env / 透過 Vault 注入>

### rollback（回滾 SOP）

- <如 git revert HEAD → pm2 restart>

## BUSINESS_DOMAINS（業務域分類，新增於 PROPOSAL_022）

### core（核心業務功能）

- <如 訊號計算 / 推送管理 / 策略管理>

### realtime（即時或排程業務功能）

- <如 Mini App UI / 系統維運 / Rules 維護>

## FUNCTIONAL_DOMAINS（功能域）

> 供 `@Planner §系統功能域定義` 動態參照；Sprint 規劃時任務必須落在定義的功能域。

| 功能域 | 描述 | 主要執行 Agent |
|-------|------|--------------|
| <域名> | <描述> | `@Backend` / `@Frontend` |

## CRITICAL_PATHS（關鍵路徑）

> 供 `@Reviewer §系統關鍵路徑錯誤處理 Checklist` 與 `@Security §審查職責邊界` 動態參照。

- **外部 I/O 路徑**：<例：REST API 呼叫 / WebSocket / 第三方 SDK>
- **資料寫入路徑**：<例：File-based / SQL UPDATE / Redis SET>
- **敏感資料處理**：<例：策略權重 / 使用者密碼 / 支付 token>
- **Token 時效性**：<例：initData 24h / JWT 1h / 無時效驗證>
- **併發資源**：<例：排程 cron job / 檔案 Lock / 分散式鎖>

## SECURITY_SCOPE_EXTENSIONS（@Security SC-XX 擴充，可選）

> 若本專案有 `.agents/skills/security-audit.md §1` SC-01~SC-09 以外的專屬資安範疇，於此列出，供 `@Security` 參照。

- <not_applicable>

## QA_MANDATORY_TESTS（必測項，可選）

> 供 `@QA §系統必測功能清單` 動態參照。

### P0 必測
- [ ] <專案專屬 P0 必測項>

### P1 必測
- [ ] <專案專屬 P1 必測項>

### P2 必測
- [ ] <專案專屬 P2 必測項>

## BUSINESS_RULES（業務規則摘要，可選）

> 供 `@Consultant` 領域顧問動態參照；若本專案有特殊業務約束於此說明。

- <not_applicable>

---

**維護規範**：
- 本 workspace 填寫完成後，於 `README.md` 當前已建立的 workspace 表格新增條目
- 修改 workspace 欄位視同變更專案脈絡；`@Retro` 下次審計時檢視
- 切換 active workspace 僅需修改 `.agents/CURRENT_WORKSPACE`，無需修改本檔
- 欄位結構異動 → 必須同步更新 `.agents/WORKSPACE_SCHEMA.yaml` + schema_version
