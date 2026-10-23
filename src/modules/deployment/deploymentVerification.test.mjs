import { describe, expect, it } from "vitest";
import {
  buildDeploymentVerification,
  parseHealthResponse,
  parsePm2Status,
} from "./deploymentVerification.mjs";

describe("deployment verification", () => {
  it("summarizes healthy PM2 processes and API health", () => {
    const result = buildDeploymentVerification({
      commit: "abc1234",
      pm2: JSON.stringify([
        {
          name: "api-server",
          pm2_env: { status: "online" },
          pm_cwd: "/home/ubuntu/investnotify",
        },
        {
          name: "bot-daemon",
          pm2_env: { status: "online" },
          pm_cwd: "/home/ubuntu/investnotify",
        },
      ]),
      health: JSON.stringify({ status: "ok", ts: 123 }),
      expectedCwd: "/home/ubuntu/investnotify",
      expectedProcesses: ["api-server", "bot-daemon"],
    });

    expect(result).toEqual({
      commit: "abc1234",
      health: { ok: true, status: "ok", ts: 123 },
      pm2: {
        ok: true,
        processes: [
          {
            name: "api-server",
            status: "online",
            cwd: "/home/ubuntu/investnotify",
          },
          {
            name: "bot-daemon",
            status: "online",
            cwd: "/home/ubuntu/investnotify",
          },
        ],
      },
      ok: true,
    });
  });

  it("marks verification failed when a required process is offline", () => {
    const pm2 = parsePm2Status(
      JSON.stringify([
        {
          name: "api-server",
          pm2_env: { status: "online" },
          pm_cwd: "/home/ubuntu/investnotify",
        },
      ]),
      "/home/ubuntu/investnotify",
      ["api-server", "bot-daemon"],
    );

    expect(pm2.ok).toBe(false);
    expect(pm2.processes).toHaveLength(1);
  });

  it("rejects non-OK health responses", () => {
    expect(parseHealthResponse('{"status":"degraded"}')).toEqual({
      ok: false,
      status: "degraded",
    });
  });
});
