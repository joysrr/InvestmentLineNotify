#!/usr/bin/env node

import { syncProductionArtifacts } from "../src/modules/operations/productionArtifactSync.mjs";

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument.startsWith("--") && args[index + 1]) {
      options[argument.slice(2)] = args[index + 1];
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requiredOptions = ["data-dir", "logs-dir", "output-dir"];
  const missing = requiredOptions.filter((option) => !options[option]);

  if (missing.length > 0) {
    throw new Error(`Missing required options: ${missing.join(", ")}`);
  }

  const result = await syncProductionArtifacts({
    sourceDataDir: options["data-dir"],
    sourceLogsDir: options["logs-dir"],
    destinationRoot: options["output-dir"],
    dryRun: options.dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(`Artifact synchronization failed: ${error.message}`);
  process.exitCode = 1;
});

export { parseArgs };
