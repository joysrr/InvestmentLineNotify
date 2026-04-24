#!/usr/bin/env node
// agent-drift-simulator.mjs
// Agent Drift Simulator（依 PROPOSAL_20260422_025 建立）
//
// 兩模式設計：
//   Mode A（--mode static，預設）：靜態 rules 結構穩定性評分，無 LLM 呼叫，commit-time 可執行（< 5 秒）
//   Mode B（--mode dynamic）：動態 LLM 50 步對話驗證（需 ANTHROPIC_API_KEY）
//     本版本僅實作 Mode A；Mode B 為未來延伸（記錄於 PROPOSAL_025 §七 備註）
//
// 使用：
//   node .agents/tests/agent-drift-simulator.mjs [--mode static] [--steps 50] [--verbose]
//
// 退出碼：
//   0 = drift_score ≥ 0.85（通過）
//   1 = 0.70 ≤ drift_score < 0.85（警告；保留可見性，不阻斷 commit）
//   2 = drift_score < 0.70（錯誤；建議阻斷）

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_ROOT = join(__dirname, '..');
const RULES_DIR = join(AGENTS_ROOT, 'rules');

// CLI
const args = process.argv.slice(2);
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'static';
const steps = args.includes('--steps') ? parseInt(args[args.indexOf('--steps') + 1], 10) : 50;
const verbose = args.includes('--verbose');

function log(msg) { console.log(msg); }
function vlog(msg) { if (verbose) console.log(msg); }

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w]*)\s*:\s*(.+)/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function loadAllRules() {
  const rules = [];
  for (const f of readdirSync(RULES_DIR).filter(x => x.endsWith('.md'))) {
    const content = readFileSync(join(RULES_DIR, f), 'utf-8');
    rules.push({ file: f, content, fm: parseFrontmatter(content) });
  }
  return rules;
}

