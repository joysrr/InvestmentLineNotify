# Routing Ticket: RT-20260506-001

#Status: COMPLETED
Last Updated: 2026-05-06
Priority: HIGH
Assignee: @Lead
Ticket: RT-20260506-001

## 📌 基本資訊

- **Ticket ID**: RT-20260506-001
- **Task Class**: feature/refactor
- **Priority**: High
- **Owner**: @Lead

## 🎯 目標 (Objective)

深度審查並補全生命週期與健康度系統，修復數據抓取問題，並重構前端 UI 至卓越標準 (Rich Aesthetics)。

## 📂 涉及檔案 (Touched Files)

- `src/api/routes/portfolioHealth.mjs`
- `webapp/src/views/DashboardView.vue`
- `src/modules/strategy/strategyEngine.mjs`
- `src/modules/strategy/portfolioHealth.mjs`
- `data/config/Strategy.json`
- `docs/plans/completed/draft_perplexity_suggestion.md`

## 🚦 階段 (Stages)

1. **Research & Audit**: 審查 commit 邏輯 (Reviewer/Backend)
2. **Backend implementation**: Smart API & Cache (Backend)
3. **Frontend implementation**: Redesign UI (Frontend)
4. **Review & Verify**: QA & Smoke test (Reviewer/QA)
5. **Converge**: Docs update (Architect)

## 🏁 驗收標準 (Acceptance Criteria)

- [x] `/api/portfolio/health` 即使無 query params 也能正確返回最新數據。
- [x] API 加入快取機制，避免頻繁 Disk I/O。
- [x] Dashboard 視覺效果大幅提升，符合 Glassmorphism 與漸層色美學。
- [x] 所有生命週期與 VIX 邏輯通過審查，無遺漏的 export。
