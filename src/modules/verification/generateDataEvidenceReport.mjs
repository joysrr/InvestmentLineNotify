import fs from "node:fs";
import path from "node:path";
import { buildDataEvidenceReport } from "./dataEvidenceReport.mjs";
import {
  loadPersistedEvidenceInputs,
  renderEvidenceMarkdown,
} from "./dataEvidenceReportOutput.mjs";

export function generateDataEvidenceReport({
  rootDir,
  outputDir = path.resolve(rootDir, "data/verification-reports"),
  generatedAt = new Date().toISOString(),
  dateLabel = generatedAt.slice(0, 10),
}) {
  const inputs = loadPersistedEvidenceInputs(rootDir);
  const report = buildDataEvidenceReport({ ...inputs, generatedAt });
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.resolve(outputDir, `${dateLabel}-data-evidence.json`);
  const markdownPath = path.resolve(outputDir, `${dateLabel}-data-evidence.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderEvidenceMarkdown(report));

  return { report, jsonPath, markdownPath };
}

export function runCli({ rootDir, generatedAt, dateLabel } = {}) {
  const resolvedRootDir =
    rootDir ?? path.resolve(new URL("../../../", import.meta.url).pathname);
  const result = generateDataEvidenceReport({
    rootDir: resolvedRootDir,
    generatedAt,
    dateLabel,
  });
  console.log(`JSON: ${result.jsonPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(
    "Scope: persisted evidence only; no external API re-fetch was performed",
  );
  return result;
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname);
if (isDirectExecution) runCli();
