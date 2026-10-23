import { describe, expect, it } from "vitest";
import {
  buildVersionCheckCommands,
  shouldSkipDeployment,
} from "./deploymentVersionGate.mjs";

describe("buildVersionCheckCommands", () => {
  it("uses fixed Git commands for local and remote commits", () => {
    expect(buildVersionCheckCommands()).toEqual({
      local: ["git", ["rev-parse", "HEAD"]],
      remote: ["git", ["rev-parse", "origin/main"]],
    });
  });
});

describe("shouldSkipDeployment", () => {
  it("skips when local HEAD matches origin/main", () => {
    expect(shouldSkipDeployment("439a284", "439a284")).toEqual({
      skip: true,
      reason: "already-up-to-date",
      commit: "439a284",
    });
  });

  it("continues when local HEAD differs from origin/main", () => {
    expect(shouldSkipDeployment("439a284", "a9a4408")).toEqual({
      skip: false,
      reason: null,
      commit: "a9a4408",
    });
  });
});
