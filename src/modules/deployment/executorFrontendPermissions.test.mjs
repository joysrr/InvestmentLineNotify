import { describe, expect, it } from "vitest";
import { buildFrontendPermissionArgs } from "./executor.mjs";

describe("buildFrontendPermissionArgs", () => {
  it("makes generated frontend artifacts readable and traversable", () => {
    expect(buildFrontendPermissionArgs()).toEqual(["-R", "a+rX", "dist"]);
  });
});
