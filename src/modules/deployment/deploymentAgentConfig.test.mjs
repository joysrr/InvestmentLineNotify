/**
 * Deployment agent host-path configuration tests.
 * TDD red phase for explicit Docker-to-Host boundary configuration.
 */

import { describe, expect, it } from "vitest";
import { createDeploymentAgentConfig } from "./deploymentAgentConfig.mjs";

describe("createDeploymentAgentConfig", () => {
  it("uses explicit Host paths and keeps sync output outside the checkout", () => {
    const config = createDeploymentAgentConfig({
      INVESTNOTIFY_AGENT_SOCKET: "/run/investnotify/agent.sock",
      DEPLOY_PATH: "/home/ubuntu/investnotify",
      WEBAPP_PATH: "/home/ubuntu/investnotify/webapp",
      PM2_ECOSYSTEM: "ecosystem.config.cjs",
      PRODUCTION_DATA_DIR: "/home/ubuntu/investnotify/data",
      PRODUCTION_LOGS_DIR: "/home/ubuntu/investnotify/logs",
      DIAGNOSTICS_DIR: "/home/ubuntu/investnotify-diagnostics",
    });

    expect(config).toEqual({
      socketPath: "/run/investnotify/agent.sock",
      deployPath: "/home/ubuntu/investnotify",
      webappPath: "/home/ubuntu/investnotify/webapp",
      pm2Ecosystem: "ecosystem.config.cjs",
      dataDir: "/home/ubuntu/investnotify/data",
      logsDir: "/home/ubuntu/investnotify/logs",
      diagnosticsDir: "/home/ubuntu/investnotify-diagnostics",
    });
    expect(config.diagnosticsDir).not.toBe(config.deployPath);
  });
});
