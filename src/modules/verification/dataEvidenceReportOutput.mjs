import fs from "node:fs";
import path from "node:path";

function readJson(rootDir, relativePath, fallback = null) {
  const filePath = path.resolve(rootDir, relativePath);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadPersistedEvidenceInputs(rootDir) {
  return {
    market: readJson(rootDir, "data/market/latest.json", {}),
    pbHistory: readJson(rootDir, "data/pbHistory.json", []),
    vixHistory: readJson(rootDir, "data/vixHistory.json", []),
    sentiment: readJson(
      rootDir,
      "data/sentiment/social_sentiment_daily.json",
      null,
    ),
  };
}

function formatValue(value) {
  if (value === null || value === undefined) return "`null`";
  if (typeof value === "object") return `\`${JSON.stringify(value)}\``;
  return `\`${String(value)}\``;
}

function formatSource(source) {
  return [
    `provider: ${formatValue(source?.provider)}`,
    `dataset: ${formatValue(source?.dataset)}`,
    `status: ${formatValue(source?.status)}`,
    `endpoint: ${formatValue(source?.endpoint)}`,
    `integrity: ${formatValue(source?.integrity)}`,
    `rawHash: ${formatValue(source?.rawHash)}`,
  ].join("; ");
}

function formatList(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

export function renderEvidenceMarkdown(report) {
  const lines = [
    "# Data Evidence Report",
    "",
    `- Schema version: \`${report.schemaVersion}\``,
    `- Generated at: \`${report.generatedAt}\``,
    `- Verification scope: **${report.verificationScope}**`,
    "",
    "## Instructions for External Agent",
    "",
    formatList(report.instructions),
    "",
    "## Evidence Items",
    "",
  ];

  for (const item of report.items) {
    lines.push(
      `### ${item.field}`,
      "",
      `- Value: ${formatValue(item.value)}`,
      `- Unit: ${formatValue(item.unit)}`,
      `- Source: ${formatSource(item.source)}`,
      `- Data date: ${formatValue(item.temporal?.dataDate)}`,
      `- Fetched at: ${formatValue(item.temporal?.fetchedAt)}`,
      `- Persisted at: ${formatValue(item.temporal?.persistedAt)}`,
      `- Freshness basis: ${item.temporal?.freshnessBasis ?? "Not specified"}`,
      `- Background: ${item.verification?.background ?? "Not specified"}`,
      `- Calculation: ${item.verification?.calculation ?? "Not specified"}`,
      `- External verification status: **${item.verification?.externalAgentStatus ?? "UNKNOWN"}**`,
      "",
      "Checks:",
      formatList(item.verification?.checks ?? []),
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}