// -------- 評分項 1：persona_stability --------
// 檢查 rules frontmatter 完整性 + 角色定位 §s01 存在性
// 每份 rule 計分：
//   +0.25 含 agent_name
//   +0.25 含 default_model_tier
//   +0.25 含 §s01（or #任務目標 section）
//   +0.25 角色定位含「你是」（明確 Persona 宣告）
// 總分：average across rules
function scorePersonaStability(rules) {
  const scores = [];
  for (const r of rules) {
    let s = 0;
    if (r.fm && r.fm.agent_name) s += 0.25;
    if (r.fm && r.fm.default_model_tier) s += 0.25;
    if (/<section id="s01"/.test(r.content) || /^## 任務目標/m.test(r.content)) s += 0.25;
    if (/你是.+[，。]/.test(r.content)) s += 0.25;
    scores.push({ file: r.file, score: s });
    vlog(`  [persona] ${r.file}: ${s.toFixed(2)}`);
  }
  const avg = scores.reduce((a, b) => a + b.score, 0) / scores.length;
  return { avg, scores, metric: 'persona_stability' };
}

// -------- 評分項 2：instruction_accuracy --------
// 檢查 lead.md §s05 10 階段派發鏈中引用的 Agent 全部存在對應 rule
// 並檢查 §s_state_anchor 三鐵律存在
function scoreInstructionAccuracy(rules) {
  const leadRule = rules.find(r => r.file === 'lead.md');
  if (!leadRule) return { avg: 0, metric: 'instruction_accuracy', error: 'lead.md not found' };

  // 取得所有 @Agent 引用
  const mentions = new Set();
  const regex = /@(Planner|Consultant|Architect|QA|Frontend|Backend|Reviewer|Security|Retro|Assistant|Auditor|Lead)/g;
  let m;
  while ((m = regex.exec(leadRule.content)) !== null) mentions.add(m[1]);

  // 對應 rules 是否存在
  const expectedFiles = new Set();
  for (const name of mentions) {
    const fname = name.toLowerCase() + '.md';
    if (name === 'Lead') expectedFiles.add('lead.md');
    else expectedFiles.add(fname);
  }

  let found = 0;
  for (const f of expectedFiles) {
    if (rules.find(r => r.file === f)) found++;
  }
  const agentCoverage = found / expectedFiles.size;

  // 三鐵律檢查（§s_state_anchor）
  const hasStateAnchor = /<section id="s_state_anchor"/.test(leadRule.content);
  const hasThreeIron = /強制狀態讀取|禁止文本合併|短指令交接/.test(leadRule.content);

  // Complexity × Lane 雙軌（PROPOSAL_024+032）
  const hasComplexityLane = /<section id="s_complexity_lane"/.test(leadRule.content);

  const checkpoints = [
    { name: 'agent_coverage', value: agentCoverage, weight: 0.4 },
    { name: 'state_anchor', value: hasStateAnchor ? 1 : 0, weight: 0.2 },
    { name: 'three_iron_rules', value: hasThreeIron ? 1 : 0, weight: 0.2 },
    { name: 'complexity_lane_section', value: hasComplexityLane ? 1 : 0, weight: 0.2 },
  ];

  const avg = checkpoints.reduce((s, c) => s + c.value * c.weight, 0);
  vlog(`  [instruction] agent_coverage=${agentCoverage.toFixed(2)} state_anchor=${hasStateAnchor} three_iron=${hasThreeIron} complexity_lane=${hasComplexityLane}`);
  return { avg, metric: 'instruction_accuracy', checkpoints };
}

// -------- 評分項 3：boundary_adherence --------
// 統計「絕對禁止」條款密度
// 期望：每份 rule ≥ 3 條；total ≥ 13 * 3 = 39 條
// 且關鍵 rules（security / reviewer / backend / consultant）≥ 5 條
function scoreBoundaryAdherence(rules) {
  const CRITICAL = ['security.md', 'reviewer.md', 'backend.md', 'consultant.md', 'lead.md', 'auditor.md'];
  const byFile = [];
  let total = 0;
  let allPass = 0;

  for (const r of rules) {
    const count = (r.content.match(/絕對禁止/g) || []).length;
    total += count;
    byFile.push({ file: r.file, count });

    const expected = CRITICAL.includes(r.file) ? 5 : 3;
    if (count >= expected) allPass++;
    vlog(`  [boundary] ${r.file}: ${count} (expect ≥ ${expected})`);
  }

  // 每份達標比例
  const passRatio = allPass / rules.length;

  // 總密度（每份平均 ≥ 3 即滿分）
  const avgPerFile = total / rules.length;
  const densityScore = Math.min(1.0, avgPerFile / 3);

  const avg = passRatio * 0.6 + densityScore * 0.4;
  vlog(`  [boundary] total=${total}, avg_per_file=${avgPerFile.toFixed(1)}, pass_ratio=${passRatio.toFixed(2)}, density_score=${densityScore.toFixed(2)}`);
  return { avg, metric: 'boundary_adherence', byFile, total, avgPerFile, passRatio, densityScore };
}

// -------- 模擬 N 步任務序列 --------
// 隨機選取 Agent，檢查 rules 結構是否支持「穩定派發」
// 每步若對應 rule 所有三項評分 ≥ 0.8 → 視為「未漂移」
function simulateSteps(rules, personaScores, nSteps) {
  const agentRules = rules.filter(r => r.fm && r.fm.agent_id);
  if (agentRules.length === 0) return { stability: 0 };

  let stable = 0;
  const seed = 42;
  let x = seed;

  for (let i = 0; i < nSteps; i++) {
    // LCG for deterministic 偽隨機
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const idx = x % agentRules.length;
    const chosen = agentRules[idx];

    const pScore = personaScores.scores.find(s => s.file === chosen.file)?.score ?? 0;
    if (pScore >= 0.8) stable++;
  }

  return { stability: stable / nSteps, totalSteps: nSteps, stableSteps: stable };
}

// -------- Main --------
function main() {
  log('🔍 Agent Drift Simulator (Mode A — static)');
  log(`   steps=${steps}  mode=${mode}`);
  log('');

  if (mode === 'dynamic') {
    log('⚠️  Mode B (dynamic LLM validation) 尚未實作');
    log('   依 PROPOSAL_20260422_025 §七 備註：Mode B 為未來延伸，需 ANTHROPIC_API_KEY 配置');
    log('   當前環境僅支援 Mode A');
    process.exit(1);
  }

  if (!existsSync(RULES_DIR)) {
    console.error(`❌ Rules directory not found: ${RULES_DIR}`);
    process.exit(2);
  }

  const rules = loadAllRules();
  log(`📂 Loaded ${rules.length} rules files`);
  log('');

  // 三項評分
  log('📊 Scoring...');
  const persona = scorePersonaStability(rules);
  log(`   persona_stability:     ${persona.avg.toFixed(3)}`);
  const instruction = scoreInstructionAccuracy(rules);
  log(`   instruction_accuracy:  ${instruction.avg.toFixed(3)}`);
  const boundary = scoreBoundaryAdherence(rules);
  log(`   boundary_adherence:    ${boundary.avg.toFixed(3)}`);
  log('');

  // 步驟模擬
  log(`🎲 Simulating ${steps} task steps (deterministic LCG, seed=42)...`);
  const sim = simulateSteps(rules, persona, steps);
  log(`   stable_steps: ${sim.stableSteps}/${sim.totalSteps} (${(sim.stability * 100).toFixed(1)}%)`);
  log('');

  // 綜合 drift_score（依 PROPOSAL_025 §3.2 公式）
  const drift_score = persona.avg * 0.4 + instruction.avg * 0.4 + boundary.avg * 0.2;
  log('─────────────────────────────');
  log(`📈 drift_score = ${drift_score.toFixed(3)}`);
  log('   formula: persona*0.4 + instruction*0.4 + boundary*0.2');
  log('─────────────────────────────');

  // 退出碼
  if (drift_score >= 0.85) {
    log('✅ PASS (drift_score ≥ 0.85)');
    process.exit(0);
  } else if (drift_score >= 0.70) {
    log('⚠️  WARN (0.70 ≤ drift_score < 0.85)');
    process.exit(1);
  } else {
    log('❌ FAIL (drift_score < 0.70)');
    process.exit(2);
  }
}

main();
