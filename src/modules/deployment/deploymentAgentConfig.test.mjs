/**
 * Deployment agent host-path configuration tests.
 * TDD red phase for explicit Docker-to-Host boundary configuration.
 */

import { describe, expect, it } from "vitest";
import { createDeploymentAgentConfig } from "./deploymentAgentConfig.mjs";

describe("createDeploymentAgentConfig", () => {
  it("rejects missing production path configuration", () => {
    expect(() => createDeploymentAgentConfig({})).toThrow(
      /Missing required deployment agent configuration: .*DEPLOY_PATH/,
    );
  });

  it("rejects diagnostics output inside the production checkout", () => {
    expect(() =>
      createDeploymentAgentConfig({
        INVESTNOTIFY_AGENT_SOCKET: "/run/investnotify/agent.sock",
        DEPLOY_PATH: "/srv/investnotify",
        WEBAPP_PATH: "/srv/investnotify/webapp",
        PM2_ECOSYSTEM: "ecosystem.config.cjs",
        PRODUCTION_DATA_DIR: "/srv/investnotify/data",
        PRODUCTION_LOGS_DIR: "/srv/investnotify/logs",
        DIAGNOSTICS_DIR: "/srv/investnotify/data/diagnostics",
      }),
    ).toThrow("DIAGNOSTICS_DIR must be outside DEPLOY_PATH");
  });

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
