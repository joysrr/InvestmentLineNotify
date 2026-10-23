import { describe, expect, it } from "vitest";
import {
  buildFrontendPermissionArgs,
  buildFrontendPermissionStep,
} from "./executor.mjs";

describe("frontend artifact permissions", () => {
  it("makes generated frontend artifacts readable and traversable", () => {
    expect(buildFrontendPermissionArgs()).toEqual(["-R", "a+rX", "dist"]);
  });

  it("builds a fixed permission step for the webapp path", () => {
    expect(buildFrontendPermissionStep("/srv/investnotify/webapp")).toEqual({
      command: "chmod",
      args: ["-R", "a+rX", "dist"],
      cwd: "/srv/investnotify/webapp",
    });
  });
});
