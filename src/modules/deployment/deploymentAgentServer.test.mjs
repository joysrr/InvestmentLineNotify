/**
 * Unix-socket deployment agent contract tests.
 * TDD red phase: the privileged operation boundary is defined first.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "http";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createDeploymentAgentServer } from "./deploymentAgentServer.mjs";

const temporaryDirectories = [];
const servers = [];

async function createSocketPath() {
  const directory = await mkdtemp(join(tmpdir(), "investnotify-agent-"));
  temporaryDirectories.push(directory);
  return join(directory, "agent.sock");
}

async function callAgent(socketPath, method, path, body) {
  return new Promise((resolve, reject) => {
    const requestBody = body ? JSON.stringify(body) : "";
    const clientRequest = request(
      {
        socketPath,
        path,
        method,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(requestBody),
        },
      },
      (response) => {
        let payload = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          payload += chunk;
        });
        response.on("end", () =>
          resolve({
            statusCode: response.statusCode,
            body: payload ? JSON.parse(payload) : null,
          }),
        );
      },
    );
    clientRequest.on("error", reject);
    clientRequest.end(requestBody);
  });
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve))),
  );
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("deployment agent Unix socket API", () => {
  it("returns status without exposing privileged operations", async () => {
    const socketPath = await createSocketPath();
    const sync = vi.fn();
    const deploy = vi.fn();
    const server = createDeploymentAgentServer({ socketPath, sync, deploy });
    servers.push(server);
    await server.start();

    const response = await callAgent(socketPath, "GET", "/status");

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      service: "investnotify-deploy-agent",
      status: "ok",
    });
    expect(sync).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
  });

  it("routes sync and deploy independently", async () => {
    const socketPath = await createSocketPath();
    const sync = vi
      .fn()
      .mockResolvedValue({
        status: "completed",
        snapshotDir: "/diagnostics/one",
      });
    const deploy = vi
      .fn()
      .mockResolvedValue({ jobId: "job-1", status: "completed" });
    const server = createDeploymentAgentServer({ socketPath, sync, deploy });
    servers.push(server);
    await server.start();

    const syncResponse = await callAgent(
      socketPath,
      "POST",
      "/sync-production-artifacts",
      { dryRun: true },
    );
    const deployResponse = await callAgent(
      socketPath,
      "POST",
      "/deploy-production",
      { rollback: false },
    );

    expect(syncResponse.statusCode).toBe(200);
    expect(sync).toHaveBeenCalledWith({ dryRun: true });
    expect(deployResponse.statusCode).toBe(200);
    expect(deploy).toHaveBeenCalledWith({ rollback: false });
  });

  it("rejects unknown routes and arbitrary command fields", async () => {
    const socketPath = await createSocketPath();
    const sync = vi.fn();
    const deploy = vi.fn();
    const server = createDeploymentAgentServer({ socketPath, sync, deploy });
    servers.push(server);
    await server.start();

    const response = await callAgent(socketPath, "POST", "/exec", {
      command: "pm2 delete all",
    });

    expect(response.statusCode).toBe(404);
    expect(sync).not.toHaveBeenCalled();
    expect(deploy).not.toHaveBeenCalled();
  });
});
