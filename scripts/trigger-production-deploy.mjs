#!/usr/bin/env node
/**
 * Trigger production deployment via deployment agent.
 */

import { createDeploymentAgentClient } from "../src/modules/deployment/deploymentAgentClient.mjs";

const client = createDeploymentAgentClient();

console.log("🚀 Triggering production deployment...");
console.log("=".repeat(60));

try {
  const job = await client.createDeployJob({ rollback: false });
  console.log(`✅ Deployment job created: ${job.jobId}`);
  console.log(`   Tag: ${job.tag}`);
  console.log(`   Status: ${job.status}`);

  console.log("\n⏳ Waiting for deployment to complete...");

  // Poll job status
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (5s interval)

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5s

    const state = await client.getJobState(job.jobId);
    console.log(
      `   Status: ${state.status} (attempt ${attempts + 1}/${maxAttempts})`,
    );

    if (state.status === "completed") {
      console.log("\n" + "=".repeat(60));
      console.log("✅ Deployment completed successfully!");
      console.log("=".repeat(60));
      process.exit(0);
    }

    if (state.status === "failed") {
      console.error("\n" + "=".repeat(60));
      console.error("❌ Deployment failed!");
      console.error("=".repeat(60));
      if (state.error) {
        console.error(`Error: ${state.error}`);
      }
      process.exit(1);
    }

    attempts++;
  }

  console.error("\n⏰ Deployment timeout after 5 minutes");
  process.exit(1);
} catch (error) {
  console.error("\n" + "=".repeat(60));
  console.error("❌ Deployment trigger failed!");
  console.error("=".repeat(60));
  console.error(error.message);
  process.exit(1);
}
