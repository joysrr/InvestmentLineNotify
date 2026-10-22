/**
 * Deployment CLI option contract.
 * TDD red phase: deployment must remain separate from artifact sync.
 */

import { describe, expect, it } from "vitest";
import { parseDeploymentArgs } from "./deploymentCliOptions.mjs";

describe("parseDeploymentArgs", () => {
  it("解析 production deployment options without data or logs inputs", () => {
    const options = parseDeploymentArgs([
      "--deploy-path",
      "/home/ubuntu/investnotify",
      "--webapp-path",
      "/home/ubuntu/investnotify/webapp",
      "--pm2-ecosystem",
      "ecosystem.config.cjs",
    ]);

    expect(options).toEqual({
      deployPath: "/home/ubuntu/investnotify",
      webappPath: "/home/ubuntu/investnotify/webapp",
      pm2Ecosystem: "ecosystem.config.cjs",
      rollback: false,
      rollbackTarget: null,
    });
    expect(options).not.toHaveProperty("dataDir");
    expect(options).not.toHaveProperty("logsDir");
  });

  it("解析 rollback 選項", () => {
    expect(
      parseDeploymentArgs(["--rollback", "--tag", "deploy-example"]),
    ).toMatchObject({
      rollback: true,
      rollbackTarget: "deploy-example",
    });
  });

  it("拒絕未知的 artifact synchronization options", () => {
    expect(() => parseDeploymentArgs(["--data-dir", "/tmp/data"])).toThrow(
      "Unknown deployment option: --data-dir",
    );
  });
});
