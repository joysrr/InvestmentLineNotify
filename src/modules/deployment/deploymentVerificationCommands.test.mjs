import { describe, expect, it } from "vitest";
import { buildVerificationCommands } from "./deploymentVerificationCommands.mjs";

describe("buildVerificationCommands", () => {
  it("builds fixed local verification commands", () => {
    expect(buildVerificationCommands()).toEqual({
      commit: ["git", ["rev-parse", "--short", "HEAD"]],
      pm2: ["pm2", ["jlist"]],
      health: [
        "curl",
        [
          "--fail",
          "--silent",
          "--show-error",
          "--max-time",
          "10",
          "http://127.0.0.1:3000/health",
        ],
      ],
    });
  });
});
