// auto-generated-block.mjs
// AUTO-GENERATED 區塊替換與比對工具（依 PROPOSAL_20260423_012 Phase A 建立）
// 使用於 4 generators：gen-proposal-index / gen-rules-version-index / gen-changelog / gen-framework-version
//
// 標記規格：
//   <!-- AUTO-GENERATED:BEGIN <block_name> -->
//   （generator 管理的內容）
//   <!-- AUTO-GENERATED:END <block_name> -->

export function buildBlockRegex(blockName) {
  const escaped = blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(<!--\\s*AUTO-GENERATED:BEGIN\\s+${escaped}\\s*-->)([\\s\\S]*?)(<!--\\s*AUTO-GENERATED:END\\s+${escaped}\\s*-->)`,
    'm'
  );
}

export function hasBlock(fileContent, blockName) {
  return buildBlockRegex(blockName).test(fileContent);
}

export function extractBlockBody(fileContent, blockName) {
  const match = fileContent.match(buildBlockRegex(blockName));
  if (!match) return null;
  return match[2].replace(/^\n+/, '').replace(/\n+$/, '');
}

export function replaceBlock(fileContent, blockName, newBody) {
  if (!hasBlock(fileContent, blockName)) {
    throw new Error(`AUTO-GENERATED block marker not found: "${blockName}"`);
  }
  const body = String(newBody).replace(/^\n+/, '').replace(/\n+$/, '');
  return fileContent.replace(
    buildBlockRegex(blockName),
    `$1\n${body}\n$3`
  );
}

export function checkDrift(fileContent, blockName, expectedBody) {
  const current = extractBlockBody(fileContent, blockName);
  if (current === null) {
    return { drift: true, reason: 'MISSING_MARKER', current: null, expected: expectedBody };
  }
  const normalize = (s) => String(s).replace(/\r\n/g, '\n').trim();
  const drift = normalize(current) !== normalize(expectedBody);
  return {
    drift,
    reason: drift ? 'CONTENT_DIFFERS' : 'IN_SYNC',
    current,
    expected: expectedBody,
  };
}
