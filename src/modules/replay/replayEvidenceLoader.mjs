import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_EVIDENCE_DIR = "data/replay-evidence";

export async function loadReplayEvidenceList(options = {}) {
  const evidenceDir =
    options.evidenceDir ||
    process.env.REPLAY_EVIDENCE_DIR ||
    DEFAULT_EVIDENCE_DIR;

  let files;
  try {
    files = await readdir(evidenceDir);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const evidenceList = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(evidenceDir, file);
    try {
      const content = await readFile(filePath, "utf8");
      const evidence = JSON.parse(content);

      if (evidence.schemaVersion && evidence.replayDate) {
        evidenceList.push(evidence);
      }
    } catch (error) {
      // Skip unparseable or invalid files
      continue;
    }
  }

  // Sort by replayDate descending
  evidenceList.sort((a, b) => b.replayDate.localeCompare(a.replayDate));

  return evidenceList;
}
