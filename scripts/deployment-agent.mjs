#!/usr/bin/env node

import { syncProductionArtifacts } from "../src/modules/operations/productionArtifactSync.mjs";
import { deploymentExecutor } from "../src/modules/deployment/executor.mjs";
import { createDeploymentAgentConfig } from "../src/modules/deployment/deploymentAgentConfig.mjs";
import { createDeploymentAgentServer } from "../src/modules/deployment/deploymentAgentServer.mjs";

const {
  socketPath,
  deployPath,
  webappPath,
  pm2Ecosystem,
  dataDir,
  logsDir,
  diagnosticsDir,
} = createDeploymentAgentConfig();
const server = createDeploymentAgentServer({
  socketPath,
  sync: async ({ dryRun = false } = {}) =>
    syncProductionArtifacts({
      sourceDataDir: dataDir,
      sourceLogsDir: logsDir,
      destinationRoot: diagnosticsDir,
      dryRun,
    }),
  deploy: async ({ rollback = false, rollbackTarget = null } = {}) => {
    const job = await deploymentExecutor.createDeployJob({
      deployPath,
      webappPath,
      pm2Ecosystem,
      rollback,
      rollbackTarget,
    });
    return job;
  },
});

await server.start();
console.log(`Deployment agent listening on ${socketPath}`);

async function shutdown(signal) {
  console.log(`Received ${signal}; stopping deployment agent`);
  await new Promise((resolve) => server.close(resolve));
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
