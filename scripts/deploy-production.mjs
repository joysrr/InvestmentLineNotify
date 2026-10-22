#!/usr/bin/env node

import { existsSync } from "fs";
import { deploymentExecutor } from "../src/modules/deployment/executor.mjs";
import {
  deploymentHelp,
  parseDeploymentArgs,
} from "../src/modules/deployment/deploymentCliOptions.mjs";

async function waitForCompletion(jobId) {
  while (true) {
    const state = await deploymentExecutor.getJobState(jobId);
    if (!state) throw new Error(`Deployment job not found: ${jobId}`);
    if (["completed", "failed", "cancelled"].includes(state.status))
      return state;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function main() {
  const options = parseDeploymentArgs(process.argv.slice(2));
  if (options.help) {
    console.log(deploymentHelp());
    return;
  }

  for (const path of [options.deployPath, options.webappPath]) {
    if (!existsSync(path))
      throw new Error(`Deployment path does not exist: ${path}`);
  }

  const result = await deploymentExecutor.createDeployJob(options);
  console.log(`Deployment job queued: ${result.jobId}`);

  const state = await waitForCompletion(result.jobId);
  console.log(
    JSON.stringify(
      {
        jobId: state.jobId,
        status: state.status,
        deployPath: state.deployPath,
        rollback: state.rollback,
        deployTag: state.deployTag || null,
        error: state.error,
      },
      null,
      2,
    ),
  );

  if (state.status !== "completed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Production deployment failed: ${error.message}`);
  process.exitCode = 1;
});

export { waitForCompletion };
