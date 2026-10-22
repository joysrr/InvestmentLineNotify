import { describe, expect, it } from "vitest";
import { getBackendBuildArgs } from "./executor.mjs";

describe("getBackendBuildArgs", () => {
  it("skips backend build when the project has no build script", () => {
    expect(getBackendBuildArgs({ scripts: {} })).toBeNull();
  });

  it("returns the backend build command when declared", () => {
    expect(
      getBackendBuildArgs({ scripts: { build: "node build.mjs" } }),
    ).toEqual(["run", "build"]);
  });
});
