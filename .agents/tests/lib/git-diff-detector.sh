#!/bin/bash
# git-diff-detector.sh — 依 git diff 偵測相關 validators
# 由 PROPOSAL_20260423_008 Part 2 建立
#
# 使用：source 後呼叫 detect_relevant_validators
# 輸出：空格分隔的 validator names（可含 scripts）
#       無變更時 fallback 跑全部（保守策略）

# 標準 validator 清單（必須與 run-all.sh §Full mode RELEVANT_VALIDATORS 對齊）
# 由 PROPOSAL_20260430_005 補強：fast/full 共用單一 SoT，避免漏跑
ALL_VALIDATORS="schema intent workspace drift ref sync loc index_drift proposal_scope tech_stack rule_token routing_ticket iron_theme memory_palace"

# 依檔案類型對應 validators
# 設計原則：保守（漏報優於誤報）；未匹配的檔案類型 → 跑全部
detect_relevant_validators() {
  local files
  # 偵測 staged 檔案；若無 staged 則用 working tree changes
  files=$(git diff --cached --name-only 2>/dev/null)
  if [ -z "$files" ]; then
    files=$(git diff --name-only 2>/dev/null)
  fi

  # 完全無變更（空 commit / 罕見情境）→ 跑全部
  if [ -z "$files" ]; then
    echo "$ALL_VALIDATORS scripts"
    return
  fi

  # 收集需要的 validators（associative array）
  declare -A needed=()
  local has_unknown=0

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
      .agents/rules/*.md)
        needed[schema]=1; needed[drift]=1; needed[ref]=1; needed[sync]=1; needed[rule_token]=1; needed[iron_theme]=1
        ;;
      .agents/iron-rules/*.md)
        # iron-rules 修改觸發 iron_theme + ref + sync + rule_token（PROPOSAL_004 W-7）
        needed[iron_theme]=1; needed[ref]=1; needed[sync]=1; needed[rule_token]=1
        ;;
      ROUTING_TICKET.md|.agents/ROUTING_TICKET.md)
        needed[routing_ticket]=1
        ;;
      .agents/memory/*|.mcp.json|.agents/skills/memory-*.md|.agents/decisions/0039-*.md)
        # PROPOSAL_502_001 + ADR-0039：MemPalace 相關修改觸發
        needed[memory_palace]=1; needed[ref]=1; needed[sync]=1
        ;;
      .agents/skills/*.md|.agents/skills/*/*.md)
        # PROPOSAL_502_012：含 templates/ examples/ checklists/ 子目錄
        needed[schema]=1; needed[ref]=1; needed[sync]=1; needed[workspace]=1
        ;;
      .agents/tasks/*.md)
        # tasks 修改觸發 workspace（F2 task 引用 schema）+ schema + ref + sync（PROPOSAL_004 W-6）
        needed[schema]=1; needed[ref]=1; needed[sync]=1; needed[workspace]=1
        ;;
      .agents/tech-stacks/MANIFEST.yaml)
        needed[tech_stack]=1; needed[ref]=1
        ;;
      .agents/tech-stacks/*.md|.agents/tech-stacks/*/*.md|.agents/tech-stacks/*/*/*.md)
        needed[schema]=1; needed[workspace]=1; needed[tech_stack]=1
        ;;
      .agents/proposals/*.md|.agents/proposals/active/*.md|.agents/proposals/completed/*.md|.agents/proposals/archived/*.md)
        needed[intent]=1; needed[sync]=1; needed[index_drift]=1; needed[proposal_scope]=1
        ;;
      .agents/proposals/PROPOSAL_INDEX.md)
        needed[intent]=1; needed[index_drift]=1
        ;;
      .agents/workspaces/*/proposals/*.md|.agents/workspaces/*/proposals/active/*.md|.agents/workspaces/*/proposals/completed/*.md|.agents/workspaces/*/proposals/archived/*.md)
        needed[workspace]=1; needed[proposal_scope]=1
        ;;
      .agents/WORKSPACE_SCHEMA.yaml)
        needed[workspace]=1; needed[scripts]=1
        ;;
      .agents/SYSTEM_THRESHOLDS.yaml)
        needed[sync]=1
        ;;
      .agents/scripts/*.mjs)
        needed[scripts]=1
        ;;
      .agents/tests/scripts/*.mjs|.agents/tests/scripts/*.sh|.agents/tests/lib/*.sh)
        needed[scripts]=1
        ;;
      .agents/tests/*.mjs|.agents/tests/*.sh)
        # 個別 validator 修改 → 跑該 validator
        # 簡化：跑 sync（會檢驗 validators 一致性）
        needed[sync]=1
        ;;
      .agents/docs/*.md)
        needed[loc]=1; needed[sync]=1
        ;;
      docs/*.md)
        needed[loc]=1
        ;;
      .agents/RULES_DESIGN_GUIDE.md)
        needed[drift]=1; needed[sync]=1; needed[ref]=1
        ;;
      .agents/CHANGELOG.md|.agents/FRAMEWORK_VERSION|.agents/RULES_VERSION_INDEX.md)
        needed[sync]=1; needed[index_drift]=1
        ;;
      .agents/RULES_METADATA_SCHEMA.md)
        needed[schema]=1; needed[ref]=1
        ;;
      .agents/CURRENT_WORKSPACE)
        needed[workspace]=1
        ;;
      .agents/workspaces/*.md|.agents/workspaces/*/*.md)
        needed[workspace]=1
        ;;
      .agents/domains/*.md)
        needed[ref]=1
        ;;
      .agents/*)
        # 未明確分類的 .agents/ 檔案 → 保守：跑 sync
        needed[sync]=1
        has_unknown=1
        ;;
      *)
        # 非 framework 檔案（src/ / data/ / 業務文件）→ 完全跳過
        ;;
    esac
  done <<< "$files"

  # 若有 unknown 類型（保守）→ 也加 schema 防漏
  if [ "$has_unknown" -eq 1 ]; then
    needed[schema]=1
  fi

  # 輸出空格分隔
  echo "${!needed[@]}"
}
